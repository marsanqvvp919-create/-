import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, limit, orderBy } from "firebase/firestore";
import { MasterInvoice, Product, Clinic } from "../types";
import { logAction, handleFirestoreError, OperationType } from "../lib/audit";
import { 
  TrendingUp, 
  Package, 
  Hospital, 
  FileText, 
  AlertTriangle, 
  CheckCircle2,
  ArrowUpRight,
  PlusCircle
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

export function Dashboard({ onSelectInvoice, onNavigate }: { onSelectInvoice: (id: string) => void, onNavigate: (view: any) => void }) {
  const [stats, setStats] = useState({ 
    invoices: 0, 
    products: 0, 
    clinics: 0,
    accuracy: 0,
    pending: 0,
    excess: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<MasterInvoice[]>([]);

  useEffect(() => {
    // Helper to check for excess
    const checkExcess = (invoice: MasterInvoice) => {
      if (!invoice.items) return false;
      return invoice.items.some(item => {
        const allocated = (invoice.allocations || []).reduce((sum, a) => {
          const ia = a.itemAllocations.find(i => i.productId === item.productId);
          return sum + (ia?.quantity || 0);
        }, 0);
        return allocated > item.quantity;
      });
    };

    // Helper to check if fully reconciled
    const checkReconciled = (invoice: MasterInvoice) => {
      if (!invoice.items || invoice.items.length === 0) return false;
      return invoice.items.every(item => {
        const allocated = (invoice.allocations || []).reduce((sum, a) => {
          const ia = a.itemAllocations.find(i => i.productId === item.productId);
          return sum + (ia?.quantity || 0);
        }, 0);
        return allocated === item.quantity;
      });
    };

    const q = query(collection(db, "masterInvoices"), orderBy("createdAt", "desc"));
    const unsubInvoices = onSnapshot(q, (s) => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() } as MasterInvoice));
      
      const reconciledCount = docs.filter(checkReconciled).length;
      const pendingCount = docs.filter(d => d.status === "pending").length;
      const excessCount = docs.filter(checkExcess).length;
      const accuracy = docs.length > 0 ? (reconciledCount / docs.length) * 100 : 0;

      setStats(prev => ({ 
        ...prev, 
        invoices: s.size,
        accuracy,
        pending: pendingCount,
        excess: excessCount
      }));
      setRecentInvoices(docs.slice(0, 5));
    }, (error) => handleFirestoreError(error, OperationType.GET, "masterInvoices"));

    const unsubProducts = onSnapshot(collection(db, "products"), (s) => 
      setStats(prev => ({ ...prev, products: s.size })),
      (error) => handleFirestoreError(error, OperationType.GET, "products")
    );

    const unsubClinics = onSnapshot(collection(db, "clinics"), (s) => 
      setStats(prev => ({ ...prev, clinics: s.size })),
      (error) => handleFirestoreError(error, OperationType.GET, "clinics")
    );

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubClinics();
    };
  }, []);

  const cards = [
    { label: "有効な請求書", value: stats.invoices, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", unit: "件" },
    { label: "登録商品数", value: stats.products, icon: Package, color: "text-purple-600", bg: "bg-purple-50", unit: "種" },
    { label: "提携クリニック数", value: stats.clinics, icon: Hospital, color: "text-emerald-600", bg: "bg-emerald-50", unit: "拠点" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif tracking-tight text-stone-800">ダッシュボード</h1>
          <p className="text-stone-500 mt-1">照合状況の全体像を表示します。</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-stone-200 shadow-sm text-[10px] font-bold uppercase tracking-widest text-stone-400">
          <TrendingUp className="w-4 h-4 text-stone-800" />
          <span>リアルタイム同期中</span>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group bg-white p-8 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-default"
          >
            <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] mb-4">{card.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-serif text-stone-800">{card.value}</h3>
              <span className="text-xs text-stone-400 font-medium">{card.unit}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-stone-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-serif text-stone-700 flex items-center gap-2">
              最近のマスター請求書
            </h2>
          </div>

          <div className="space-y-3">
            {recentInvoices.map((inv) => (
              <div 
                key={inv.id} 
                onClick={() => onSelectInvoice(inv.id)}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-stone-50 border border-transparent hover:border-stone-800 hover:bg-white transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-stone-200 group-hover:border-stone-400 shrink-0">
                  <FileText className="w-5 h-5 text-stone-400 group-hover:text-stone-800" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-stone-800 truncate">{inv.title}</h4>
                  <p className="text-xs text-stone-400">{inv.masterClinicName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">{new Date(inv.createdAt).toLocaleDateString()}</p>
                  <ArrowUpRight className="ml-auto w-4 h-4 text-stone-300 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              </div>
            ))}
            {recentInvoices.length === 0 && (
              <div className="text-center py-12 text-stone-400 italic font-serif">請求書はまだ登録されていません。</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-stone-800 text-stone-100 rounded-[32px] p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-xl font-serif mb-2">処理ステータス</h2>
              <p className="text-stone-400 text-xs mb-6">各拠点の精算・照合状況</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">照合精度</span>
                  <span className="font-serif text-emerald-400">{stats.accuracy.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">保留項目</span>
                  <span className="font-serif text-amber-400">{stats.pending}</span>
                </div>
              </div>
              
              <button 
                onClick={() => onNavigate("audit")}
                className="w-full mt-6 py-3 bg-stone-100 text-stone-800 rounded-full font-bold text-xs tracking-widest uppercase hover:bg-white transition-all"
              >
                システム監査を表示
              </button>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-stone-600 rounded-full blur-[80px] opacity-20" />
          </div>

          {stats.excess > 0 ? (
            <div className="bg-white border-l-4 border-l-rose-500 border border-stone-200 rounded-[24px] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-stone-800 text-sm">振分超過アラート</h3>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                登録数量を超過している分配が {stats.excess}件 検出されました。個別の請求書ページを確認して入力を修正してください。
              </p>
            </div>
          ) : (
            <div className="bg-white border-l-4 border-l-emerald-500 border border-stone-200 rounded-[24px] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-stone-800 text-sm">システム整合性</h3>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                現在、全クリニックの振分数量はマスター数量内に収まっています。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
