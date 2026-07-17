import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Plus, Trash2, Save, Download, Link as LinkIcon,
  Type, List, Table2, DollarSign, FileText, Minus, Copy, ZoomIn, ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ProposalDocumentModel, ProposalOption, ProposalBlock,
  createEmptyDocument, createEmptyOption, cloneBlock, uid, PROPOSAL_FONTS,
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

const BLOCK_TYPES: { type: ProposalBlock['type']; label: string; icon: React.ElementType }[] = [
  { type: 'section', label: 'Seção', icon: Type },
  { type: 'subsection', label: 'Subseção', icon: List },
  { type: 'table', label: 'Tabela', icon: Table2 },
  { type: 'total', label: 'Total', icon: DollarSign },
  { type: 'terms', label: 'Termos', icon: FileText },
  { type: 'spacer', label: 'Espaço', icon: Minus },
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
  const [zoom, setZoom] = useState(0.62);

  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  function updateTheme(patch: Partial<ProposalDocumentModel['theme']>) {
    setDoc((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  }
  function updateOption(optionId: string, updater: (o: ProposalOption) => ProposalOption) {
    setDoc((d) => ({ ...d, options: d.options.map((o) => (o.id === optionId ? updater(o) : o)) }));
  }
  function addOption() {
    const opt = createEmptyOption(`Orçamento ${doc.options.length + 1}`);
    setDoc((d) => ({ ...d, options: [...d.options, opt] }));
    setActiveOptionId(opt.id);
  }
  function duplicateOption(id: string) {
    const src = doc.options.find((o) => o.id === id);
    if (!src) return;
    const copy: ProposalOption = {
      ...JSON.parse(JSON.stringify(src)),
      id: uid('opt'),
      title: `${src.title} (cópia)`,
      blocks: src.blocks.map((b) => cloneBlock(b)),
    };
    setDoc((d) => ({ ...d, options: [...d.options, copy] }));
    setActiveOptionId(copy.id);
  }
  function removeOption(id: string) {
    if (doc.options.length <= 1) { toast.error('A proposta precisa ter ao menos uma opção.'); return; }
    setDoc((d) => ({ ...d, options: d.options.filter((o) => o.id !== id) }));
    if (activeOptionId === id) setActiveOptionId(doc.options.find((o) => o.id !== id)?.id || '');
  }
  function addBlock(type: ProposalBlock['type']) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => ({ ...o, blocks: [...o.blocks, newBlock(type)] }));
  }
  function updateBlock(blockId: string, next: ProposalBlock) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => ({ ...o, blocks: o.blocks.map((b) => (b.id === blockId ? next : b)) }));
  }
  function removeBlock(blockId: string) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => ({ ...o, blocks: o.blocks.filter((b) => b.id !== blockId) }));
  }
  function duplicateBlock(blockId: string) {
    if (!activeOption) return;
    updateOption(activeOption.id, (o) => {
      const idx = o.blocks.findIndex((b) => b.id === blockId);
      if (idx < 0) return o;
      const blocks = [...o.blocks];
      blocks.splice(idx + 1, 0, cloneBlock(o.blocks[idx]));
      return { ...o, blocks };
    });
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
    if (!clientName.trim()) { toast.error('Informe o nome do cliente.'); return; }
    let sellerName: string | undefined;
    if (user?.id) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      sellerName = prof?.full_name || undefined;
    }
    if (savedId) {
      await updateDoc.mutateAsync({ id: savedId, updates: { clientName, clientEmail, title: title || `Proposta — ${clientName}`, document: doc } });
      toast.success('Proposta salva.');
      return savedId;
    }
    const created = await createDoc.mutateAsync({ clientName, clientEmail, title: title || `Proposta — ${clientName}`, sellerName, document: doc });
    setSavedId(created.id);
    navigate(`/altcontrol/proposals/generator/${created.id}`, { replace: true });
    toast.success('Proposta criada.');
    return created.id;
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const els = doc.options.map((o) => pageRefs.current[o.id]).filter((el): el is HTMLDivElement => !!el);
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

  const fontOptions = (
    <>
      {PROPOSAL_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/altcontrol')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold leading-tight">Gerador de Proposta</h1>
            <p className="text-xs text-muted-foreground">{clientName || 'Nova proposta'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
            <Download className="h-4 w-4 mr-1.5" /> {exporting ? 'Exportando...' : 'PDF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateLink} disabled={generateLink.isPending}>
            <LinkIcon className="h-4 w-4 mr-1.5" /> Gerar link
          </Button>
          <Button size="sm" onClick={handleSave} disabled={createDoc.isPending || updateDoc.isPending}>
            <Save className="h-4 w-4 mr-1.5" /> Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Painel de edição */}
        <div className="w-[460px] border-r bg-muted/20 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4">
              <Accordion type="multiple" defaultValue={['dados', 'conteudo']} className="space-y-2">
                {/* DADOS */}
                <AccordionItem value="dados" className="border rounded-lg bg-card px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">Dados da proposta</AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome interno (opcional)</Label>
                      <Input placeholder="Ex: Proposta — Art Imóveis" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</Label>
                        <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">E-mail</Label>
                        <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</Label>
                      <Input value={doc.date} onChange={(e) => setDoc((d) => ({ ...d, date: e.target.value }))} placeholder="dd/mm/aa" className="w-32" />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* DESIGN */}
                <AccordionItem value="design" className="border rounded-lg bg-card px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">Design & Tipografia</AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-3">
                    {/* Fontes globais */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fonte do título</Label>
                        <Select value={doc.theme.titleFont} onValueChange={(v) => updateTheme({ titleFont: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{fontOptions}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fonte do corpo</Label>
                        <Select value={doc.theme.bodyFont} onValueChange={(v) => updateTheme({ bodyFont: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{fontOptions}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tamanho do título</Label>
                        <span className="text-xs text-muted-foreground">{doc.theme.titleFontSize ?? 74}px</span>
                      </div>
                      <Slider value={[doc.theme.titleFontSize ?? 74]} min={40} max={100} step={1} onValueChange={([v]) => updateTheme({ titleFontSize: v })} />
                    </div>

                    <Separator />

                    {/* Faixa lateral */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">Faixa lateral preta</Label>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Texto</Label>
                        <Input value={doc.theme.sidebarText} onChange={(e) => updateTheme({ sidebarText: e.target.value })} placeholder="estratégia, gestão e comunicação" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fonte</Label>
                          <Select value={doc.theme.sidebarFont || 'Inter'} onValueChange={(v) => updateTheme({ sidebarFont: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>{fontOptions}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Peso</Label>
                          <Select value={String(doc.theme.sidebarWeight ?? 600)} onValueChange={(v) => updateTheme({ sidebarWeight: Number(v) })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="400">Regular</SelectItem>
                              <SelectItem value="500">Médio</SelectItem>
                              <SelectItem value="600">Semi-negrito</SelectItem>
                              <SelectItem value="700">Negrito</SelectItem>
                              <SelectItem value="800">Extra-negrito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tamanho da fonte</Label>
                          <span className="text-xs text-muted-foreground">{doc.theme.sidebarFontSize}px</span>
                        </div>
                        <Slider value={[doc.theme.sidebarFontSize]} min={24} max={70} step={1} onValueChange={([v]) => updateTheme({ sidebarFontSize: v })} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* CONTEUDO */}
                <AccordionItem value="conteudo" className="border rounded-lg bg-card px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">Opções & Conteúdo</AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    {/* Abas de opções */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {doc.options.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => setActiveOptionId(o.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            activeOptionId === o.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:border-primary'
                          }`}
                        >{o.title}</button>
                      ))}
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={addOption}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>

                    {activeOption && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Título da opção</Label>
                            <Input value={activeOption.title} onChange={(e) => updateOption(activeOption.id, (o) => ({ ...o, title: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tier (opcional)</Label>
                            <Input placeholder="Essencial / Avançado" value={activeOption.tier || ''} onChange={(e) => updateOption(activeOption.id, (o) => ({ ...o, tier: e.target.value }))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor mensal (MRR)</Label>
                            <Input type="number" placeholder="0" value={activeOption.priceValue ?? ''} onChange={(e) => updateOption(activeOption.id, (o) => ({ ...o, priceValue: e.target.value ? Number(e.target.value) : undefined, priceKind: 'monthly' }))} />
                          </div>
                          <div className="flex items-end gap-1">
                            <Button size="sm" variant="ghost" className="text-xs h-9" onClick={() => duplicateOption(activeOption.id)}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicar</Button>
                            {doc.options.length > 1 && (
                              <Button size="sm" variant="ghost" className="text-xs h-9 text-destructive" onClick={() => removeOption(activeOption.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground -mt-1">O valor mensal é o que entra no contrato/MRR se o cliente aprovar esta opção.</p>

                        <Separator />

                        {/* Adicionar blocos */}
                        <div>
                          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Adicionar bloco</Label>
                          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                            {BLOCK_TYPES.map((bt) => {
                              const Icon = bt.icon;
                              return (
                                <Button key={bt.type} size="sm" variant="outline" className="text-xs h-8 justify-start px-2" onClick={() => addBlock(bt.type)}>
                                  <Icon className="h-3.5 w-3.5 mr-1.5" /> {bt.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Lista de blocos */}
                        <div className="space-y-2.5 pt-1">
                          {activeOption.blocks.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">Nenhum bloco ainda. Adicione um acima.</p>
                          )}
                          {activeOption.blocks.map((block, idx) => (
                            <BlockEditor
                              key={block.id}
                              block={block}
                              index={idx}
                              total={activeOption.blocks.length}
                              onChange={(b) => updateBlock(block.id, b)}
                              onRemove={() => removeBlock(block.id)}
                              onDuplicate={() => duplicateBlock(block.id)}
                              onMoveUp={() => moveBlock(block.id, -1)}
                              onMoveDown={() => moveBlock(block.id, 1)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollArea>
        </div>

        {/* Preview A4 */}
        <div className="flex-1 flex flex-col bg-[#4a4a4a] overflow-hidden">
          {/* Barra de zoom */}
          <div className="flex items-center justify-center gap-2 py-1.5 bg-black/20 border-b border-black/30">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}><ZoomOut className="h-4 w-4" /></Button>
            <span className="text-xs text-white/80 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(1.2, +(z + 0.1).toFixed(2)))}><ZoomIn className="h-4 w-4" /></Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col items-center gap-8 py-8 px-4">
              {doc.options.map((o) => (
                <div key={o.id} className="flex flex-col items-center gap-2">
                  <div className="text-xs text-white/60 font-medium">{o.title}</div>
                  <div
                    className={`shadow-2xl transition-all ${o.id === activeOptionId ? 'ring-2 ring-primary ring-offset-4 ring-offset-[#4a4a4a]' : ''}`}
                    style={{ width: PAGE_W * zoom, height: `calc(${PAGE_W * 1.414 * zoom}px)` }}
                  >
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: PAGE_W }}>
                      <ProposalRenderer
                        ref={(el) => { pageRefs.current[o.id] = el; }}
                        option={o}
                        theme={doc.theme}
                        clientName={clientName || '(cliente)'}
                        date={doc.date}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
