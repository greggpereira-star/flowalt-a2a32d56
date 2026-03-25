import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientCards } from "@/hooks/useClientCards";
import { Printer, Download, Plus, Trash2, ImageIcon, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { InvoiceTemplateAltPremium, type InvoiceData } from "./invoice/InvoiceTemplateAltPremium";

interface BankDetail {
  label: string;
  value: string;
}

const defaultBankDetails: BankDetail[] = [
  { label: "Bank Name", value: "748 - Banco Cooperativo Sicredi S.A. - Bansicredi" },
  { label: "Agency", value: "0167" },
  { label: "Account", value: "94842-3" },
  { label: "Beneficiary", value: "ALT NEGOCIOS E SOLUCOES DIGITAIS LTDA" },
  { label: "CNPJ", value: "64.560.862/0001-51" },
];

export function InvoiceGenerator() {
  const { data: clientCards } = useClientCards();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    documentTitle: "Invoice",
    clientName: "Mela & Kera",
    issueDate: format(new Date(), "MMMM dd, yyyy"),
    dueDate: format(new Date(), "MMMM dd, yyyy"),
    sidebarText: "strategy, management & communication",
    brandMain: "alt.",
    brandSubTop: "Agency,",
    brandSubBottom: "Partners",
    termsTitle: "Terms & Conditions",
    termsText: "",
    currency: "BRL",
  });

  const [descriptionLines, setDescriptionLines] = useState<string[]>([
    "Audiovisual Edition",
    "Audiovisual Production",
    "Static Ad Creatives for Paid Media",
    "(Google Ads)",
    "Paid Media Management",
    "E-commerce Management &",
    "Optimization",
  ]);

  const [amountLabel, setAmountLabel] = useState("R$ 10.700");
  const [totalValue, setTotalValue] = useState("R$ 10.700,00 (BRL)");
  const [bankDetails, setBankDetails] = useState<BankDetail[]>(defaultBankDetails);

  const handleClientSelect = (clientId: string) => {
    const client = clientCards?.find((c) => c.id === clientId);
    if (client) setForm((p) => ({ ...p, clientName: client.name }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateBank = (index: number, field: keyof BankDetail, value: string) => {
    setBankDetails((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const invoiceData: InvoiceData = {
    ...form,
    descriptionLines,
    amountLabel,
    totalLabel: "TOTAL",
    totalValue,
    bankTitle: "Bank transfer details",
    bankDetails,
    logoUrl,
  };

  const buildPrintHTML = useCallback(() => {
    const bankHtml = invoiceData.bankDetails
      .map((d) => `<strong>${d.label}:</strong> ${d.value}`)
      .join("<br>");

    const logoHtml = invoiceData.logoUrl
      ? `<div class="invoice-premium-brand"><img src="${invoiceData.logoUrl}" alt="Logo" style="max-height:60px;max-width:200px;object-fit:contain;" /></div>`
      : `<div class="invoice-premium-brand">
          <div class="invoice-premium-brand__main">${invoiceData.brandMain}</div>
          <div class="invoice-premium-brand__sub">
            <div>${invoiceData.brandSubTop}</div>
            <div class="invoice-premium-brand__dotline">
              <span class="invoice-premium-brand__dot"></span>${invoiceData.brandSubBottom}
            </div>
          </div>
        </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${invoiceData.documentTitle}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;background:#fff;display:flex;justify-content:center}
.page{width:210mm;min-height:297mm;background:#fff;display:flex}
.sidebar{width:14%;background:#111;position:relative;display:flex;align-items:center}
.sidebar__gradient{position:absolute;right:0;top:0;bottom:0;width:3px;background:linear-gradient(to bottom,#3b82f6,#ef4444,#f59e0b,#fff)}
.sidebar__text{color:#fff;writing-mode:vertical-rl;transform:rotate(180deg);font-size:2rem;font-weight:700;letter-spacing:-.5px;white-space:nowrap;margin-left:auto;margin-right:25px;margin-bottom:-150px}
.content{width:86%;padding:60px 70px;display:flex;flex-direction:column}
h1{font-size:4.5rem;font-weight:900;letter-spacing:-3px;line-height:1;margin:0 0 40px;color:#111}
.client{font-size:1.1rem;line-height:1.6;margin-bottom:60px;color:#111}
.client strong{font-weight:700}
.table-header{display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;color:#111;margin-bottom:10px}
.rule{height:2px;background:linear-gradient(to right,#3b82f6,#ef4444,#f59e0b,#fff);margin-bottom:25px}
.table-row{display:flex;justify-content:space-between;font-size:1.05rem;line-height:1.4;font-weight:700;color:#111;margin-bottom:50px;gap:20px;align-items:flex-start}
.table-desc{white-space:pre-line}
.table-amt{font-weight:600;color:#555;text-align:right;min-width:170px}
.total{margin-top:30px}
.total .rule:first-child,.total .rule:last-child{margin-bottom:0}
.total-row{display:flex;justify-content:flex-end;align-items:center;font-size:1.2rem;font-weight:700;color:#111;padding:15px 0}
.total-label{margin-right:30px}
.footer{margin-top:60px}
.footer__title{font-size:1.4rem;font-weight:700;color:#111;margin:0 0 15px}
.footer__body{font-size:.95rem;line-height:1.5;color:#555;margin:0 0 30px}
.footer__body strong{font-weight:700;color:#666}
.invoice-premium-brand{margin-top:auto;display:flex;align-items:flex-end}
.invoice-premium-brand__main{font-size:4rem;font-weight:900;letter-spacing:-3px;line-height:.75;color:#111}
.invoice-premium-brand__sub{margin-left:8px;font-size:.75rem;font-weight:700;line-height:1.2;color:#111;padding-bottom:3px}
.invoice-premium-brand__dotline{display:flex;align-items:center}
.invoice-premium-brand__dot{width:4px;height:4px;background:#555;border-radius:50%;margin-right:4px;display:inline-block}
@page{size:A4;margin:0}
@media print{body{background:#fff;padding:0}.page{box-shadow:none;width:100%;height:auto}}
</style>
</head>
<body>
<div class="page">
  <div class="sidebar">
    <div class="sidebar__text">${invoiceData.sidebarText}</div>
    <div class="sidebar__gradient"></div>
  </div>
  <div class="content">
    <h1>${invoiceData.documentTitle}</h1>
    <div class="client">
      <strong>Client:</strong> ${invoiceData.clientName}<br>
      <strong>Date:</strong> ${invoiceData.issueDate}<br>
      <strong>Due Date:</strong> ${invoiceData.dueDate}
    </div>
    <div class="table-header"><div>Description</div><div>Amount</div></div>
    <div class="rule"></div>
    <div class="table-row">
      <div class="table-desc">${invoiceData.descriptionLines.join("\n")}</div>
      <div class="table-amt">${invoiceData.amountLabel}</div>
    </div>
    <div class="total">
      <div class="rule"></div>
      <div class="total-row">
        <span class="total-label">${invoiceData.totalLabel}</span>
        <span>${invoiceData.totalValue}</span>
      </div>
      <div class="rule"></div>
    </div>
    <div class="footer">
      <h3 class="footer__title">${invoiceData.bankTitle}</h3>
      <p class="footer__body">${bankHtml}</p>
      ${invoiceData.termsText ? `<h3 class="footer__title">${invoiceData.termsTitle}</h3><p class="footer__body">${invoiceData.termsText}</p>` : ""}
    </div>
    ${logoHtml}
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`;
  }, [invoiceData]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup bloqueado. Permita popups para imprimir.");
      return;
    }
    printWindow.document.write(buildPrintHTML());
    printWindow.document.close();
  };

  const handleDownloadHTML = () => {
    const html = buildPrintHTML().replace(
      "<script>window.onload=function(){window.print()}</script>",
      ""
    );
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${form.clientName.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("HTML exportado com sucesso!");
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Editor Panel */}
      <Card className="overflow-auto max-h-[85vh]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="w-4 h-4" />
            Editor de Invoice Premium
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Logo */}
          <div className="space-y-2 p-3 rounded-lg border border-border/40 bg-muted/20">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo</Label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo" className="h-10 max-w-[140px] object-contain rounded border" />
                  <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground" onClick={() => setLogoUrl(null)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 flex-1">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Principal</Label>
                    <Input value={form.brandMain} onChange={(e) => setForm((p) => ({ ...p, brandMain: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Sub Top</Label>
                    <Input value={form.brandSubTop} onChange={(e) => setForm((p) => ({ ...p, brandSubTop: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Sub Bottom</Label>
                    <Input value={form.brandSubBottom} onChange={(e) => setForm((p) => ({ ...p, brandSubBottom: e.target.value }))} className="h-8 text-xs" />
                  </div>
                </div>
              )}
              <div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="h-8 text-xs">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  {logoUrl ? "Trocar" : "Upload"}
                </Button>
              </div>
            </div>
          </div>

          {/* Header Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={form.documentTitle} onChange={(e) => setForm((p) => ({ ...p, documentTitle: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select onValueChange={handleClientSelect}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {clientCards?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Nome do Cliente</Label>
            <Input value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data de Emissão</Label>
              <Input value={form.issueDate} onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento</Label>
              <Input value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>

          {/* Sidebar text */}
          <div className="space-y-1">
            <Label className="text-xs">Texto da Sidebar</Label>
            <Input value={form.sidebarText} onChange={(e) => setForm((p) => ({ ...p, sidebarText: e.target.value }))} className="h-8 text-xs" />
          </div>

          {/* Description Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Descrição dos Serviços</Label>
              <Button variant="outline" size="sm" onClick={() => setDescriptionLines((p) => [...p, ""])} className="h-7 text-[11px]">
                <Plus className="h-3 w-3 mr-1" />Linha
              </Button>
            </div>
            {descriptionLines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={line}
                  onChange={(e) => setDescriptionLines((p) => p.map((l, j) => (j === i ? e.target.value : l)))}
                  className="h-8 text-xs flex-1"
                  placeholder="Serviço..."
                />
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setDescriptionLines((p) => p.filter((_, j) => j !== i))}
                  disabled={descriptionLines.length <= 1}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Amount & Total */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor (Amount)</Label>
              <Input value={amountLabel} onChange={(e) => setAmountLabel(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total</Label>
              <Input value={totalValue} onChange={(e) => setTotalValue(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Dados Bancários</Label>
            {bankDetails.map((d, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr] gap-2">
                <Input value={d.label} onChange={(e) => updateBank(i, "label", e.target.value)} className="h-8 text-xs" />
                <Input value={d.value} onChange={(e) => updateBank(i, "value", e.target.value)} className="h-8 text-xs" />
              </div>
            ))}
          </div>

          {/* Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Título Termos</Label>
              <Input value={form.termsTitle} onChange={(e) => setForm((p) => ({ ...p, termsTitle: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moeda</Label>
              <Input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texto dos Termos</Label>
            <Textarea value={form.termsText} onChange={(e) => setForm((p) => ({ ...p, termsText: e.target.value }))} className="min-h-[50px] text-xs" placeholder="Condições de pagamento..." />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-border/30">
            <Button onClick={handlePrint} size="sm" className="gap-1.5 flex-1">
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF
            </Button>
            <Button onClick={handleDownloadHTML} variant="outline" size="sm" className="gap-1.5 flex-1">
              <Download className="h-3.5 w-3.5" />
              Exportar HTML
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      <Card className="overflow-auto max-h-[85vh]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center bg-[#555] rounded-lg p-4">
          <InvoiceTemplateAltPremium ref={previewRef} data={invoiceData} scale={0.55} />
        </CardContent>
      </Card>
    </div>
  );
}
