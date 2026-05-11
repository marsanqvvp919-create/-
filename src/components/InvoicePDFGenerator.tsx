import React from "react";
import { MasterInvoice, Clinic, Allocation, InvoiceSettings } from "../types";
import { formatCurrency } from "../lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface InvoicePDFTemplateProps {
  invoice: MasterInvoice;
  allocation: Allocation;
  clinic: Clinic | undefined;
  masterClinic: Clinic | undefined;
  settings: InvoiceSettings;
}

// PDF safe colors (hex overrides for html2canvas as it doesn't support oklch used by Tailwind 4)
const colors = {
  white: "#ffffff",
  stone800: "#292524",
  stone900: "#1c1917",
  stone700: "#44403c",
  stone600: "#57534e",
  stone500: "#78716c",
  stone400: "#a8a29e",
  stone300: "#d6d3d1",
  stone200: "#e7e5e4",
  stone100: "#f5f5f4",
  stone50: "#fafaf9",
  rose200: "#fecdd3",
  rose300: "#fda4af",
};

export const InvoicePDFTemplate = ({ invoice, allocation, clinic, masterClinic, settings }: InvoicePDFTemplateProps) => {
  const date = new Date(invoice.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subtotal = allocation.itemAllocations.reduce((sum, ia) => {
    const masterItem = invoice.items.find((mi) => mi.productId === ia.productId);
    return sum + ia.quantity * (masterItem?.unitPrice || 0);
  }, 0);

  const allocShipping = allocation.shippingFee || 0;
  const allocHandling = allocation.handlingFee || 0;
  
  const taxRate = settings.taxRate / 100;
  const tax = Math.round((subtotal + allocShipping + allocHandling) * taxRate);
  const totalWithTax = subtotal + allocShipping + allocHandling + tax;
  
  const itemsWithMaster = allocation.itemAllocations
    .filter(ia => ia.quantity > 0)
    .map((ia) => {
      const masterItem = invoice.items.find((mi) => mi.productId === ia.productId);
      return {
        ...ia,
        productName: masterItem?.productName || "不明な製品",
        unitPrice: masterItem?.unitPrice || 0,
        amount: ia.quantity * (masterItem?.unitPrice || 0),
      };
    });

  return (
    <div 
      className="bg-white mx-auto overflow-hidden shadow-2xl invoice-page p-[60px] flex flex-col"
      style={{ 
        width: "210mm", 
        minHeight: "297mm", 
        fontFamily: "'Inter', sans-serif",
        color: "#1a1a1a",
        boxSizing: "border-box"
      }}
    >
      {/* Top Right: Date and No */}
      <div className="absolute top-[10mm] right-[20mm] text-right text-[10pt] space-y-1">
        <p>{date}</p>
        <p>請求番号: {invoice.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Main Title - Centered Top */}
      <div className="text-center mt-12 mb-12">
        <h1 className="text-[24pt] font-bold tracking-[0.5em] inline-block pb-1 border-b-2 border-transparent">請求書</h1>
      </div>

      {/* Parties Section */}
      <div className="flex justify-between items-start mb-10 px-4">
        {/* Recipient */}
        <div className="w-1/2">
          <div className="border-b-2 pb-1 mb-3" style={{ borderBottomColor: colors.stone800 }}>
            <h2 className="text-[16pt] font-bold">{clinic?.name || allocation.clinicName} 御中</h2>
          </div>
          <p className="text-[10pt] mb-6">下記のとおり、ご請求申し上げます。</p>
          
          <div className="flex items-baseline gap-4 border-b-2 pb-1 w-full" style={{ borderBottomColor: colors.stone800 }}>
            <span className="text-[11pt] font-bold">ご請求金額</span>
            <div className="flex items-baseline flex-1 justify-end">
              <span className="text-[12pt] font-bold mr-2">¥</span>
              <span className="text-[18pt] font-bold tracking-tight">{totalWithTax.toLocaleString()}</span>
              <span className="text-[12pt] font-bold ml-1">-</span>
            </div>
          </div>
        </div>

        {/* Sender Info - Right aligned */}
        <div className="w-[85mm] text-left relative flex flex-col items-start pl-4" id="sender-info-alloc">
          {settings.companyLogoUrl && (
            <div className="flex items-center gap-2 mb-2">
              <img 
                src={settings.companyLogoUrl} 
                className="max-w-[195px] h-auto object-contain"
                alt="Logo"
              />
            </div>
          )}
          <div className="text-[9pt] space-y-0.5 leading-tight relative z-10 text-stone-700">
            <p className="font-bold text-[10.5pt] mb-1 text-black">{settings.companyName}</p>
            <p>〒{settings.companyAddress.match(/\d{3}-?\d{4}/)?.[0] || ""}</p>
            <p>{settings.companyAddress.replace(/\d{3}-?\d{4}/, "").replace(/〒/, "").trim()}</p>
            {settings.companyTel && <p>TEL: {settings.companyTel}</p>}
            {settings.companyEmail && <p>{settings.companyEmail}</p>}
          </div>

          {/* Company Seal */}
          {settings.companySealUrl && (
            <img 
              src={settings.companySealUrl} 
              className="absolute right-0 top-[35px] w-[75px] h-[75px] object-contain rotate-[-5deg] pointer-events-none opacity-85 mix-blend-multiply"
              alt="Seal"
              style={{ zIndex: 20 }}
            />
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 mb-8">
        <table className="w-full border-collapse border border-stone-800" style={{ borderColor: colors.stone800 }}>
          <thead>
            <tr style={{ backgroundColor: colors.stone100 }}>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold w-[55%]" style={{ borderColor: colors.stone800 }}>品番・品名</th>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold" style={{ borderColor: colors.stone800 }}>数量</th>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold" style={{ borderColor: colors.stone800 }}>単価</th>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold" style={{ borderColor: colors.stone800 }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {itemsWithMaster.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-stone-800 py-1.5 px-3 text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.productName}</td>
                <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.quantity.toLocaleString()}</td>
                <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.unitPrice.toLocaleString()}</td>
                <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.amount.toLocaleString()}</td>
              </tr>
            ))}
            {/* Shipping/Handling rows */}
            {allocShipping > 0 && (
               <tr>
                 <td className="border border-stone-800 py-1.5 px-3 text-[9pt]" style={{ borderColor: colors.stone800 }}>送料(国際輸送費を含む)</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>1</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{allocShipping.toLocaleString()}</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{allocShipping.toLocaleString()}</td>
               </tr>
            )}
            {allocHandling > 0 && (
               <tr>
                 <td className="border border-stone-800 py-1.5 px-3 text-[9pt]" style={{ borderColor: colors.stone800 }}>輸入代行手数料(1%)</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>1</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{allocHandling.toLocaleString()}</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{allocHandling.toLocaleString()}</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Calculation Block */}
      <div className="flex justify-end mb-8 pt-4 border-t border-stone-50" style={{ borderTopColor: colors.stone100 }}>
        <div className="w-[320px] space-y-3">
          <div className="flex justify-between text-[10pt]">
            <span style={{ color: colors.stone400 }}>薬品小計額</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[10pt]">
            <span style={{ color: colors.stone400 }}>一括配送料</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(allocShipping)}</span>
          </div>
          <div className="flex justify-between text-[10pt]">
            <span style={{ color: colors.stone400 }}>事務手数料</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(allocHandling)}</span>
          </div>
          <div className="flex justify-between text-[10pt] pb-2 border-b" style={{ borderBottomColor: colors.stone100 }}>
            <span style={{ color: colors.stone400 }}>消費税等合計 ({settings.taxRate}%)</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between items-end pt-4">
            <span className="text-[10pt] font-bold pb-1" style={{ color: colors.stone900 }}>総支払合計金額</span>
            <span className="text-[18pt] font-bold tracking-tight" style={{ color: colors.stone900 }}>{formatCurrency(totalWithTax)}</span>
          </div>
        </div>
      </div>

      {/* Footer: Bank Info & Memo */}
      <div className="mt-auto">
        <div className="mb-0">
          <p className="text-[9pt] font-bold mb-1">お振込先：</p>
          <p className="text-[9pt] leading-relaxed text-stone-700">
            {settings.bankName} {settings.bankBranch} {settings.bankAccountType}口座 口座番号：{settings.bankAccountNumber} {settings.bankAccountHolder}
          </p>
        </div>
        {settings.footerNote && (
          <div className="mt-4 text-center">
            <p className="text-[8pt] text-stone-400 italic">{settings.footerNote}</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface MasterInvoiceSummaryTemplateProps {
  invoice: MasterInvoice;
  masterClinic: Clinic | undefined;
  settings: InvoiceSettings;
}

const MasterInvoiceSummaryTemplate = ({ invoice, masterClinic, settings }: MasterInvoiceSummaryTemplateProps) => {
  const date = new Date(invoice.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxRate = settings.taxRate / 100;
  const tax = Math.round((subtotal + invoice.shippingFee + invoice.handlingFee) * taxRate);
  const totalWithTax = subtotal + invoice.shippingFee + invoice.handlingFee + tax;

  return (
    <div 
      className="bg-white mx-auto overflow-hidden shadow-2xl invoice-page p-[60px] flex flex-col"
      style={{ 
        width: "210mm", 
        minHeight: "297mm", 
        fontFamily: "'Inter', sans-serif",
        color: "#1a1a1a",
        boxSizing: "border-box"
      }}
    >
      {/* Top Right: Date and No */}
      <div className="absolute top-[10mm] right-[20mm] text-right text-[10pt] space-y-1">
        <p>{date}</p>
        <p>請求番号: {invoice.id.slice(0, 8).toUpperCase()}</p>
      </div>

      {/* Main Title - Centered Top */}
      <div className="text-center mt-12 mb-12">
        <h1 className="text-[24pt] font-bold tracking-[0.5em] inline-block pb-1">請求書</h1>
      </div>

      {/* Parties Section */}
      <div className="flex justify-between items-start mb-10 px-4">
        {/* Recipient */}
        <div className="w-1/2">
          <div className="border-b-2 pb-1 mb-3" style={{ borderBottomColor: colors.stone800 }}>
            <h2 className="text-[16pt] font-bold">{masterClinic?.name || invoice.masterClinicName} 御中</h2>
          </div>
          <p className="text-[10pt] mb-6">本期間の集計分として、下記の通りご請求申し上げます。</p>
          
          <div className="flex items-baseline gap-4 border-b-2 pb-1 w-full" style={{ borderBottomColor: colors.stone800 }}>
            <span className="text-[11pt] font-bold">総注文金額合計</span>
            <div className="flex items-baseline flex-1 justify-end">
              <span className="text-[12pt] font-bold mr-2">¥</span>
              <span className="text-[18pt] font-bold tracking-tight">{totalWithTax.toLocaleString()}</span>
              <span className="text-[12pt] font-bold ml-1">-</span>
            </div>
          </div>
        </div>

        {/* Sender Info - Right aligned */}
        <div className="w-[85mm] text-left relative flex flex-col items-start pl-4" id="sender-info-master">
          {settings.companyLogoUrl && (
            <div className="flex items-center gap-2 mb-2">
              <img 
                src={settings.companyLogoUrl} 
                className="max-w-[195px] h-auto object-contain"
                alt="Logo"
              />
            </div>
          )}
          <div className="text-[9pt] space-y-0.5 leading-tight relative z-10 text-stone-700">
            <p className="font-bold text-[10.5pt] mb-1 text-black">{settings.companyName}</p>
            <p>〒{settings.companyAddress.match(/\d{3}-?\d{4}/)?.[0] || ""}</p>
            <p>{settings.companyAddress.replace(/\d{3}-?\d{4}/, "").replace(/〒/, "").trim()}</p>
            {settings.companyTel && <p>TEL: {settings.companyTel}</p>}
            {settings.companyEmail && <p>{settings.companyEmail}</p>}
          </div>

          {/* Company Seal */}
          {settings.companySealUrl && (
            <img 
              src={settings.companySealUrl} 
              className="absolute right-0 top-[35px] w-[75px] h-[75px] object-contain rotate-[-5deg] pointer-events-none opacity-85 mix-blend-multiply"
              alt="Seal"
              style={{ zIndex: 20 }}
            />
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 mb-8">
        <table className="w-full border-collapse border border-stone-800" style={{ borderColor: colors.stone800 }}>
          <thead>
            <tr style={{ backgroundColor: colors.stone100 }}>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold w-[55%]" style={{ borderColor: colors.stone800 }}>品番・品名</th>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold" style={{ borderColor: colors.stone800 }}>数量</th>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold" style={{ borderColor: colors.stone800 }}>単価</th>
              <th className="border border-stone-800 py-2 px-3 text-center text-[9pt] font-bold" style={{ borderColor: colors.stone800 }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-stone-800 py-1.5 px-3 text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.productName}</td>
                <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.quantity.toLocaleString()}</td>
                <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{item.unitPrice.toLocaleString()}</td>
                <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{(item.quantity * item.unitPrice).toLocaleString()}</td>
              </tr>
            ))}
            {invoice.shippingFee > 0 && (
               <tr>
                 <td className="border border-stone-800 py-1.5 px-3 text-[9pt]" style={{ borderColor: colors.stone800 }}>配送料等総額</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>1</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{invoice.shippingFee.toLocaleString()}</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{invoice.shippingFee.toLocaleString()}</td>
               </tr>
            )}
            {invoice.handlingFee > 0 && (
               <tr>
                 <td className="border border-stone-800 py-1.5 px-3 text-[9pt]" style={{ borderColor: colors.stone800 }}>事務手数料総額</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>1</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{invoice.handlingFee.toLocaleString()}</td>
                 <td className="border border-stone-800 py-1.5 px-3 text-right text-[9pt]" style={{ borderColor: colors.stone800 }}>{invoice.handlingFee.toLocaleString()}</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Calculation Block */}
      <div className="flex justify-end mb-8 pt-4 border-t border-stone-50" style={{ borderTopColor: colors.stone100 }}>
        <div className="w-[320px] space-y-3">
          <div className="flex justify-between text-[10pt]">
            <span style={{ color: colors.stone400 }}>薬品小計額</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[10pt]">
            <span style={{ color: colors.stone400 }}>一括配送料</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(invoice.shippingFee)}</span>
          </div>
          <div className="flex justify-between text-[10pt]">
            <span style={{ color: colors.stone400 }}>事務手数料</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(invoice.handlingFee)}</span>
          </div>
          <div className="flex justify-between text-[10pt] pb-2 border-b" style={{ borderBottomColor: colors.stone100 }}>
            <span style={{ color: colors.stone400 }}>消費税等合計 ({settings.taxRate}%)</span>
            <span className="font-mono" style={{ color: colors.stone800 }}>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between items-end pt-4">
            <span className="text-[10pt] font-bold pb-1" style={{ color: colors.stone900 }}>総支払合計金額</span>
            <span className="text-[18pt] font-bold tracking-tight" style={{ color: colors.stone900 }}>{formatCurrency(totalWithTax)}</span>
          </div>
        </div>
      </div>

      {/* Footer: Bank Info & Memo */}
      <div className="mt-auto">
        <div className="mb-0">
          <p className="text-[10pt] font-bold mb-1">お振込先：</p>
          <p className="text-[10pt] leading-relaxed text-stone-700">
            {settings.bankName} {settings.bankBranch} {settings.bankAccountType}口座 口座番号：{settings.bankAccountNumber} {settings.bankAccountHolder}
          </p>
        </div>
        {settings.footerNote && (
          <div className="mt-4 text-center">
            <p className="text-[8pt] text-stone-400 italic">{settings.footerNote}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export async function generateBulkPDF(
  invoice: MasterInvoice,
  allocations: Allocation[],
  clinics: Clinic[],
  masterClinic: Clinic | undefined,
  settings: InvoiceSettings
) {
  const pdf = new jsPDF("p", "mm", "a4");
  
  // We need to render the templates one by one
  // Since they are React components, we can temporarily render them to a hidden div
  const { createRoot } = await import("react-dom/client");
  const container = document.createElement("div");
  container.style.boxSizing = "border-box";
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "210mm"; 
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#292524";
  document.body.appendChild(container);

  try {
    // 1. Render Master Summary First (if enabled)
    if (settings.showMasterSummary) {
      const summaryDiv = document.createElement("div");
      container.appendChild(summaryDiv);
      const summaryRoot = createRoot(summaryDiv);
      
      await new Promise<void>((resolve) => {
        summaryRoot.render(
          <MasterInvoiceSummaryTemplate 
            invoice={invoice} 
            masterClinic={masterClinic} 
            settings={settings}
          />
        );
        setTimeout(resolve, 600);
      });

      const summaryCanvas = await html2canvas(summaryDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      const summaryImgData = summaryCanvas.toDataURL("image/png");
      const summaryWidth = pdf.internal.pageSize.getWidth();
      const summaryHeight = (summaryCanvas.height * summaryWidth) / summaryCanvas.width;

      pdf.addImage(summaryImgData, "PNG", 0, 0, summaryWidth, summaryHeight);
      
      summaryRoot.unmount();
      container.removeChild(summaryDiv);
    }

    // 2. Render Individual Clinic Allocations
    let isFirstPage = !settings.showMasterSummary;

    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      if (alloc.itemAllocations.every(ia => ia.quantity === 0)) continue;

      const clinic = clinics.find(c => c.id === alloc.clinicId);
      
      const pageDiv = document.createElement("div");
      container.appendChild(pageDiv);
      const root = createRoot(pageDiv);
      
      await new Promise<void>((resolve) => {
        root.render(
          <InvoicePDFTemplate 
            invoice={invoice} 
            allocation={alloc} 
            clinic={clinic} 
            masterClinic={masterClinic} 
            settings={settings}
          />
        );
        setTimeout(resolve, 600);
      });

      const canvas = await html2canvas(pageDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (!isFirstPage) {
        pdf.addPage();
      } else {
        isFirstPage = false;
      }

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      
      root.unmount();
      container.removeChild(pageDiv);
    }

    pdf.save(`Invoices-${invoice.title.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
