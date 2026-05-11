import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, orderBy, updateDoc } from "firebase/firestore";
import { MasterInvoice, Product, Clinic, MasterInvoiceItem } from "../types";
import { logAction, handleFirestoreError, OperationType } from "../lib/audit";
import { Plus, FileText, Trash2, ChevronRight, Package, Calculator, Truck, Receipt, X, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatCurrency } from "../lib/utils";

export function InvoiceManager({ onSelectInvoice }: { onSelectInvoice: (id: string) => void }) {
  const [invoices, setInvoices] = useState<MasterInvoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [productSearchQueries, setProductSearchQueries] = useState<{[key: number]: string}>({});
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  
  const [title, setTitle] = useState("");
  const [selectedMasterClinicId, setSelectedMasterClinicId] = useState("");
  const [items, setItems] = useState<MasterInvoiceItem[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [handlingFee, setHandlingFee] = useState(0);

  useEffect(() => {
    const qInv = query(collection(db, "masterInvoices"), orderBy("createdAt", "desc"));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MasterInvoice)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "masterInvoices"));

    const unsubProd = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "products"));

    const unsubClinics = onSnapshot(collection(db, "clinics"), (snapshot) => {
      setClinics(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "clinics"));

    return () => {
      unsubInv();
      unsubProd();
      unsubClinics();
    };
  }, []);

  const startEdit = (inv: MasterInvoice) => {
    setEditingInvoiceId(inv.id);
    setTitle(inv.title);
    setSelectedMasterClinicId(inv.masterClinicId);
    setItems(inv.items);
    setShippingFee(inv.shippingFee);
    setHandlingFee(inv.handlingFee);
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingInvoiceId(null);
    setTitle("");
    setSelectedMasterClinicId("");
    setItems([]);
    setShippingFee(0);
    setHandlingFee(0);
    setProductSearchQueries({});
    setActiveSearchIndex(null);
    setIsAdding(false);
  };

  const addItem = () => {
    const nextIndex = items.length;
    setItems([...items, { productId: "", productName: "", quantity: 1, unitPrice: 0 }]);
    setProductSearchQueries({ ...productSearchQueries, [nextIndex]: "" });
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    const newQueries = { ...productSearchQueries };
    delete newQueries[index];
    setProductSearchQueries(newQueries);
  };

  const updateItem = (index: number, field: keyof MasterInvoiceItem, value: any) => {
    const newItems = [...items];
    if (field === "productId") {
      const product = products.find(p => p.id === value);
      newItems[index].productId = value;
      newItems[index].productName = product?.name || "";
    } else {
      newItems[index][field] = value as never;
    }
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const totalAmount = calculateSubtotal() + Number(shippingFee) + Number(handlingFee);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMasterClinicId || items.length === 0) {
      alert("全称（クリニック名）と少なくとも1つの製品を選択してください。");
      return;
    }

    const masterClinic = clinics.find(c => c.id === selectedMasterClinicId);
    
    try {
      if (editingInvoiceId) {
        await updateDoc(doc(db, "masterInvoices", editingInvoiceId), {
          title: title || `${masterClinic?.name} 請求書`,
          masterClinicId: selectedMasterClinicId,
          masterClinicName: masterClinic?.name || "",
          items,
          shippingFee: Number(shippingFee),
          handlingFee: Number(handlingFee),
          totalAmount,
          updatedAt: new Date().toISOString()
        });

        await logAction({
          action: "update",
          entityType: "invoice",
          entityId: editingInvoiceId,
          entityName: title || masterClinic?.name,
          details: `Updated master invoice items and fees`
        });
      } else {
        const docRef = await addDoc(collection(db, "masterInvoices"), {
          title: title || `${masterClinic?.name} 請求書`,
          masterClinicId: selectedMasterClinicId,
          masterClinicName: masterClinic?.name || "",
          items,
          shippingFee: Number(shippingFee),
          handlingFee: Number(handlingFee),
          totalAmount,
          allocations: [],
          status: "pending",
          createdAt: new Date().toISOString()
        });

        await logAction({
          action: "create",
          entityType: "invoice",
          entityId: docRef.id,
          entityName: title || masterClinic?.name,
          details: `Created master invoice with ${items.length} items`
        });
      }

      setEditingInvoiceId(null);
      setTitle("");
      setSelectedMasterClinicId("");
      setItems([]);
      setShippingFee(0);
      setHandlingFee(0);
      setProductSearchQueries({});
      setActiveSearchIndex(null);
      setIsAdding(false);
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("請求書の保存中にエラーが発生しました。");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif tracking-tight text-stone-800">マスター請求書</h1>
          <p className="text-stone-500 mt-1">サプライヤーからの請求を登録し、分配を管理します。</p>
        </div>
        <button 
          onClick={() => {
            cancelEdit();
            setIsAdding(true);
          }}
          className="flex items-center justify-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-full hover:bg-stone-700 transition-all font-bold text-xs uppercase tracking-widest shadow-lg"
        >
          <Plus className="w-5 h-5" /> 請求書を登録
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-10 rounded-[40px] border border-stone-200 shadow-2xl space-y-10"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center text-white">
                  <Receipt className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-serif text-stone-800">{editingInvoiceId ? "マスター請求書を編集" : "新規マスター請求書"}</h2>
              </div>
              <button 
                onClick={() => setIsAdding(false)}
                className="p-2 hover:bg-stone-50 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-stone-400" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">請求書タイトル / 管理名</label>
                  <input 
                    placeholder="例: 2024年5月分 商品仕入"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">全称（マスタークリニック名）</label>
                  <select 
                    required
                    value={selectedMasterClinicId}
                    onChange={e => setSelectedMasterClinicId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg appearance-none"
                  >
                    <option value="">クリニックを選択...</option>
                    {clinics.filter(c => c.isMaster).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-stone-500">明細項目</h3>
                  <button 
                    type="button" 
                    onClick={addItem}
                    className="flex items-center gap-2 text-stone-800 hover:text-stone-600 font-bold text-[10px] uppercase tracking-widest transition-all"
                  >
                    <Plus className="w-4 h-4" /> 項目を追加
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-stone-50/50 p-6 rounded-[24px] border border-stone-100 relative group">
                      <div className="md:col-span-1 space-y-1 relative">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">製剤名</label>
                        <div className="relative">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="製剤名を検索..."
                              value={item.productId ? item.productName : (productSearchQueries[index] || "")}
                              onChange={(e) => {
                                if (item.productId) {
                                  updateItem(index, "productId", "");
                                }
                                setProductSearchQueries({ ...productSearchQueries, [index]: e.target.value });
                                setActiveSearchIndex(index);
                              }}
                              onFocus={() => setActiveSearchIndex(index)}
                              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none"
                            />
                            {item.productId && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(index, "productId", "");
                                  setProductSearchQueries({ ...productSearchQueries, [index]: "" });
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-800"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <AnimatePresence>
                            {activeSearchIndex === index && !item.productId && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={() => setActiveSearchIndex(null)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-stone-100 rounded-2xl shadow-xl z-20 max-h-60 overflow-y-auto custom-scrollbar"
                                >
                                  {products
                                    .filter(p => p.name.toLowerCase().includes((productSearchQueries[index] || "").toLowerCase()))
                                    .map(p => (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                          updateItem(index, "productId", p.id);
                                          setActiveSearchIndex(null);
                                        }}
                                        className="w-full text-left px-5 py-3 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0"
                                      >
                                        <div className="text-sm font-bold text-stone-700">{p.name}</div>
                                        <div className="text-[10px] text-stone-400 uppercase tracking-widest">{p.category}</div>
                                      </button>
                                    ))}
                                  {products.filter(p => p.name.toLowerCase().includes((productSearchQueries[index] || "").toLowerCase())).length === 0 && (
                                    <div className="px-5 py-8 text-center text-stone-400 text-xs italic">
                                      一致する製剤が見つかりません
                                    </div>
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">数量</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={e => updateItem(index, "quantity", Number(e.target.value))}
                          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">単価 (円)</label>
                        <input 
                          type="number"
                          required
                          value={item.unitPrice}
                          onChange={e => updateItem(index, "unitPrice", Number(e.target.value))}
                          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-mono"
                        />
                      </div>
                      <div className="flex items-end justify-between gap-4">
                        <div className="mb-2 text-right flex-1">
                          <span className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter block">小計</span>
                          <span className="text-sm font-mono font-bold text-stone-800">{(item.quantity * item.unitPrice).toLocaleString()}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeItem(index)}
                          className="mb-1 p-2 text-stone-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                     <div className="text-center py-10 border-2 border-dashed border-stone-100 rounded-[24px]">
                       <p className="text-xs text-stone-400 font-mono">「項目を追加」をクリックして薬品を登録してください</p>
                     </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-stone-100">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-stone-400">
                    <Truck className="w-4 h-4" />
                    <label className="text-[10px] font-bold uppercase tracking-widest">送料</label>
                  </div>
                  <input 
                    type="number"
                    value={shippingFee}
                    onChange={e => setShippingFee(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-stone-400">
                    <Calculator className="w-4 h-4" />
                    <label className="text-[10px] font-bold uppercase tracking-widest">手数料</label>
                  </div>
                  <input 
                    type="number"
                    value={handlingFee}
                    onChange={e => setHandlingFee(Number(e.target.value))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none font-mono"
                  />
                </div>
                <div className="bg-stone-900 rounded-[32px] p-8 text-white flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-1">合計金額 (税込)</span>
                  <div className="text-4xl font-serif italic">{formatCurrency(totalAmount)}</div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={cancelEdit} 
                  className="px-8 py-4 rounded-2xl hover:bg-stone-100 font-bold text-xs uppercase tracking-widest transition-all"
                >
                  キャンセル
                </button>
                <button type="submit" className="bg-stone-800 text-white px-12 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl hover:bg-stone-700 transition-all">
                  {editingInvoiceId ? "マスターを更新" : "マスター作成"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {invoices.map((inv) => (
          <motion.div
            key={inv.id}
            layout
            onClick={() => onSelectInvoice(inv.id)}
            className="group bg-white p-8 rounded-[36px] border border-stone-200 shadow-sm hover:shadow-xl hover:border-stone-800 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start justify-between relative z-10 mb-8">
               <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center border border-stone-100 group-hover:border-stone-200 transition-colors">
                <FileText className="w-7 h-7 text-stone-400 group-hover:text-stone-800" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                  inv.status === "distributed" ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-500"
                )}>
                  {inv.status === "distributed" ? "分配済み" : "未分配"}
                </span>
                <AnimatePresence mode="wait">
                  {confirmingDeleteId === inv.id ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button 
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          try {
                            await deleteDoc(doc(db, "masterInvoices", inv.id));
                            await logAction({
                              action: "delete",
                              entityType: "invoice",
                              entityId: inv.id,
                              entityName: inv.title
                            });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, `masterInvoices/${inv.id}`);
                          }
                          setConfirmingDeleteId(null);
                        }}
                        className="px-2 py-1 bg-rose-500 text-white text-[8px] font-black uppercase rounded hover:bg-rose-600"
                      >
                        はい (Y)
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(null);
                        }}
                        className="px-2 py-1 bg-white text-stone-400 text-[8px] font-black uppercase rounded border border-stone-200 hover:bg-stone-50"
                      >
                        いいえ (N)
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(inv);
                        }}
                        className="p-2 text-stone-400 hover:text-stone-800 transition-colors"
                        aria-label="Edit invoice"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async (e) => { 
                          e.stopPropagation(); 
                          setConfirmingDeleteId(inv.id);
                        }}
                        className="p-2 text-stone-400 hover:text-rose-500 transition-colors"
                        aria-label="Delete invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="relative z-10">
              <h3 className="text-2xl font-serif text-stone-800 leading-tight mb-2">{inv.title}</h3>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-6">{inv.masterClinicName}</p>
              
              <div className="space-y-3 pt-6 border-t border-stone-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-400 font-medium tracking-tight">登録日</span>
                  <span className="text-stone-600 font-mono italic">{new Date(inv.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 text-xs font-medium tracking-tight">総計</span>
                  <span className="text-xl font-serif italic text-stone-800">{formatCurrency(inv.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 overflow-hidden">
                {inv.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md">
                    <Package className="w-2 h-2 text-stone-300" />
                    <span className="text-[8px] font-bold text-stone-500 truncate max-w-[60px]">{item.productName}</span>
                  </div>
                ))}
                {inv.items.length > 3 && (
                  <span className="text-[8px] font-bold text-stone-300">+{inv.items.length - 3}</span>
                )}
              </div>
            </div>

            <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
               <ChevronRight className="w-6 h-6 text-stone-200" />
            </div>
            
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-stone-50 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
          </motion.div>
        ))}

        {invoices.length === 0 && (
          <div className="col-span-full py-32 text-center bg-stone-50 rounded-[48px] border border-dashed border-stone-200">
            <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
              <FileText className="w-10 h-10 text-stone-300" />
            </div>
            <p className="text-3xl font-serif text-stone-400 italic">請求書がありません</p>
            <p className="text-stone-300 text-sm mt-3 max-w-xs mx-auto text-pretty">マスター請求書を作成して、各クリニックへの分配プロセスを開始してください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
