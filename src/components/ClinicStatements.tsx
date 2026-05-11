import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, getDocs, collectionGroup, where } from "firebase/firestore";
import { Clinic, Allocation, Product, MasterInvoice } from "../types";
import { handleFirestoreError, OperationType } from "../lib/audit";
import { Hospital, Search, ChevronRight, Building2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatCurrency } from "../lib/utils";

export function ClinicStatements() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const unsubClinics = onSnapshot(collection(db, "clinics"), 
      (s) => setClinics(s.docs.map(d => ({ id: d.id, ...d.data() } as Clinic))),
      (error) => handleFirestoreError(error, OperationType.GET, "clinics")
    );
    const unsubProducts = onSnapshot(collection(db, "products"), 
      (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))),
      (error) => handleFirestoreError(error, OperationType.GET, "products")
    );
    return () => {
      unsubClinics();
      unsubProducts();
    };
  }, []);

  const fetchClinicAllocations = async (clinic: Clinic) => {
    setSelectedClinic(clinic);
    
    try {
      // Fetch all master invoices to gather allocations for this clinic
      const invSnap = await getDocs(collection(db, "masterInvoices"));
      const invoices = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as MasterInvoice));
      
      const results: any[] = [];
  
      for (const inv of invoices) {
        if (!inv.allocations) continue;
  
        const clinicAlloc = inv.allocations.find(a => a.clinicId === clinic.id);
        if (clinicAlloc) {
          clinicAlloc.itemAllocations.forEach((ia, idx) => {
            if (ia.quantity > 0) {
              const masterItem = inv.items.find(mi => mi.productId === ia.productId);
              results.push({
                id: `${inv.id}-${clinic.id}-${idx}`,
                invoice: inv,
                productName: masterItem?.productName || "不明な製品",
                productId: ia.productId,
                quantity: ia.quantity,
                unitPrice: masterItem?.unitPrice || 0
              });
            }
          });
        }
      }
      setAllocations(results);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "masterInvoices");
    }
  };

  const filteredClinics = clinics.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif tracking-tight text-stone-800">クリニック別精算書</h1>
          <p className="text-stone-500 mt-1">クリニック別の分配履歴と精算概要を表示します。</p>
        </div>
      </div>

      {!selectedClinic ? (
        <div className="space-y-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-stone-400 group-focus-within:text-stone-800 transition-colors" />
            </div>
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-4 focus:ring-stone-800/5 transition-all text-sm placeholder:text-stone-300 font-serif italic"
              placeholder="精算書を表示するクリニックを検索..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClinics.map(c => (
              <button 
                key={c.id}
                onClick={() => fetchClinicAllocations(c)}
                className="group bg-white p-6 rounded-[24px] border border-stone-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden text-left"
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center border border-stone-100 group-hover:border-stone-200 transition-colors">
                    <Hospital className="w-6 h-6 text-stone-400 group-hover:text-stone-800" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-stone-800">{c.name}</h3>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{c.contactPerson || "担当者未設定"}</p>
                  </div>
                </div>
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all text-stone-300">
                   <ChevronRight className="w-5 h-5" />
                </div>
                <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-stone-50 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
              </button>
            ))}
            {filteredClinics.length === 0 && (
              <div className="col-span-full py-20 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
                <p className="text-xl font-serif text-stone-400 italic">クリニックが見つかりません。</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] border border-stone-200 shadow-xl overflow-hidden"
        >
          <div className="p-12 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center justify-between gap-8 relative overflow-hidden">
            <div className="relative z-10 flex items-center gap-8">
              <button onClick={() => setSelectedClinic(null)} className="p-4 bg-white hover:bg-stone-100 rounded-full shadow-sm text-stone-400 transition-all">
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
              <div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" /> 認証済・分配記録
                </div>
                <h2 className="text-5xl font-serif text-stone-800 mb-2">{selectedClinic.name}</h2>
                <p className="text-stone-400 font-medium italic">{selectedClinic.contactPerson} &bull; {selectedClinic.address}</p>
              </div>
            </div>
            <div className="text-right relative z-10">
              <p className="text-[10px] font-bold uppercase text-stone-400 tracking-widest mb-2">精算合計額</p>
              <h3 className="text-4xl font-black text-stone-900 leading-none">
                {formatCurrency(allocations.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0))}
              </h3>
            </div>
            <div className="absolute right-12 top-0 text-stone-100 -translate-y-1/2">
                <Hospital className="w-64 h-64 opacity-20" />
            </div>
          </div>

          <div className="p-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100">
                    <th className="pb-6">日付 / 請求書</th>
                    <th className="pb-6">製品</th>
                    <th className="pb-6 text-right">数量</th>
                    <th className="pb-6 text-right">単価</th>
                    <th className="pb-6 text-right">小計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {allocations.map(a => (
                    <tr key={a.id} className="group hover:bg-stone-50/50 transition-colors">
                      <td className="py-8">
                         <div className="text-stone-400 text-[10px] font-mono leading-none mb-1">{new Date(a.invoice.createdAt).toLocaleDateString()}</div>
                         <div className="text-stone-800 font-bold text-sm tracking-tight">{a.invoice.title}</div>
                      </td>
                      <td className="py-8">
                         <div className="text-stone-800 font-serif text-lg">{a.productName}</div>
                         <div className="text-[10px] text-stone-400 font-mono tracking-tighter uppercase">{a.invoice.masterClinicName}</div>
                      </td>
                      <td className="py-8 text-right font-serif text-xl text-stone-800">{a.quantity}</td>
                      <td className="py-8 text-right font-mono text-sm text-stone-400">{formatCurrency(a.unitPrice)}</td>
                      <td className="py-8 text-right font-black text-stone-900 border-l border-stone-50 pl-6">
                        {formatCurrency(a.quantity * a.unitPrice)}
                      </td>
                    </tr>
                  ))}
                  {allocations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                         <p className="text-xl font-serif text-stone-400 italic">このクリニックの分配履歴はありません。</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="px-12 py-8 bg-stone-800 text-stone-400 text-[10px] font-mono uppercase tracking-[0.2em] flex justify-between">
             <span>MediDistribute レポート</span>
             <span>作成日: {new Date().toLocaleDateString()}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
