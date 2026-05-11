import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  Package, 
  Hospital, 
  FileText, 
  LogOut, 
  Plus, 
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Menu,
  X,
  PlusCircle,
  BarChart3,
  Trash2,
  Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { auth, signInWithGoogle, logout, db } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  where
} from "firebase/firestore";
import { ViewState, Product, Clinic, MasterInvoice } from "./types";
import { cn, formatCurrency } from "./lib/utils";

// Components
import { ProductManager } from "./components/ProductManager";
import { ClinicManager } from "./components/ClinicManager";
import { InvoiceManager } from "./components/InvoiceManager";
import { InvoiceDetail } from "./components/InvoiceDetail";
import { Dashboard } from "./components/Dashboard";
import { ClinicStatements } from "./components/ClinicStatements";
import { AuditManager } from "./components/AuditManager";
import { SettingsManager } from "./components/SettingsManager";
import { Settings } from "lucide-react";

export default function App() {
  const [user] = useState<any>({ displayName: "Admin", email: "admin@example.com", photoURL: "" });
  const [currentView, setCurrentView] = useState<ViewState>("dashboard");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navigateToInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setCurrentView("invoice-detail");
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard onSelectInvoice={navigateToInvoice} onNavigate={setCurrentView} />;
      case "products":
        return <ProductManager />;
      case "clinics":
        return <ClinicManager />;
      case "invoices":
        return <InvoiceManager onSelectInvoice={navigateToInvoice} />;
      case "invoice-detail":
        return selectedInvoiceId ? (
          <InvoiceDetail 
            invoiceId={selectedInvoiceId} 
            onBack={() => setCurrentView("invoices")} 
          />
        ) : <InvoiceManager onSelectInvoice={navigateToInvoice} />;
      case "clinic-statements":
        return <ClinicStatements />;
      case "audit":
        return <AuditManager />;
      case "settings":
        return <SettingsManager />;
      default:
        return <Dashboard onSelectInvoice={navigateToInvoice} onNavigate={setCurrentView} />;
    }
  };

  const navItems = [
    { id: "dashboard", label: "ダッシュボード", icon: LayoutDashboard },
    { id: "invoices", label: "請求書一覧", icon: FileText },
    { id: "clinic-statements", label: "精算書", icon: BarChart3 },
    { id: "audit", label: "監査ログ", icon: Shield },
    { id: "products", label: "商品管理", icon: Package },
    { id: "clinics", label: "クリニック管理", icon: Hospital },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-brand-sidebar border-r border-stone-200 transition-all duration-300 z-20 sticky top-0 h-screen overflow-y-auto flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="text-white w-6 h-6" />
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-widest text-stone-400 uppercase leading-none mb-1">MediDistribute</div>
                <div className="text-lg font-serif italic text-stone-700 leading-none truncate">請求分配・照合</div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as ViewState)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                currentView === item.id 
                  ? "bg-stone-200 text-stone-900" 
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
            </button>
          ))}
          
          <div className="pt-4 mt-4 border-t border-stone-200/50">
            <button
              onClick={() => setCurrentView("settings")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                currentView === "settings" 
                  ? "bg-stone-200 text-stone-900" 
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              )}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="font-medium text-sm">システム設定</span>}
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-stone-200 shrink-0 text-center">
          {isSidebarOpen && <div className="mt-4 text-[10px] text-stone-400 text-center font-mono uppercase tracking-widest">v1.2.4 (MVP)</div>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden min-h-screen">
        <header className="bg-white border-b border-stone-200 h-16 flex items-center px-8 sticky top-0 z-10 transition-all">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-stone-50 rounded-lg text-stone-400"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView + (selectedInvoiceId || "")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
