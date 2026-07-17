import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Plus, Trash2, Save, Download, Link as LinkIcon, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ProposalDocumentModel, ProposalOption, ProposalBlock,
  createEmptyDocument, createEmptyOption, uid, PROPOSAL_FONTS,
} from '@/lib/proposalDocument';
import { ProposalRenderer, PAGE_W } from '@/components/altcontrol/proposal-generator/ProposalRenderer';
import { BlockEditor } from '@/components/altcontrol/proposal-generator/BlockEditor';
import { exportProposalPagesToPdf } from '@/lib/exportProposalPdf';
import {
  useProposalDoc, useCreateProposalDoc, useUpdateProposalDoc,
  useGeneratePublicLink, publicProposalUrl,
} from '@/hooks/useProposalDocs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const BLOCK_TYPES: { type: ProposalBlock['type']; label: string }[] = [
  { type: 'section', label: '+ Seção' },
  { type: 'subsection', label: '+ Subseção' },
  { type: 'table', label: '+ Tabela' },
  { type: 'total', label: '+ Total' },
  { type: 'terms', label: '+ Termos' },
  { type: 'spacer', label: '+ Espaço' },
];

function newBlock(type: ProposalBlock['type']): ProposalBlock {
  switch (type) {
    case 'section': return { id: uid(), type, title: 'Novo título', body: 'Descrição...' };
    case 'subsection': return { id: uid(), type, title: 'Subtítulo', body: 'Descrição...' };
    case 'table': return { id: uid(), type, headerLeft: 'Descrição', headerRight: 'Qnt', rows: [] };
    case 'total': return { id: uid(), type, mode: 'single', label: 'TOTAL', value: 'R$ 0,00', valueBold: true };
    case 'terms': return {
      id: uid(), type, title: 'Termos & Condições',
      body: 'Os serviços serão iniciados mediante aprovação do orçamento. As entregas seguem o escopo contratado, e solicitações adicionais ou fora do planejamento serão orçadas à parte. Estão inclusas até duas revisões por entrega. Os prazos consideram o envio completo das informações e materiais necessários por parte do cliente. Não estão inclusos custos de mídia, impressão ou serviços de terceiros. As condições de pagamento serão definidas conforme a proposta aprovada.',
    };
    case 'spacer': return { id: uid(), type, height: 20 };
  }
}

export default function ProposalGeneratorPage() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId?: string }>();
  const { user } = useAuth();
  const isEditing = !!docId;

  const { data: existingDoc, isLoading } = useProposalDoc(docId);
  const createDoc = useCreateProposalDoc();
  const updateDoc = useUpdateProposalDoc();
  const generateLink = useGeneratePublicLink();

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [title, setTitle] = useState('');
  const [doc, setDoc] = useState<ProposalDocumentModel>(() => createEmptyDocument());
  const [activeOptionId, setActiveOptionId] = useState<string>(doc.options[0]?.id);
  const [savedId, setSavedId] = useState<string | undefined>(docId);
  const [exporting, setExporting] = useState(false);

  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Carrega documento existente (modo edição)
  useEffect(() => {
    if (existingDoc) {
      setClientName(existingDoc.client_name || '');
      setClientEmail(existingDoc.client_email || '');
      setTitle(existingDoc.title || '');
      const d = existingDoc.document as ProposalDocumentModel;
      if (d?.options?.length) {
        setDoc(d);
        setActiveOptionId(d.options[0].id);
      }
      setSavedId(existingDoc.id);
    }
  }, [existingDoc]);

  const activeOption = useMemo(
    () => doc.options.find((o) => o.id === activeOptionId) || doc.options[0],
    [doc.options, activeOptionId]
  );

  function updateOption(optionId: string, updater: (o: ProposalOption) => ProposalOption) {
    setDoc((d) => ({ ...d, options: d.options.map((o) => (o.id === optionId ? updater(o) : o)) }));
  }

  function addOption() {
    const opt = createEmptyOption(`Orçamento ${doc.options.length + 1}`);
    setDoc((d) => ({ ...d, options: [...d.options, opt] }));
    setActiveOptionId(opt.id);
  }

  function removeOption(id: string) {
    if (doc.options.length <= 1) {
      toast.error('A proposta precisa ter ao menos uma opção.');
      return;
    }
    setDoc((d) => {
      const options = d.options.filter((o) => o.id !== id);
      return { ...d, options };
    });
    if (activeOptionId === id) {
      setActiveOptionId(doc.options.find((o) => o.id !== id)?.id || '');
    }
  }

  function addBlock(type: ProposalBlock['type']) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => ({ ...o, blocks: [...o.blocks, newBlock(type)] }));
  }

  function updateBlock(blockId: string, next: ProposalBlock) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => ({
      ...o, blocks: o.blocks.map((b) => (b.id === blockId ? next : b)),
    }));
  }

  function removeBlock(blockId: string) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => ({ ...o, blocks: o.blocks.filter((b) => b.id !== blockId) }));
  }

  function moveBlock(blockId: string, dir: -1 | 1) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => {
      const idx = o.blocks.findIndex((b) => b.id === blockId);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= o.blocks.length) return o;
      const blocks = [...o.blocks];
      [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
      return { ...o, blocks };
    });
  }

  async function handleSave(): Promise<string | undefined> {
    if (!clientName.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    let sellerName: string | undefined;
    if (user?.id) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      sellerName = prof?.full_name || undefined;
    }

    if (savedId) {
      await updateDoc.mutateAsync({
        id: savedId,
        updates: { clientName, clientEmail, title: title || `Proposta — ${clientName}`, document: doc },
      });
      toast.success('Proposta salva.');
      return savedId;
    }
    const created = await createDoc.mutateAsync({
      clientName, clientEmail, title: title || `Proposta — ${clientName}`, sellerName, document: doc,
    });
    setSavedId(created.id);
    navigate(`/altcontrol/proposals/generator/${created.id}`, { replace: true });
    toast.success('Proposta criada.');
    return created.id;
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const els = doc.options
        .map((o) => pageRefs.current[o.id])
        .filter((el): el is HTMLDivElement => !!el);
      await exportProposalPagesToPdf(els, `${clientName || 'proposta'}.pdf`);
    } catch (e: any) {
      toast.error('Falha ao exportar PDF: ' + (e?.message || ''));
    } finally {
      setExporting(false);
    }
  }

  async function handleGenerateLink() {
    const id = await handleSave();
    if (!id) return;
    const result = await generateLink.mutateAsync({ id });
    if (result.public_token) {
      const url = publicProposalUrl(result.public_token);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link copiado para a área de transferência!', { description: url });
    }
  }

  if (isLoading && isEditing) {
    return <div className="p-8 text-center text-muted-foreground">Carregando proposta...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Gerador de Proposta</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPdf} disabled={exporting}>
            <Download className="h-4 w-4 mr-1.5" /> {exporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
          <Button variant="outline" onClick={handleGenerateLink} disabled={generateLink.isPending}>
            <LinkIcon className="h-4 w-4 mr-1.5" /> Gerar link
          </Button>
          <Button onClick={handleSave} disabled={createDoc.isPending || updateDoc.isPending}>
            <Save className="h-4 w-4 mr-1.5" /> Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Painel de edição */}
        <div className="w-[440px] border-r overflow-y-auto p-4 space-y-4 bg-muted/20">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nome interno (opcional)</Label>
            <Input placeholder="Ex: Proposta — Art Imóveis" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">E-mail do cliente</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input value={doc.date} onChange={(e) => setDoc((d) => ({ ...d, date: e.target.value }))} placeholder="dd/mm/aa" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Fonte do título</Label>
              <Select value={doc.theme.titleFont} onValueChange={(v) => setDoc((d) => ({ ...d, theme: { ...d.theme, titleFont: v } }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPOSAL_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Opções (páginas)</Label>
            <Button size="sm" variant="ghost" onClick={addOption}><Plus className="h-3.5 w-3.5 mr-1" /> Nova opção</Button>
          </div>
          <Tabs value={activeOptionId} onValueChange={setActiveOptionId}>
            <TabsList className="flex-wrap h-auto">
              {doc.options.map((o) => (
                <TabsTrigger key={o.id} value={o.id} className="text-xs">{o.title}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {activeOption && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Título da opção</Label>
                  <Input value={activeOption.title}
                    onChange={(e) => updateOption(activeOption.id, (o) => ({ ...o, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tier (opcional)</Label>
                  <Input placeholder="Essencial / Avançado" value={activeOption.tier || ''}
                    onChange={(e) => updateOption(activeOption.id, (o) => ({ ...o, tier: e.target.value }))} />
                </div>
              </div>
              {doc.options.length > 1 && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeOption(activeOption.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover esta opção
                </Button>
              )}

              <div className="flex flex-wrap gap-1.5 pt-2">
                {BLOCK_TYPES.map((bt) => (
                  <Button key={bt.type} size="sm" variant="outline" className="text-xs h-7"
                    onClick={() => addBlock(bt.type)}>{bt.label}</Button>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                {activeOption.blocks.map((block) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    onChange={(b) => updateBlock(block.id, b)}
                    onRemove={() => removeBlock(block.id)}
                    onMoveUp={() => moveBlock(block.id, -1)}
                    onMoveDown={() => moveBlock(block.id, 1)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Preview A4 */}
        <div className="flex-1 overflow-auto bg-[#5a5a5a] p-8 flex flex-col items-center gap-8">
          {doc.options.map((o) => (
            <div key={o.id} className="shadow-2xl" style={{ width: PAGE_W }}>
              <ProposalRenderer
                ref={(el) => { pageRefs.current[o.id] = el; }}
                option={o}
                theme={doc.theme}
                clientName={clientName || '(cliente)'}
                date={doc.date}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
