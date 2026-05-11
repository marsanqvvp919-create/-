import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, writeBatch, updateDoc } from "firebase/firestore";
import { Product } from "../types";
import { logAction, handleFirestoreError, OperationType } from "../lib/audit";
import { Plus, Package, Trash2, Search, Loader2, Upload, X, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [formData, setFormData] = useState({ name: "", origin: "", category: "", minPrice: "", maxPrice: "" });
  const [editData, setEditData] = useState({ minPrice: "", maxPrice: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, "products"));
    return onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.GET, "products"));
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setEditData({
        minPrice: editingProduct.minPrice?.toString() || "0",
        maxPrice: editingProduct.maxPrice?.toString() || "0"
      });
    }
  }, [editingProduct]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const docRef = doc(db, "products", editingProduct.id);
      await updateDoc(docRef, {
        minPrice: Number(editData.minPrice),
        maxPrice: Number(editData.maxPrice),
      });
      await logAction({
        action: "update",
        entityType: "product",
        entityId: editingProduct.id,
        entityName: editingProduct.name,
        details: `Prices updated: min=${editData.minPrice}, max=${editData.maxPrice}`
      });
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${editingProduct.id}`);
    }
  };

  const handleFirestoreErrorLocal = (error: unknown, operation: OperationType | string, path: string) => {
    handleFirestoreError(error, operation, path);
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      complete: async (results) => {
        const data = results.data as string[][];
        // ユーザーの指定: A:ID, B:製剤名, C:下限金額, D:上限金額
        const itemsToImport = data.filter(row => row.length >= 4 && !isNaN(Number(row[0]?.toString().trim())))
          .map(row => ({
            name: row[1]?.toString().trim(),
            minPrice: Number(row[2]?.toString().replace(/[^0-9]/g, "")) || 0,
            maxPrice: Number(row[3]?.toString().replace(/[^0-9]/g, "")) || 0,
          }))
          .filter(item => item.name);

        if (itemsToImport.length === 0) {
          alert("有効なデータが見つかりませんでした。CSVの形式(A:ID, B:名称, C:下限, D:上限)を確認してください。");
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
          const newDocRef = doc(collection(db, "products"));
          batch.set(newDocRef, {
            name: item.name,
            minPrice: item.minPrice,
            maxPrice: item.maxPrice,
            origin: "CSV Import",
            category: "Medical",
            isActive: true,
            createdAt: new Date().toISOString()
          });
        }
        
        await batch.commit();
        setImportProgress(prev => ({ ...prev, current: Math.min(i + batchSize, itemsToImport.length) }));
      }
      await logAction({
        action: "import",
        entityType: "product",
        entityId: "multiple",
        details: `Imported ${itemsToImport.length} products from CSV`
      });
      alert(`${itemsToImport.length}件のインポートが完了しました。`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "products");
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

  const handleImportMaster = async () => {
    if (!confirm("商品マスタをインポートしますか？既に登録されている商品と重複する可能性があります。")) return;
    
    setIsImporting(true);
    const masterData = [
      { n: "Nabota 100u", min: 4224, max: 5797 },
      { n: "Nabota 200u", min: 5676, max: 7392 },
      { n: "Botulax 100u", min: 4488, max: 5082 },
      { n: "Botulax 200u", min: 5544, max: 6930 },
      { n: "Botulax 300u", min: 5940, max: 7744 },
      { n: "Wondertox 100u", min: 2717, max: 3553 },
      { n: "Wondertox 200u", min: 4147, max: 5423 },
      { n: "Meditoxin 200u", min: 5775, max: 7392 },
      { n: "Liztox 100u", min: 2783, max: 3630 },
      { n: "Liztox 200u", min: 4048, max: 5280 },
      { n: "Hutox 100u", min: 2376, max: 2574 },
      { n: "Hitox 100u", min: 2277, max: 2970 },
      { n: "Coretox 100u", min: 5280, max: 6864 },
      { n: "Botox 50u (Allergan)", min: 15180, max: 15730 },
      { n: "Coretox 100u", min: 5280, max: 6864 },
      { n: "REJURAN", min: 28800, max: 31200 },
      { n: "REJURAN S", min: 9000, max: 9750 },
      { n: "REJURAN i", min: 9000, max: 9750 },
      { n: "JUVELOOK", min: 19140, max: 19700 },
      { n: "JUVELOOK VOLUME", min: 19800, max: 21450 },
      { n: "Saxenda", min: 10120, max: 13200 },
      { n: "Saxenda (GLP-1)", min: 10120, max: 13200 },
      { n: "Saxenda (GLP-1)", min: 10120, max: 13200 },
      { n: "Cernos Gel 1%", min: 3915, max: 4019 },
      { n: "Juvederm Volite(SKINVIVE)", min: 24500, max: 29000 },
      { n: "Juvederm Volbella", min: 27000, max: 29000 },
      { n: "Juvederm Vollift", min: 27000, max: 29000 },
      { n: "Juvederm Volume", min: 27000, max: 29000 },
      { n: "Juvederm Volux", min: 27000, max: 29000 },
      { n: "Restylane Skinboosters Vital", min: 17160, max: 18590 },
      { n: "Restylane Lidocaine", min: 17160, max: 18590 },
      { n: "Restylane Lyft", min: 17160, max: 18590 },
      { n: "Restylane Refyne", min: 14520, max: 15730 },
      { n: "Restylane Defyne", min: 14520, max: 15730 },
      { n: "Restylane Kysse", min: 14520, max: 15730 },
      { n: "Neuramis Deep (Lido)", min: 2820, max: 3666 },
      { n: "Neuramis light (Lido)", min: 2580, max: 3354 },
      { n: "PRX-T33(マッサージピール)", min: 27800, max: 33500 },
      { n: "LHALA PEEL", min: 32341, max: 35036 },
      { n: "PROFHILO", min: 14000, max: 17800 },
      { n: "PROFHILO STRUCTURA", min: 26563, max: 28777 },
      { n: "ASCE+ SRLV", min: 66000, max: 71500 },
      { n: "ASCE+ HRLV", min: 90420, max: 97955 },
      { n: "JALUPRO CLASSIC", min: 11667, max: 12640 },
      { n: "JALUPRO SUPER HYDRO", min: 12400, max: 14400 },
      { n: "CINDELLA HEALER", min: 18094, max: 19591 },
      { n: "Liporase Inj", min: 3300, max: 3960 },
      { n: "Kabelline", min: 5693, max: 7425 },
      { n: "LEMON BOTTLE", min: 15642, max: 16945 },
      { n: "Vitten PN", min: 5280, max: 6600 },
      { n: "Dermalax Plus", min: 3300, max: 4125 },
      { n: "Monalisa soft", min: 3300, max: 4125 }
    ];

    setImportProgress({ current: 0, total: masterData.length });

    try {
      // 50件ずつのバッチ処理
      const batchSize = 50;
      for (let i = 0; i < masterData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = masterData.slice(i, i + batchSize);
        
        for (const item of chunk) {
          const newDocRef = doc(collection(db, "products"));
          batch.set(newDocRef, {
            name: item.n,
            minPrice: item.min,
            maxPrice: item.max,
            origin: "Master Data",
            category: "Medical",
            isActive: true,
            createdAt: new Date().toISOString()
          });
        }
        
        await batch.commit();
        setImportProgress(prev => ({ ...prev, current: Math.min(i + batchSize, masterData.length) }));
      }
      
      await logAction({
        action: "import",
        entityType: "product",
        entityId: "multiple",
        details: `Imported ${masterData.length} products from system master template`
      });

      alert("全項目のインポートが完了しました。");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "products");
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "products"), {
        name: formData.name,
        origin: formData.origin,
        category: formData.category,
        minPrice: Number(formData.minPrice) || 0,
        maxPrice: Number(formData.maxPrice) || 0,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      await logAction({
        action: "create",
        entityType: "product",
        entityId: docRef.id,
        entityName: formData.name
      });
      setFormData({ name: "", origin: "", category: "", minPrice: "", maxPrice: "" });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "products");
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-serif tracking-tight text-stone-800">製品管理</h1>
          <p className="text-stone-500 mt-1">製品ラインナップと基本情報を管理します。</p>
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
            disabled={isImporting}
            onClick={handleImportMaster}
            className="flex items-center justify-center gap-2 bg-stone-100 text-stone-600 px-6 py-3 rounded-full hover:bg-stone-200 transition-all font-bold text-xs uppercase tracking-widest relative overflow-hidden"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                <span className="relative z-10">
                  {importProgress.current} / {importProgress.total}
                </span>
                <motion.div 
                  className="absolute inset-0 bg-stone-200 opacity-30 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: importProgress.current / importProgress.total }}
                  transition={{ duration: 0.3 }}
                />
              </>
            ) : "マスタ一括登録"}
          </button>
          <button 
            disabled={isImporting}
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center justify-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-full hover:bg-stone-700 transition-all font-bold text-xs uppercase tracking-widest shadow-lg"
          >
            <Plus className="w-5 h-5" /> 薬品を追加
          </button>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-stone-400 group-focus-within:text-stone-800 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="製品名やカテゴリーで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-4 focus:ring-stone-800/5 transition-all text-sm placeholder:text-stone-300 font-serif italic"
        />
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-xl"
          >
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">名称</label>
                <input 
                  required
                  placeholder="例: ボトックスビスタ"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-800/10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">原産国/メーカー</label>
                <input 
                  required
                  placeholder="例: 韓国・アラガン"
                  value={formData.origin}
                  onChange={e => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-800/10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">カテゴリー</label>
                <input 
                  placeholder="例: 注射剤"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-800/10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">最低価格</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={formData.minPrice}
                  onChange={e => setFormData({ ...formData, minPrice: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-800/10 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">最高価格</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={formData.maxPrice}
                  onChange={e => setFormData({ ...formData, maxPrice: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-800/10 text-sm"
                />
              </div>
              <div className="md:col-span-3 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-3 rounded-xl hover:bg-stone-100 font-bold text-xs uppercase tracking-widest transition-all">キャンセル</button>
                <button type="submit" className="bg-stone-800 text-white px-10 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-stone-700 transition-all">製品を登録</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p) => (
          <motion.div
            key={p.id}
            layout
            onClick={() => setEditingProduct(p)}
            className="group bg-white p-6 rounded-[24px] border border-stone-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer"
          >
            <div className="flex items-start justify-between relative z-10">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 group-hover:border-stone-200 transition-colors">
                <Package className="w-6 h-6 text-stone-400 group-hover:text-stone-800" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <AnimatePresence mode="wait">
                  {confirmingDeleteId === p.id ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await deleteDoc(doc(db, "products", p.id));
                            await logAction({
                              action: "delete",
                              entityType: "product",
                              entityId: p.id,
                              entityName: p.name
                            });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, `products/${p.id}`);
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
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        setConfirmingDeleteId(p.id);
                      }}
                      className="p-2 text-stone-400 hover:text-rose-500 transition-colors"
                      aria-label="Delete formulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            <div className="mt-6 relative z-10">
              <h3 className="text-lg font-serif text-stone-800 leading-tight mb-1">{p.name}</h3>
              <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-4">
                <span>{p.origin}</span>
                {p.category && (
                  <>
                    <span className="w-1 h-1 bg-stone-200 rounded-full" />
                    <span>{p.category}</span>
                  </>
                )}
              </div>

              {(p.minPrice || p.maxPrice) && (
                <div className="pt-4 border-t border-stone-50 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-stone-400 uppercase tracking-tighter">Price Range</span>
                  <span className="text-stone-600 font-bold">
                    {p.minPrice?.toLocaleString()} 〜 {p.maxPrice?.toLocaleString()} 円
                  </span>
                </div>
              )}
            </div>
            
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-stone-50 rounded-full group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
            <Package className="w-12 h-12 text-stone-200 mx-auto mb-4" />
            <p className="text-xl font-serif text-stone-400 italic">製品が見つかりません。</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-start justify-between mb-8">
                  <div className="p-4 bg-stone-50 rounded-3xl">
                    <Package className="w-8 h-8 text-stone-800" />
                  </div>
                  <button 
                    onClick={() => setEditingProduct(null)}
                    className="p-2 hover:bg-stone-50 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>

                <div className="mb-10">
                  <h2 className="text-3xl font-serif text-stone-800 mb-2">{editingProduct.name}</h2>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                    <span>{editingProduct.origin}</span>
                    <span className="w-1 h-1 bg-stone-200 rounded-full" />
                    <span>{editingProduct.category}</span>
                  </div>
                </div>

                <form onSubmit={handleUpdate} className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">下限販売単価 (円)</label>
                      <input 
                        required
                        type="number"
                        value={editData.minPrice}
                        onChange={e => setEditData({ ...editData, minPrice: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg font-mono transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-stone-400 tracking-widest pl-1">上限販売単価 (円)</label>
                      <input 
                        required
                        type="number"
                        value={editData.maxPrice}
                        onChange={e => setEditData({ ...editData, maxPrice: e.target.value })}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-stone-800/5 text-lg font-mono transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setEditingProduct(null)}
                      className="flex-1 px-8 py-4 rounded-2xl hover:bg-stone-100 font-bold text-xs uppercase tracking-widest transition-all text-stone-500"
                    >
                      キャンセル
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-stone-800 text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:bg-stone-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> 価格を保存
                    </button>
                  </div>
                </form>
              </div>
              
              <div className="bg-stone-50 p-6 border-t border-stone-100 text-center">
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">MediDistribute Catalog Management</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
