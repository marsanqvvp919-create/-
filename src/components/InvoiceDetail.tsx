import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  onSnapshot, 
  doc, 
  updateDoc,
  collection
} from "firebase/firestore";
import { MasterInvoice, Product, Clinic, Allocation, InvoiceSettings } from "../types";
import { logAction, handleFirestoreError, OperationType } from "../lib/audit";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  X,
  AlertTriangle, 
  CheckCircle2, 
  Package,
  ChevronRight,
  TrendingUp,
  Receipt,
  FileDown,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency, cn } from "../lib/utils";
import { generateBulkPDF } from "./InvoicePDFGenerator";

const DEFAULT_SETTINGS: InvoiceSettings = {
  companyName: "MediDistribute 管理本部",
  companyAddress: "〒100-0001 東京都千代田区千代田1-1",
  bankInfo: "○○銀行 □□支店 普通 1234567\nメディディストリビュート 宛",
  taxRate: 0,
  footerNote: "ご不明な点がございましたら、管理本部までお問い合わせください。",
  showMasterSummary: true
};

interface InvoiceDetailProps {
  invoiceId: string;
  onBack: () => void;
}

export function InvoiceDetail({ invoiceId, onBack }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<MasterInvoice | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);
  const [isAddingAlloc, setIsAddingAlloc] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [clinicSearchQuery, setClinicSearchQuery] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Invoice
    const unsubInv = onSnapshot(doc(db, "masterInvoices", invoiceId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setInvoice({ 
          id: snapshot.id, 
          ...data,
          items: data.items || [],
          allocations: data.allocations || [],
          shippingFee: data.shippingFee || 0,
          handlingFee: data.handlingFee || 0,
          totalAmount: data.totalAmount || 0
        } as MasterInvoice);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `masterInvoices/${invoiceId}`));

    // Fetch Clinics
    const unsubClinics = onSnapshot(collection(db, "clinics"), (s) => 
      setClinics(s.docs.map(d => ({ id: d.id, ...d.data() } as Clinic))),
      (error) => handleFirestoreError(error, OperationType.GET, "clinics")
    );

    // Fetch Settings
    const unsubSettings = onSnapshot(doc(db, "settings", "invoice"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as InvoiceSettings);
      }
    });

    return () => {
      unsubInv();
      unsubClinics();
      unsubSettings();
    };
  }, [invoiceId]);

  const handleSaveAllocations = async (allocations: Allocation[], logParams?: { action: string, details: string }) => {
    if (!invoice) return;
    try {
      await updateDoc(doc(db, "masterInvoices", invoiceId), {
        allocations,
        status: allocations.length > 0 ? "distributed" : "pending"
      });
      if (logParams) {
        await logAction({
          action: "update",
          entityType: "allocation",
          entityId: invoiceId,
          entityName: invoice.title,
          details: logParams.details
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `masterInvoices/${invoiceId}`);
    }
  };

  const addAllocation = (clinicId: string) => {
    if (!invoice || !clinicId) return;
    const clinic = clinics.find(c => c.id === clinicId);
    if (!clinic) return;

    const currentAllocations = invoice.allocations || [];

    // Check if already exists
    if (currentAllocations.some(a => a.clinicId === clinicId)) {
      alert("このクリニックは既に追加されています。");
      return;
    }

    const newAllocations = [
      ...currentAllocations,
      {
        clinicId,
        clinicName: clinic.name,
        itemAllocations: (invoice.items || []).map(item => ({
          productId: item.productId,
          quantity: 0
        }))
      }
    ];
    handleSaveAllocations(newAllocations, { action: "add_allocation", details: `Added clinic: ${clinic.name}` });
    setIsAddingAlloc(false);
  };

  const removeAllocation = async (clinicId: string) => {
    if (!invoice || !invoice.allocations) return;
    
    try {
      const clinic = clinics.find(c => c.id === clinicId);
      const newAllocations = invoice.allocations.filter(a => a.clinicId !== clinicId);
      await handleSaveAllocations(newAllocations, { action: "remove_allocation", details: `Removed clinic: ${clinic?.name || clinicId}` });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `masterInvoices/${invoiceId}`);
    }
  };

  const updateAllocQuantity = (clinicId: string, productId: string, qty: number) => {
    if (!invoice) return;
    const newAllocations = invoice.allocations.map(a => {
      if (a.clinicId === clinicId) {
        return {
          ...a,
          itemAllocations: a.itemAllocations.map(ia => 
            ia.productId === productId ? { ...ia, quantity: qty } : ia
          )
        };
      }
      return a;
    });
    handleSaveAllocations(newAllocations);
  };

  const updateAllocFee = (clinicId: string, type: 'shipping' | 'handling', fee: number) => {
    if (!invoice) return;
    const newAllocations = invoice.allocations.map(a => {
      if (a.clinicId === clinicId) {
        return {
          ...a,
          [type === 'shipping' ? 'shippingFee' : 'handlingFee']: fee
        };
      }
      return a;
    });
    handleSaveAllocations(newAllocations);
  };

  const handleExportPDF = async () => {
    if (!invoice) return;
    setIsGeneratingPDF(true);
    try {
      const masterClinic = clinics.find(c => c.id === invoice.masterClinicId);
      await generateBulkPDF(invoice, invoice.allocations, clinics, masterClinic, settings);
      await logAction({
        action: "update",
        entityType: "invoice",
        entityId: invoice.id,
        entityName: invoice.title,
        details: `Generated bulk PDF invoices for ${invoice.allocations.length} sub-clinics`
      });
      alert("PDFの生成が完了しました。ダウンロードを開始します。");
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("PDFの生成中にエラーが発生しました。");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!invoice) return null;

  // Reconciliation Logic
  const getAllocatedTotalQty = (productId: string) => {
    return invoice.allocations.reduce((sum, a) => {
      const item = a.itemAllocations.find(ia => ia.productId === productId);
      return sum + (item?.quantity || 0);
    }, 0);
  };

  const getAllocatedTotalAmount = () => {
    return invoice.allocations.reduce((sum, a) => {
      const medicineTotal = a.itemAllocations.reduce((iSum, ia) => {
        const masterItem = invoice.items.find(mi => mi.productId === ia.productId);
        return iSum + (ia.quantity * (masterItem?.unitPrice || 0));
      }, 0);
      return sum + medicineTotal + (a.shippingFee || 0) + (a.handlingFee || 0);
    }, 0);
  };

  const getAllocatedMedicinesOnly = () => {
    return invoice.allocations.reduce((sum, a) => {
      return sum + a.itemAllocations.reduce((iSum, ia) => {
        const masterItem = invoice.items.find(mi => mi.productId === ia.productId);
        return iSum + (ia.quantity * (masterItem?.unitPrice || 0));
      }, 0);
    }, 0);
  };

  const isFullyReconciled = invoice.items.every(item => getAllocatedTotalQty(item.productId) === item.quantity);
  // Compare master invoice total against (distributed medicines + master-level fees)
  // This effectively measures the balance of the drug portions that need matching.
  const totalDifference = invoice.totalAmount - (getAllocatedMedicinesOnly() + invoice.shippingFee + invoice.handlingFee);

  return (
    <div className="space-y-12 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-4 bg-stone-100 hover:bg-stone-200 rounded-3xl transition-all text-stone-600 shadow-sm">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl font-serif tracking-tight text-stone-800">{invoice.title}</h1>
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                isFullyReconciled ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-amber-50 border-amber-200 text-amber-600"
              )}>
                {isFullyReconciled ? "照合完了" : "未照合"}
              </span>
            </div>
            <p className="text-stone-400 font-bold text-[11px] uppercase tracking-[0.2em]">{invoice.masterClinicName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-stone-50 p-2 rounded-[28px] border border-stone-100">
           <button 
             onClick={handleExportPDF}
             disabled={isGeneratingPDF || invoice.allocations.length === 0 || !isFullyReconciled}
             className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl shadow-sm border border-stone-100 transition-all font-bold text-xs uppercase tracking-widest text-stone-600"
           >
             {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 outline-none" />}
             PDF一括作成
           </button>
           <div className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-stone-100">
              <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block mb-1">マスター合計額</span>
              <span className="text-lg font-serif italic text-stone-800">{formatCurrency(invoice.totalAmount)}</span>
           </div>
           <div className="px-6 py-3 bg-stone-800 rounded-2xl shadow-lg border border-stone-700">
              <span className="text-[9px] font-bold text-stone-300 uppercase tracking-widest block mb-1">分配残額</span>
              <span className="text-lg font-serif italic text-white">{formatCurrency(totalDifference)}</span>
           </div>
        </div>
      </div>

      {/* Reconciliation Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[40px] p-10 border border-stone-200 shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-serif italic text-stone-800 flex items-center gap-3">
                <Receipt className="w-5 h-5 text-stone-400" /> 分配バランス状況
              </h3>
            </div>
            
            <div className="space-y-6">
              {invoice.items.map(item => {
                const allocated = getAllocatedTotalQty(item.productId);
                const percent = Math.min((allocated / item.quantity) * 100, 100);
                const isOver = allocated > item.quantity;
                const isComplete = allocated === item.quantity;

                return (
                  <div key={item.productId} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-stone-700">{item.productName}</span>
                        <span className="text-[10px] text-stone-400 font-mono italic">単価: {formatCurrency(item.unitPrice)}</span>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "font-mono font-bold",
                          isOver ? "text-rose-500" : isComplete ? "text-emerald-500" : "text-stone-800"
                        )}>
                          {allocated} / {item.quantity}
                        </span>
                        <span className="text-[10px] text-stone-400 ml-2 uppercase font-black">個</span>
                      </div>
                    </div>
                    <div className="h-2 bg-stone-50 rounded-full overflow-hidden border border-stone-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          isOver ? "bg-rose-500" : isComplete ? "bg-emerald-500" : "bg-stone-800"
                        )}
                      />
                    </div>
                    {allocated !== item.quantity && (
                      <div className={cn(
                        "flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                        isOver ? "text-rose-500" : "text-amber-500"
                      )}>
                        {isOver ? (
                          <><AlertTriangle className="w-3 h-3" /> 大元数量を {allocated - item.quantity}個 超過しています</>
                        ) : (
                          <><AlertTriangle className="w-3 h-3" /> 未分配分が {item.quantity - allocated}個 あります</>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-stone-50 rounded-full opacity-50" />
        </div>

        <div className="space-y-6">
          <div className="bg-stone-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <TrendingUp className="w-8 h-8 text-stone-500 mb-6 group-hover:text-stone-300 transition-colors" />
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 mb-2">総分配額 (送料・手数料込)</h4>
              <div className="text-4xl font-serif italic mb-4">{formatCurrency(getAllocatedTotalAmount())}</div>
              <p className="text-[10px] text-stone-500 font-mono tracking-tight leading-relaxed">
                ※ 各院の製剤代金に、個別に設定された送料・手数料を合算した総額です。
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsAddingAlloc(true)}
            className="w-full h-32 rounded-[40px] border-2 border-dashed border-stone-200 hover:border-stone-800 hover:bg-stone-50 transition-all flex flex-col items-center justify-center gap-3 text-stone-400 hover:text-stone-800 group"
          >
            <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-widest">分配先を追加</span>
          </button>
        </div>
      </div>

      {/* Allocation List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-xl font-serif text-stone-800">各院への分配明細</h3>
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            {invoice.allocations.length} クリニックに分配中
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {invoice.allocations.map(alloc => (
            <motion.div 
              key={alloc.clinicId}
              layout
              className="bg-white rounded-[32px] border border-stone-200 shadow-sm overflow-hidden"
            >
              <div className="p-8 border-b border-stone-50 bg-stone-50/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-stone-100 shadow-sm">
                    <TrendingUp className="w-6 h-6 text-stone-800" />
                  </div>
                  <h4 className="text-xl font-serif text-stone-800">{alloc.clinicName}</h4>
                </div>
                <AnimatePresence mode="wait">
                  {confirmingDeleteId === alloc.clinicId ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2 bg-rose-50 p-1.5 rounded-xl border border-rose-100"
                    >
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          const clinic = clinics.find(c => c.id === alloc.clinicId);
                          const newAllocations = (invoice?.allocations || []).filter(a => a.clinicId !== alloc.clinicId);
                          await handleSaveAllocations(newAllocations, { action: "remove_allocation", details: `Removed clinic: ${clinic?.name || alloc.clinicId}` });
                          setConfirmingDeleteId(null);
                        }}
                        className="px-3 py-1.5 bg-rose-500 text-white text-[10px] font-black uppercase rounded-lg hover:bg-rose-600"
                      >
                        はい (Y)
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(null);
                        }}
                        className="px-3 py-1.5 bg-white text-stone-400 text-[10px] font-black uppercase rounded-lg border border-stone-200 hover:bg-stone-50"
                      >
                        いいえ (N)
                      </button>
                    </motion.div>
                  ) : (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingDeleteId(alloc.clinicId);
                      }}
                      className="p-2 text-stone-400 hover:text-rose-500 transition-colors"
                      aria-label="分配を削除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="p-8 space-y-6">
                {alloc.itemAllocations.map(ia => {
                  const masterItem = invoice.items.find(mi => mi.productId === ia.productId);
                  return (
                    <div key={ia.productId} className="flex items-center justify-between group">
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">
                          {masterItem?.productName || "不明な製剤"}
                        </span>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number"
                            min="0"
                            value={ia.quantity}
                            onChange={e => updateAllocQuantity(alloc.clinicId, ia.productId, Number(e.target.value))}
                            className="w-24 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-stone-800/10 outline-none"
                          />
                          <span className="text-[10px] text-stone-300 font-bold">× {formatCurrency(masterItem?.unitPrice || 0)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest block">小計</span>
                        <span className="text-sm font-bold text-stone-800">
                          {formatCurrency(ia.quantity * (masterItem?.unitPrice || 0))}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-50">
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">送料 (任意)</label>
                    <div className="flex items-center gap-2">
                       <span className="text-stone-300">¥</span>
                       <input 
                         type="number"
                         min="0"
                         placeholder="0"
                         value={alloc.shippingFee || ""}
                         onChange={e => updateAllocFee(alloc.clinicId, "shipping", Number(e.target.value))}
                         className="w-full bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-stone-800/10 transition-all"
                       />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">手数料 (任意)</label>
                    <div className="flex items-center gap-2">
                       <span className="text-stone-300">¥</span>
                       <input 
                         type="number"
                         min="0"
                         placeholder="0"
                         value={alloc.handlingFee || ""}
                         onChange={e => updateAllocFee(alloc.clinicId, "handling", Number(e.target.value))}
                         className="w-full bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-stone-800/10 transition-all"
                       />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">院別合計額</span>
                  <span className="text-xl font-serif italic text-stone-800">
                    {formatCurrency(
                      alloc.itemAllocations.reduce((sum, ia) => {
                        const masterItem = invoice.items.find(mi => mi.productId === ia.productId);
                        return sum + (ia.quantity * (masterItem?.unitPrice || 0));
                      }, 0) + (alloc.shippingFee || 0) + (alloc.handlingFee || 0)
                    )}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          
          {invoice.allocations.length === 0 && (
            <div className="col-span-full py-24 text-center bg-stone-50 rounded-[48px] border-2 border-dashed border-stone-100">
              <Package className="w-16 h-16 text-stone-200 mx-auto mb-6" />
              <p className="text-xl font-serif text-stone-400 italic">未分配です</p>
              <p className="text-stone-300 text-xs mt-2 uppercase tracking-widest font-bold">右上の「分配先を追加」から開始してください。</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAddingAlloc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingAlloc(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl p-10 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8 px-2">
                <h4 className="text-2xl font-serif text-stone-800">分配先クリニックを選択</h4>
                <button 
                  onClick={() => {
                    setIsAddingAlloc(false);
                    setClinicSearchQuery("");
                  }}
                  className="p-2 hover:bg-stone-50 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <form onSubmit={(e) => e.preventDefault()} className="mb-6">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="クリニックを探す..."
                    value={clinicSearchQuery}
                    onChange={(e) => setClinicSearchQuery(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-5 py-4 pr-12 outline-none focus:ring-4 focus:ring-stone-800/5 text-sm"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-stone-400">
                    <TrendingUp className="w-4 h-4 opacity-30" />
                  </div>
                </div>
              </form>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {clinics
                  .filter(c => c.parentMasterId === invoice.masterClinicId)
                  .filter(c => !invoice.allocations.some(a => a.clinicId === c.id))
                  .filter(c => c.name.toLowerCase().includes(clinicSearchQuery.toLowerCase()))
                  .map(clinic => (
                    <button 
                      key={clinic.id}
                      onClick={() => {
                        addAllocation(clinic.id);
                        setClinicSearchQuery("");
                      }}
                      className="w-full flex items-center justify-between p-5 bg-stone-50 hover:bg-stone-800 hover:text-white rounded-2xl transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <TrendingUp className="w-5 h-5 opacity-20 group-hover:opacity-100" />
                        <span className="font-bold text-sm">{clinic.name}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
              </div>
              <button 
                onClick={() => {
                  setIsAddingAlloc(false);
                  setClinicSearchQuery("");
                }}
                className="w-full mt-8 py-4 rounded-2xl hover:bg-stone-100 font-bold text-xs uppercase tracking-widest text-stone-400 transition-all"
              >
                キャンセル
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
