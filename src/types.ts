export interface Product {
  id: string;
  name: string;
  origin: string;
  category: string;
  minPrice?: number;
  maxPrice?: number;
  isActive: boolean;
  createdAt: string;
}

export interface Clinic {
  id: string;
  name: string;
  contactPerson?: string;
  salesPerson?: string;
  address?: string;
  notes?: string;
  isMaster?: boolean;
  parentMasterId?: string;
  createdAt: string;
}

export interface MasterInvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Allocation {
  clinicId: string;
  clinicName: string;
  itemAllocations: {
    productId: string;
    quantity: number;
  }[];
  shippingFee?: number;
  handlingFee?: number;
}

export interface MasterInvoice {
  id: string;
  title: string;
  masterClinicId: string; // "総称"としてのクリニック
  masterClinicName: string;
  items: MasterInvoiceItem[];
  shippingFee: number;
  handlingFee: number;
  totalAmount: number;
  allocations: Allocation[];
  status: "pending" | "distributed" | "completed";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: "create" | "update" | "delete" | "import";
  entityType: "clinic" | "product" | "invoice" | "allocation" | "settings";
  entityId: string;
  entityName?: string;
  userId: string;
  userEmail?: string;
  details?: string;
  timestamp: string;
}

export interface InvoiceSettings {
  companyName: string;
  companyAddress: string;
  bankInfo: string;
  taxRate: number;
  footerNote: string;
  showMasterSummary: boolean;
  companySealUrl?: string;
  companyLogoUrl?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountType?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  companyTel?: string;
  companyEmail?: string;
}

export type ViewState = "dashboard" | "products" | "clinics" | "invoices" | "invoice-detail" | "clinic-statements" | "audit" | "settings";
