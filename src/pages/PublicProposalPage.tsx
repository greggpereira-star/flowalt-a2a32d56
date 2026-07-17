import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Download, ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { ProposalRenderer, PAGE_W } from '@/components/altcontrol/proposal-generator/ProposalRenderer';
import { CertificatePage } from '@/components/altcontrol/proposal-generator/CertificatePage';
import { SignaturePad, SignaturePadHandle } from '@/components/altcontrol/proposal-generator/SignaturePad';
import { exportProposalPagesToPdf } from '@/lib/exportProposalPdf';
import { ProposalDocumentModel } from '@/lib/proposalDocument';

interface PublicProposal {
  id: string;
  client_name: string;
  client_email: string | null;
  seller_name: string | null;
  title: string | null;
  document: ProposalDocumentModel;
  status: string;
  valid_until: string | null;
  selected_option_id: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_document: string | null;
  signer_email: string | null;
  signature_image: string | null;
  signature_ip: string | null;
  document_hash: string | null;
  view_count: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'Visualizada', color: 'bg-amber-100 text-amber-700' },
  signed: { label: 'Assinada', color: 'bg-green-100 text-green-700' },
  expired: { label: 'Expirada', color: 'bg-destructive/10 text-destructive' },
  declined: { label: 'Recusada', color: 'bg-destructive/10 text-destructive' },
};

async function callFn(token: string, action: string, extra: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke('public-proposal', {
    body: { token, action, ...extra },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.proposal as PublicProposal;
}

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerDocument, setSignerDocument] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const sigRef = useRef<SignaturePadHandle>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wrapperRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const certRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const p = await callFn(token, 'get');
        setProposal(p);
        setSelectedOptionId(p.selected_option_id || p.document?.options?.[0]?.id || null);
      } catch (e: any) {
        setError(e.message || 'Link inválido ou expirado.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSelectOption(optionId: string) {
    setSelectedOptionId(optionId);
    wrapperRefs.current[optionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!token || !proposal || proposal.status === 'signed') return;
    try {
      const p = await callFn(token, 'select_option', { optionId });
      setProposal(p);
    } catch {
      // seleção local já refletida; falha silenciosa não bloqueia visualização
    }
  }

  async function handleDownloadPdf() {
    if (!proposal) return;
    setExporting(true);
    try {
      const options = proposal.document.options;
      const targets = proposal.status === 'signed'
        ? options.filter((o) => o.id === selectedOptionId)
        : options;
      const els = targets.map((o) => pageRefs.current[o.id]).filter((el): el is HTMLDivElement => !!el);
      if (proposal.status === 'signed' && certRef.current) els.push(certRef.current);
      await exportProposalPagesToPdf(els, `${proposal.client_name}${proposal.status === 'signed' ? ' - assinado' : ''}.pdf`);
    } catch (e: any) {
      toast.error('Falha ao gerar PDF.');
    } finally {
      setExporting(false);
    }
  }

  async function handleSign() {
    if (!token || !proposal) return;
    const sigData = sigRef.current?.getDataUrl();
    if (!signerName.trim()) return toast.error('Informe seu nome.');
    if (!agreed) return toast.error('É necessário aceitar os termos.');
    if (!sigData) return toast.error('Desenhe sua assinatura.');

    setSubmitting(true);
    try {
      const p = await callFn(token, 'sign', {
        signerName: signerName.trim(),
        signerDocument: signerDocument.trim() || undefined,
        signerEmail: signerEmail.trim() || undefined,
        signatureImage: sigData,
        optionId: selectedOptionId,
      });
      setProposal(p);
      setSignOpen(false);
      toast.success('Proposta assinada com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Falha ao assinar.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#5a5a5a] flex items-center justify-center p-6">
        <Skeleton className="h-[600px] w-[420px] rounded-lg" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-background">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Link indisponível</h2>
        <p className="text-sm text-muted-foreground">{error || 'Esta proposta não está mais disponível.'}</p>
      </div>
    );
  }

  const { document: docModel } = proposal;
  const statusInfo = STATUS_LABEL[proposal.status] || STATUS_LABEL.sent;
  const selectedOption = docModel.options.find((o) => o.id === selectedOptionId) || docModel.options[0];
  const isSigned = proposal.status === 'signed';

  return (
    <div className="min-h-screen bg-[#5a5a5a]">
      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{proposal.title || `Proposta — ${proposal.client_name}`}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            {proposal.seller_name && <span className="text-xs text-muted-foreground">por {proposal.seller_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={exporting}>
            <Download className="h-4 w-4 mr-1.5" /> {isSigned ? 'PDF assinado' : 'Baixar PDF'}
          </Button>
          {!isSigned && proposal.status !== 'expired' && (
            <Button size="sm" onClick={() => setSignOpen(true)}>
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Aprovar e Assinar
            </Button>
          )}
          {isSigned && (
            <span className="text-sm text-green-700 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Assinada
            </span>
          )}
        </div>
      </div>

      {/* Seletor de opções */}
      {docModel.options.length > 1 && (
        <div className="flex flex-wrap gap-2 justify-center py-4 px-4">
          {docModel.options.map((o) => (
            <button
              key={o.id}
              onClick={() => handleSelectOption(o.id)}
              disabled={isSigned}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                selectedOptionId === o.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary'
              } ${isSigned && selectedOptionId !== o.id ? 'opacity-40' : ''}`}
            >
              {o.title}{o.tier ? ` ${o.tier}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Páginas A4 */}
      <div className="flex flex-col items-center gap-8 py-6 px-4">
        {docModel.options.map((o) => (
          <div
            key={o.id}
            ref={(el) => { wrapperRefs.current[o.id] = el; }}
            className="shadow-2xl transition-all rounded-sm"
            style={{
              width: PAGE_W,
              display: o.id === selectedOptionId ? 'block' : (isSigned ? 'none' : 'block'),
              opacity: isSigned && o.id !== selectedOptionId ? 0.35 : 1,
              outline: docModel.options.length > 1 && o.id === selectedOptionId ? '3px solid hsl(var(--primary))' : 'none',
              outlineOffset: 3,
            }}
          >
            <ProposalRenderer
              ref={(el) => { pageRefs.current[o.id] = el; }}
              option={o}
              theme={docModel.theme}
              clientName={proposal.client_name}
              date={docModel.date}
            />
          </div>
        ))}

        {isSigned && proposal.signature_image && proposal.document_hash && proposal.signed_at && (
          <div className="shadow-2xl" style={{ width: PAGE_W }}>
            <CertificatePage
              ref={certRef}
              clientName={proposal.client_name}
              signerName={proposal.signer_name || proposal.client_name}
              signerDocument={proposal.signer_document}
              signerEmail={proposal.signer_email}
              signedAt={proposal.signed_at}
              ip={proposal.signature_ip}
              documentHash={proposal.document_hash}
              signatureImage={proposal.signature_image}
              selectedOptionTitle={selectedOption ? `${selectedOption.title}${selectedOption.tier ? ' ' + selectedOption.tier : ''}` : undefined}
            />
          </div>
        )}
      </div>

      {/* Modal de assinatura */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovar e assinar proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {docModel.options.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Opção selecionada: <b>{selectedOption?.title}{selectedOption?.tier ? ` ${selectedOption.tier}` : ''}</b>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome completo *</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input value={signerDocument} onChange={(e) => setSignerDocument(e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <SignaturePad ref={sigRef} onChange={setHasSignature} />
            <div className="flex items-start gap-2 pt-1">
              <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
              <Label htmlFor="agree" className="text-xs font-normal leading-snug text-muted-foreground">
                Li e aceito os termos e condições descritos nesta proposta, e confirmo minha aprovação eletrônica.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>Cancelar</Button>
            <Button onClick={handleSign} disabled={submitting || !hasSignature || !agreed || !signerName.trim()}>
              {submitting ? 'Assinando...' : 'Confirmar assinatura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
