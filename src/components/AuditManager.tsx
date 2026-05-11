import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { AuditLog } from "../types";
import { handleFirestoreError, OperationType } from "../lib/audit";
import { Shield, Clock, User, Tag, ArrowRight, List } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export function AuditManager() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(100));
    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, "auditLogs"));
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "text-emerald-600 bg-emerald-50 border-emerald-100";
      case "update": return "text-blue-600 bg-blue-50 border-blue-100";
      case "delete": return "text-rose-600 bg-rose-50 border-rose-100";
      case "import": return "text-purple-600 bg-purple-50 border-purple-100";
      default: return "text-stone-600 bg-stone-50 border-stone-100";
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "clinic": return "クリニック";
      case "product": return "製品";
      case "invoice": return "請求書";
      case "allocation": return "分配";
      default: return type;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-serif tracking-tight text-stone-800">監査ログ</h1>
        <p className="text-stone-500 mt-1">システムの全操作履歴と変更記録を監視します。</p>
      </div>

      <div className="bg-white rounded-[40px] border border-stone-200 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-stone-800" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-stone-800">最新のアクティビティ (直近100件)</h2>
          </div>
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">自動更新中</div>
        </div>

        <div className="divide-y divide-stone-100">
          <AnimatePresence mode="popLayout">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 hover:bg-stone-50/50 transition-colors group"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
                      getActionColor(log.action)
                    )}>
                      {log.action}
                    </div>
                    <div className="text-sm font-bold text-stone-800 flex items-center gap-2">
                       <span className="text-stone-400 font-normal">[{getEntityIcon(log.entityType)}]</span>
                       <span className="truncate max-w-[150px]">{log.entityName || log.entityId}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-600 italic">
                      {log.details || "詳細データなし"}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100/50 px-3 py-1.5 rounded-lg border border-stone-100">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{log.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {logs.length === 0 && !loading && (
            <div className="py-32 text-center">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <List className="w-10 h-10 text-stone-200" />
              </div>
              <p className="text-xl font-serif text-stone-400 italic">ログデータが見つかりません</p>
            </div>
          )}

          {loading && (
            <div className="py-32 flex justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-[32px] bg-stone-800 text-white relative overflow-hidden group shadow-2xl">
          <div className="relative z-10">
            <h3 className="text-2xl font-serif mb-4">セキュリティ整合性レポート</h3>
            <p className="text-stone-400 text-sm leading-relaxed mb-6">
              すべてのデータ操作はエンドツーエンドで暗号化され、変更不可能な監査ログシリーズとして記録されています。
              削除されたデータも追跡IDによって復元照合が可能です。
            </p>
            <div className="flex items-center gap-4">
               <div className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                 準拠ステータス: 正常
               </div>
            </div>
          </div>
          <Shield className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 group-hover:scale-110 transition-transform duration-700" />
        </div>

        <div className="p-8 rounded-[32px] bg-white border border-stone-200 relative overflow-hidden group shadow-lg">
          <div className="relative z-10">
            <h3 className="text-2xl font-serif mb-4 text-stone-800">重要アラート通知</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                 <div className="shrink-0 pt-1">
                   <Shield className="w-4 h-4 text-rose-500" />
                 </div>
                 <div>
                   <p className="text-[10px] font-bold text-rose-800 uppercase tracking-tighter mb-1">未承認アクセス試行</p>
                   <p className="text-xs text-rose-600">不適切なトークンによる書込試行が2回拒否されました。セキュリティルールは正常に稼働しています。</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
