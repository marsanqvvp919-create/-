import React, { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { InvoiceSettings } from "../types";
import { Settings, Save, Loader2, Info, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { handleFirestoreError, OperationType, logAction } from "../lib/audit";
import { cn } from "../lib/utils";

const DEFAULT_SETTINGS: InvoiceSettings = {
  companyName: "MediDistribute 管理本部",
  companyAddress: "〒100-0001 東京都千代田区千代田1-1",
  bankInfo: "○○銀行 □□支店 普通 1234567\nメディディストリビュート 宛",
  taxRate: 0,
  footerNote: "ご不明な点がございましたら、管理本部までお問い合わせください。",
  showMasterSummary: true
};

export function SettingsManager() {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<InvoiceSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "invoice"), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as InvoiceSettings;
        setSettings(data);
        setFormData(data);
      } else {
        setSettings(DEFAULT_SETTINGS);
        setFormData(DEFAULT_SETTINGS);
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, "settings/invoice"));

    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Create a copy and remove any undefined values to avoid Firestore errors
      const dataToSave = { ...formData };
      if (dataToSave.companySealUrl === undefined) {
        delete dataToSave.companySealUrl;
      }
      if (dataToSave.companyLogoUrl === undefined) {
        delete dataToSave.companyLogoUrl;
      }
      if (dataToSave.bankAccountHolder === undefined) delete dataToSave.bankAccountHolder;
      if (dataToSave.bankAccountNumber === undefined) delete dataToSave.bankAccountNumber;
      if (dataToSave.bankAccountType === undefined) delete dataToSave.bankAccountType;
      if (dataToSave.bankBranch === undefined) delete dataToSave.bankBranch;
      if (dataToSave.bankName === undefined) delete dataToSave.bankName;
      if (dataToSave.companyTel === undefined) delete dataToSave.companyTel;
      if (dataToSave.companyEmail === undefined) delete dataToSave.companyEmail;
      
      await setDoc(doc(db, "settings", "invoice"), dataToSave);
      await logAction({
        action: "update",
        entityType: "settings",
        entityId: "invoice",
        entityName: "Invoice Settings",
        details: `Settings updated by ${auth.currentUser?.email}`
      });
      alert("設定を保存しました。");
    } catch (error: any) {
      console.error("Save error:", error);
      alert("設定の保存に失敗しました。権限または入力内容を確認してください。");
      handleFirestoreError(error, OperationType.WRITE, "settings/invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-stone-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-800">請求書設定</h1>
          <p className="text-stone-500 text-sm mt-1">PDF請求書に表示される情報を管理します。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSave}
            className="bg-white border border-stone-200 rounded-[32px] p-8 shadow-sm space-y-6"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">発行元名称</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  placeholder="例: MediDistribute 管理本部"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">住所・連絡先</label>
                <textarea
                  value={formData.companyAddress}
                  onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all h-24"
                  placeholder="例: 〒100-0001 東京都..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">振込先情報</label>
                <textarea
                  value={formData.bankInfo}
                  onChange={(e) => setFormData({ ...formData, bankInfo: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all h-24"
                  placeholder="銀行名、支店名、口座番号、名義など"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">消費税率 (%)</label>
                  <input
                    type="number"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-3 cursor-pointer group mt-6">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.showMasterSummary}
                        onChange={(e) => setFormData({ ...formData, showMasterSummary: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={cn(
                        "w-10 h-6 rounded-full transition-colors",
                        formData.showMasterSummary ? "bg-stone-900" : "bg-stone-200"
                      )} />
                      <div className={cn(
                        "absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform",
                        formData.showMasterSummary ? "translate-x-4" : ""
                      )} />
                    </div>
                    <span className="text-sm font-medium text-stone-700">注文集計表を1ページ目に含める</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">備考・フッター注釈</label>
                <input
                  type="text"
                  value={formData.footerNote}
                  onChange={(e) => setFormData({ ...formData, footerNote: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">会社ロゴ (Logo)</label>
                  <div className="flex items-start gap-4">
                    {formData.companyLogoUrl ? (
                      <div className="relative group">
                        <img 
                          src={formData.companyLogoUrl} 
                          alt="Company Logo" 
                          className="w-24 h-24 object-contain border border-stone-200 rounded-xl p-2 bg-stone-50"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, companyLogoUrl: undefined })}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-all text-stone-400">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold">UPLOAD</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFormData({ ...formData, companyLogoUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                    <div className="flex-1 text-[10px] text-stone-400 leading-relaxed mt-1">
                      <p>&bull; 会社のブランドロゴをアップロードします。</p>
                      <p>&bull; 請求書の左上に配置されます。</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">社判 (Company Seal)</label>
                  <div className="flex items-start gap-4">
                    {formData.companySealUrl ? (
                      <div className="relative group">
                        <img 
                          src={formData.companySealUrl} 
                          alt="Company Seal" 
                          className="w-24 h-24 object-contain border border-stone-200 rounded-xl p-2 bg-stone-50"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, companySealUrl: undefined })}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-all text-stone-400">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold">UPLOAD</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setFormData({ ...formData, companySealUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                    <div className="flex-1 text-[10px] text-stone-400 leading-relaxed mt-1">
                      <p>&bull; 透明背景のPNG形式推奨。</p>
                      <p>&bull; 発行元情報の右側に重なるように配置されます。</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-stone-100">
                <h4 className="text-xs font-bold uppercase tracking-widest text-stone-600 mb-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-400"></div>
                  振込先情報 (Bank Account)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">銀行名</label>
                    <input 
                      type="text" 
                      value={formData.bankName || ""} 
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="例：モノリス銀行"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">支店名</label>
                    <input 
                      type="text" 
                      value={formData.bankBranch || ""} 
                      onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                      placeholder="例：恵比寿支店"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">口座種別</label>
                    <input 
                      type="text" 
                      value={formData.bankAccountType || ""} 
                      onChange={(e) => setFormData({ ...formData, bankAccountType: e.target.value })}
                      placeholder="例：普通"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">口座番号</label>
                    <input 
                      type="text" 
                      value={formData.bankAccountNumber || ""} 
                      onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                      placeholder="例：1234567"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">口座名義 (カナ)</label>
                    <input 
                      type="text" 
                      value={formData.bankAccountHolder || ""} 
                      onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                      placeholder="例：ゴウドウガイシャナンバーワン"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">電話番号</label>
                    <input 
                      type="text" 
                      value={formData.companyTel || ""} 
                      onChange={(e) => setFormData({ ...formData, companyTel: e.target.value })}
                      placeholder="例：03-1234-5678"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">メールアドレス</label>
                    <input 
                      type="text" 
                      value={formData.companyEmail || ""} 
                      onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                      placeholder="例：info@example.com"
                      className="w-full bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-stone-800/10 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                設定を保存する
              </button>
            </div>
          </motion.form>
        </div>

        <div className="space-y-6">
          <div className="bg-stone-100 rounded-3xl p-6 border border-stone-200">
            <div className="flex items-center gap-2 mb-4 text-stone-800">
              <Info className="w-5 h-5" />
              <h3 className="font-bold">設定の反映について</h3>
            </div>
            <ul className="text-xs text-stone-500 space-y-3 leading-relaxed">
              <li>&bull; ここで設定した情報は、新しく生成されるPDF請求書にのみ適用されます。</li>
              <li>&bull; 消費税率は、各項目の金額に加算されます。（現在は内税表示がメインですが、将来的な機能拡張に対応します）</li>
              <li>&bull; 「注文集計表」オプションを無効にすると、即座に各クリニックの分配明細ページからPDFが始まります。</li>
            </ul>
          </div>

          <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-4">プレビュー表示</h3>
            <div className="space-y-4">
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-[10px]">
                <p className="font-serif italic mb-2">発行元情報</p>
                <p className="font-bold">{formData.companyName}</p>
                <p className="opacity-60">{formData.companyAddress}</p>
              </div>
              
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-[10px]">
                <p className="font-serif italic mb-2">お振込先</p>
                <p className="whitespace-pre-line leading-relaxed">{formData.bankInfo || "未設定"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
