import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, writeBatch, updateDoc } from "firebase/firestore";
import { Clinic } from "../types";
import { logAction, handleFirestoreError, OperationType } from "../lib/audit";
import { Plus, Building2, Trash2, Search, Upload, Loader2, Pencil, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";

export function ClinicManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [formData, setFormData] = useState({ name: "", contactPerson: "", address: "", isMaster: false, parentMasterId: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "clinics"));
    return onSnapshot(q, (snapshot) => {
      setClinics(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Clinic)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "clinics"));
  }, []);

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      complete: async (results) => {
        const data = results.data as string[][];
        // A列: ID, B列: クリニック名, C列: 営業担当者, D列: クリニック住所
        const itemsToImport = data.filter(row => row.length >= 2 && row[1]?.toString().trim())
          .map(row => ({
            name: row[1]?.toString().trim(),
            contactPerson: row[2]?.toString().trim() || "",
            address: row[3]?.toString().trim() || "",
          }));

        if (itemsToImport.length === 0) {
          alert("有効なデータが見つかりませんでした。CSVの形式(A:ID, B:クリニック名, C:担当者, D:住所)を確認してください。");
          setIsImporting(false);
          return;
        }

        setImportProgress({ current: 0, total: itemsToImport.length });

        try {
          const batchSize = 50;
          for (let i = 0; i < itemsToImport.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = itemsToImport.slice(i, i + batchSize);
            
            for (const item of chunk) {
              const newDocRef = doc(collection(db, "clinics"));
              batch.set(newDocRef, {
                name: item.name,
                contactPerson: item.contactPerson,
                address: item.address,
                createdAt: new Date().toISOString()
              });
            }
            
            await batch.commit();
            setImportProgress(prev => ({ ...prev, current: Math.min(i + batchSize, itemsToImport.length) }));
          }
          await logAction({
            action: "import",
            entityType: "clinic",
            entityId: "multiple",
            details: `Imported ${itemsToImport.length} clinics from CSV`
          });
          alert(`${itemsToImport.length}件のインポートが完了しました。`);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, "clinics");
        } finally {
          setIsImporting(false);
          setImportProgress({ current: 0, total: 0 });
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert("CSVの読み込みに失敗しました。");
        setIsImporting(false);
      }
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClinicId) {
        await updateDoc(doc(db, "clinics", editingClinicId), {
          ...formData,
        });
        await logAction({
          action: "update",
          entityType: "clinic",
          entityId: editingClinicId,
          entityName: formData.name
        });
      } else {
        const docRef = await addDoc(collection(db, "clinics"), {
          ...formData,
          createdAt: new Date().toISOString()
        });
        await logAction({
          action: "create",
          entityType: "clinic",
          entityId: docRef.id,
          entityName: formData.name
        });
      }
      setFormData({ name: "", contactPerson: "", address: "", isMaster: false, parentMasterId: "" });
      setIsAdding(false);
      setEditingClinicId(null);
    } catch (error) {
      handleFirestoreError(error, editingClinicId ? OperationType.UPDATE : OperationType.CREATE, "clinics");
    }
  };

  const startEdit = (clinic: Clinic) => {
    setFormData({
      name: clinic.name,
      contactPerson: clinic.contactPerson || "",
      address: clinic.address || "",
      isMaster: !!clinic.isMaster,
      parentMasterId: clinic.parentMasterId || ""
    });
    setEditingClinicId(clinic.id);
    setIsAdding(true);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setEditingClinicId(null);
    setFormData({ name: "", contactPerson: "", address: "", isMaster: false, parentMasterId: "" });
  };

  const filtered = clinics.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif tracking-tight text-stone-800">提携クリニック</h1>
          <p className="text-stone-500 mt-1">請求照合の分配先となるクリニックを管理します。</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef}
            onChange={handleCsvUpload}
            className="hidden" 
          />
          <button 
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-stone-100 text-stone-600 px-6 py-3 rounded-full hover:bg-stone-200 transition-all font-bold text-xs uppercase tracking-widest"
          >
            <Upload className="w-4 h-4" /> CSVインポート
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-full hover:bg-stone-700 transition-all font-bold text-xs uppercase tracking-widest shadow-lg"
          >
            <Plus className="w-5 h-5" /> クリニックを追加
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isImporting && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-stone-900 text-white p-6 rounded-[32px] mb-8 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                <span className="text-sm font-bold uppercase tracking-widest">インポート中...</span>
              </div>
              <span className="text-xs font-mono text-stone-400">
                {importProgress.current} / {importProgress.total}
              </span>
            </div>
            <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-stone-400 group-focus-within:text-stone-800 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="クリニック名や地域で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-4 focus:ring-stone-800/5 transition-all text-sm placeholder:text-stone-300 font-serif italic"
        />
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelAdd}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl p-10 rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-serif text-stone-800">
                  {editingClinicId ? "提携先の編集" : "新規提携先の登録"}
                </h2>
                <button 
                  onClick={cancelAdd}
                  className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-400"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">店舗名</label>
                    <input 
                      required
                      placeholder="例: 東京・表参道院"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">担当者</label>
                    <input 
                      placeholder="お名前"
                      value={formData.contactPerson}
                      onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">住所 / 地域</label>
                  <input 
                    placeholder="市区町村など"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">区分設定</label>
                    <div className="flex items-center gap-4 py-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={formData.isMaster}
                          onChange={e => setFormData({ ...formData, isMaster: e.target.checked, parentMasterId: e.target.checked ? "" : formData.parentMasterId })}
                          className="w-5 h-5 rounded border-stone-300 text-stone-800 focus:ring-stone-800/10"
                        />
                        <span className="text-sm font-bold text-stone-600">総称（マスター）として登録</span>
                      </label>
                    </div>
                  </div>
                  
                  {!formData.isMaster && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">所属する総称（マスター）</label>
                      <select 
                        value={formData.parentMasterId}
                        onChange={e => setFormData({ ...formData, parentMasterId: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg appearance-none"
                      >
                        <option value="">所属なし</option>
                        {clinics.filter(c => c.isMaster && c.id !== editingClinicId).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-10">
                  <button type="button" onClick={cancelAdd} className="px-10 py-5 rounded-2xl hover:bg-stone-50 font-bold text-xs uppercase tracking-widest transition-all">キャンセル</button>
                  <button type="submit" className="bg-stone-800 text-white px-12 py-5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl hover:bg-stone-700 transition-all">
                    {editingClinicId ? "変更を保存する" : "新しく登録する"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((c) => (
          <motion.div
            key={c.id}
            layout
            className="group bg-white p-6 rounded-[24px] border border-stone-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="flex items-start justify-between relative z-10">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 group-hover:border-stone-200 transition-colors">
                <Building2 className="w-6 h-6 text-stone-400 group-hover:text-stone-800" />
              </div>
              <div className="flex items-center gap-1">
                <AnimatePresence mode="wait">
                  {confirmingDeleteId === c.id ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2 bg-rose-50 p-1 rounded-xl border border-rose-100"
                    >
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await deleteDoc(doc(db, "clinics", c.id));
                            await logAction({
                              action: "delete",
                              entityType: "clinic",
                              entityId: c.id,
                              entityName: c.name
                            });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, `clinics/${c.id}`);
                          }
                          setConfirmingDeleteId(null);
                        }}
                        className="px-3 py-1.5 bg-rose-500 text-white text-[10px] font-black uppercase tracking-tighter rounded-lg hover:bg-rose-600 transition-colors"
                      >
                        はい (Y)
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(null);
                        }}
                        className="px-3 py-1.5 bg-white text-stone-400 text-[10px] font-black uppercase tracking-tighter rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
                      >
                        いいえ (N)
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          startEdit(c);
                        }}
                        className="p-3 text-stone-400 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-all"
                        aria-label="Edit clinic"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setConfirmingDeleteId(c.id);
                        }}
                        className="p-3 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        aria-label="Delete clinic"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="mt-6 relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-serif text-stone-800 leading-tight">{c.name}</h3>
                {c.isMaster && (
                  <span className="bg-stone-800 text-white text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded leading-none">MASTER</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                  <span>{c.contactPerson || "担当者未設定"}</span>
                  {c.address && (
                    <>
                      <span className="w-1 h-1 bg-stone-200 rounded-full" />
                      <span className="truncate max-w-[120px]">{c.address}</span>
                    </>
                  )}
                </div>
                {c.parentMasterId && (
                  <div className="text-[9px] text-stone-500 font-serif italic">
                    所属: {clinics.find(mc => mc.id === c.parentMasterId)?.name || "不明なマスター"}
                  </div>
                )}
              </div>
            </div>
            
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-stone-50 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
            <Building2 className="w-12 h-12 text-stone-200 mx-auto mb-4" />
            <p className="text-xl font-serif text-stone-400 italic">提携クリニックが登録されていません。</p>
          </div>
        )}
      </div>
    </div>
  );
}
