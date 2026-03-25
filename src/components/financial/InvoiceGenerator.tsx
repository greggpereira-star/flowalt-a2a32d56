import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients } from "@/hooks/useClients";
import { useClientCards } from "@/hooks/useClientCards";
import { Printer, Download, Plus, Trash2, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface InvoiceItem {
  description: string;
  amount: string;
}

export function InvoiceGenerator() {
  const { data: clientCards } = useClientCards();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoText, setLogoText] = useState("alt.");
  const [logoSubText, setLogoSubText] = useState("Agency,\n• Partners");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [invoiceData, setInvoiceData] = useState({
    title: "Invoice",
    clientName: "",
    date: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(new Date(), "yyyy-MM-dd"),
    sidebarText: "strategy, management & communication",
    bankDetails: "Bank Name: 748 - Banco Cooperativo Sicredi S.A. - Bansicredi\nAgency: 0167\nAccount: 94842-3\nBeneficiary: ALT NEGOCIOS E SOLUCOES DIGITAIS LTDA\nCNPJ: 64.560.862/0001-51",
    termsTitle: "Terms & Conditions",
    termsText: "",
    currency: "BRL",
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", amount: "" },
  ]);

  const handleClientSelect = (clientId: string) => {
    const client = clientCards?.find((c) => c.id === clientId);
    if (client) {
      setInvoiceData((prev) => ({ ...prev, clientName: client.name }));
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", amount: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const total = items.reduce((sum, item) => {
    const val = parseFloat(item.amount.replace(/[^\d.,]/g, "").replace(",", "."));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: invoiceData.currency,
    }).format(value);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup bloqueado. Permita popups para imprimir.");
      return;
    }

    const formattedDate = format(new Date(invoiceData.date), "MMMM dd, yyyy");
    const formattedDueDate = format(new Date(invoiceData.dueDate), "MMMM dd, yyyy");

    const itemsHtml = items
      .filter((item) => item.description.trim())
      .map(
        (item) => `
        <div class="table-content">
          <div>${item.description.replace(/\n/g, "<br>")}</div>
          <div class="amount">${item.amount || "—"}</div>
        </div>
      `
      )
      .join("");

    const bankDetailsHtml = invoiceData.bankDetails
      .split("\n")
      .map((line) => {
        const parts = line.split(":");
        if (parts.length >= 2) {
          return `<strong>${parts[0]}:</strong>${parts.slice(1).join(":")}`;
        }
        return line;
      })
      .join("<br>");

    const logoHtml = logoUrl
      ? `<div class="logo-container"><img src="${logoUrl}" alt="Logo" style="max-height:60px;max-width:200px;object-fit:contain;" /></div>`
      : `<div class="logo-container">
          <div class="logo-main">${logoText}</div>
          <div class="logo-sub">${logoSubText.replace(/\n/g, "<br>").replace("•", '<span class="dot"></span>')}</div>
        </div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${invoiceData.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; background-color: #fff; display: flex; justify-content: center; }
    .a4-page { width: 210mm; min-height: 297mm; background-color: white; display: flex; }
    .sidebar { width: 14%; background-color: #111; position: relative; display: flex; align-items: center; }
    .vertical-gradient { position: absolute; right: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(to bottom, #3b82f6, #ef4444, #f59e0b, #fff); }
    .sidebar-text { color: white; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 2rem; font-weight: 700; letter-spacing: -0.5px; white-space: nowrap; margin-left: auto; margin-right: 25px; margin-bottom: -150px; }
    .content { width: 86%; padding: 60px 70px; display: flex; flex-direction: column; }
    h1 { font-size: 4.5rem; font-weight: 900; letter-spacing: -3px; color: #111; margin-bottom: 40px; }
    .client-info { font-size: 1.1rem; line-height: 1.6; margin-bottom: 60px; color: #111; }
    .client-info strong { font-weight: 700; }
    .table-header { display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; color: #111; margin-bottom: 10px; }
    .gradient-line-h { height: 2px; background: linear-gradient(to right, #3b82f6, #ef4444, #f59e0b, #fff); margin-bottom: 25px; }
    .table-content { display: flex; justify-content: space-between; font-size: 1.05rem; line-height: 1.4; color: #111; font-weight: 700; margin-bottom: 20px; }
    .table-content .amount { font-weight: 600; color: #555; white-space: nowrap; }
    .total-container { margin-top: 30px; }
    .total-row { display: flex; justify-content: flex-end; align-items: center; font-size: 1.2rem; font-weight: 700; color: #111; padding: 15px 0; }
    .total-row span:first-child { margin-right: 30px; }
    .footer-details { margin-top: 60px; }
    .footer-details h3 { font-size: 1.4rem; font-weight: 700; color: #111; margin-bottom: 15px; }
    .footer-details p { font-size: 0.95rem; line-height: 1.5; color: #555; margin-bottom: 30px; }
    .footer-details strong { font-weight: 700; color: #666; }
    .logo-container { margin-top: auto; display: flex; align-items: flex-end; }
    .logo-main { font-size: 4rem; font-weight: 900; letter-spacing: -3px; line-height: 0.75; color: #111; }
    .logo-sub { margin-left: 8px; font-size: 0.75rem; font-weight: 700; line-height: 1.2; color: #111; padding-bottom: 3px; }
    .logo-sub .dot { display: inline-block; width: 4px; height: 4px; background-color: #555; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
    @media print { body { background: white; padding: 0; } .a4-page { box-shadow: none; width: 100%; height: auto; } }
  </style>
</head>
<body>
  <div class="a4-page">
    <div class="sidebar">
      <div class="sidebar-text">${invoiceData.sidebarText}</div>
      <div class="vertical-gradient"></div>
    </div>
    <div class="content">
      <h1>${invoiceData.title}</h1>
      <div class="client-info">
        <strong>Client:</strong> ${invoiceData.clientName}<br>
        <strong>Date:</strong> ${formattedDate}<br>
        <strong>Due Date:</strong> ${formattedDueDate}
      </div>
      <div class="table-header"><div>Description</div><div>Amount</div></div>
      <div class="gradient-line-h"></div>
      ${itemsHtml}
      <div class="total-container">
        <div class="gradient-line-h"></div>
        <div class="total-row"><span>TOTAL</span><span>${formatCurrency(total)} (${invoiceData.currency})</span></div>
        <div class="gradient-line-h"></div>
      </div>
      <div class="footer-details">
        <h3>Bank transfer details</h3>
        <p>${bankDetailsHtml}</p>
        ${invoiceData.termsText ? `<h3>${invoiceData.termsTitle}</h3><p>${invoiceData.termsText}</p>` : ""}
      </div>
      ${logoHtml}
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Gerador de Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Section */}
          <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/30">
            <Label className="text-sm font-semibold">Logo do Documento</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img src={logoUrl} alt="Logo" className="h-12 max-w-[160px] object-contain rounded border" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => setLogoUrl(null)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3 flex-1">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Texto principal</Label>
                    <Input value={logoText} onChange={(e) => setLogoText(e.target.value)} placeholder="alt." />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Subtexto</Label>
                    <Input value={logoSubText} onChange={(e) => setLogoSubText(e.target.value)} placeholder="Agency, Partners" />
                  </div>
                </div>
              )}
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-1" />
                  {logoUrl ? "Trocar" : "Upload Logo"}
                </Button>
              </div>
            </div>
          </div>

          {/* General Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={invoiceData.title} onChange={(e) => setInvoiceData((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Select onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientCards?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={invoiceData.date} onChange={(e) => setInvoiceData((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <Input type="date" value={invoiceData.dueDate} onChange={(e) => setInvoiceData((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>

          {/* Custom client name override */}
          <div className="space-y-1">
            <Label>Nome do Cliente (editar manualmente)</Label>
            <Input value={invoiceData.clientName} onChange={(e) => setInvoiceData((p) => ({ ...p, clientName: e.target.value }))} placeholder="Nome do cliente na invoice" />
          </div>

          {/* Sidebar text */}
          <div className="space-y-1">
            <Label>Texto da Barra Lateral</Label>
            <Input value={invoiceData.sidebarText} onChange={(e) => setInvoiceData((p) => ({ ...p, sidebarText: e.target.value }))} />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Itens da Invoice</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1">
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Descrição do serviço..."
                    className="min-h-[60px]"
                  />
                </div>
                <div className="w-40">
                  <Input
                    value={item.amount}
                    onChange={(e) => updateItem(index, "amount", e.target.value)}
                    placeholder="R$ 0,00"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length === 1} className="mt-1">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <div className="flex justify-end text-lg font-bold pt-2 border-t">
              Total: {formatCurrency(total)}
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-1">
            <Label>Dados Bancários</Label>
            <Textarea
              value={invoiceData.bankDetails}
              onChange={(e) => setInvoiceData((p) => ({ ...p, bankDetails: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          {/* Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Título dos Termos</Label>
              <Input value={invoiceData.termsTitle} onChange={(e) => setInvoiceData((p) => ({ ...p, termsTitle: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Moeda</Label>
              <Select value={invoiceData.currency} onValueChange={(v) => setInvoiceData((p) => ({ ...p, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL (R$)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Texto dos Termos</Label>
            <Textarea
              value={invoiceData.termsText}
              onChange={(e) => setInvoiceData((p) => ({ ...p, termsText: e.target.value }))}
              placeholder="Condições de pagamento..."
              className="min-h-[60px]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Gerar Invoice / Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
