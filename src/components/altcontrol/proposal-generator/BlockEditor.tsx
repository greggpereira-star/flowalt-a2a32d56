import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import {
  ProposalBlock, TableRow, PROPOSAL_FONTS, uid,
} from '@/lib/proposalDocument';

interface Props {
  block: ProposalBlock;
  onChange: (b: ProposalBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const blockLabel: Record<ProposalBlock['type'], string> = {
  section: 'Seção',
  subsection: 'Subseção',
  table: 'Tabela (Descrição | Qnt)',
  total: 'Total',
  terms: 'Termos & Condições',
  spacer: 'Espaço',
};

function FontSizeStyleRow({
  style, onChange, label = 'Estilo do texto',
}: { style: any; onChange: (s: any) => void; label?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      <div>
        <Label className="text-xs text-muted-foreground">Fonte</Label>
        <Select value={style?.fontFamily || ''} onValueChange={(v) => onChange({ ...style, fontFamily: v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Padrão" /></SelectTrigger>
          <SelectContent>
            {PROPOSAL_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Tamanho (px)</Label>
        <Input
          type="number" className="h-8 text-xs"
          value={style?.fontSize ?? ''}
          placeholder="auto"
          onChange={(e) => onChange({ ...style, fontSize: e.target.value ? Number(e.target.value) : undefined })}
        />
      </div>
      <div className="flex items-center gap-2 pb-1">
        <Switch
          checked={!!style?.fontWeight && style.fontWeight >= 700}
          onCheckedChange={(v) => onChange({ ...style, fontWeight: v ? 700 : 400 })}
        />
        <Label className="text-xs text-muted-foreground">Negrito</Label>
      </div>
    </div>
  );
}

export function BlockEditor({ block, onChange, onRemove, onMoveUp, onMoveDown }: Props) {
  return (
    <div className="border rounded-lg p-3 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {blockLabel[block.type]}
        </span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp}><ChevronUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown}><ChevronDown className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {block.type === 'section' && (
        <>
          <Input placeholder="Título da seção (ex: 1 - Comunicação Estratégica)"
            value={block.title || ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
          <Textarea placeholder="Texto (use **negrito** para destacar trechos)" rows={4}
            value={block.body || ''} onChange={(e) => onChange({ ...block, body: e.target.value })} />
          <FontSizeStyleRow style={block.bodyStyle} onChange={(s) => onChange({ ...block, bodyStyle: s })} />
        </>
      )}

      {block.type === 'subsection' && (
        <>
          <Input placeholder="Título (ex: Inclui:)"
            value={block.title || ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
          <Textarea placeholder="Texto (use **negrito** para destacar trechos)" rows={3}
            value={block.body || ''} onChange={(e) => onChange({ ...block, body: e.target.value })} />
          <div className="flex items-center gap-2">
            <Switch checked={!!block.indent} onCheckedChange={(v) => onChange({ ...block, indent: v })} />
            <Label className="text-xs text-muted-foreground">Recuar à direita (indentado)</Label>
          </div>
          <FontSizeStyleRow style={block.bodyStyle} onChange={(s) => onChange({ ...block, bodyStyle: s })} />
        </>
      )}

      {block.type === 'table' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Cabeçalho esquerdo (Descrição)"
              value={block.headerLeft || ''} onChange={(e) => onChange({ ...block, headerLeft: e.target.value })} />
            <Input placeholder="Cabeçalho direito (Qnt)"
              value={block.headerRight || ''} onChange={(e) => onChange({ ...block, headerRight: e.target.value })} />
          </div>
          <div className="space-y-2">
            {block.rows.map((row, idx) => (
              <div key={row.id} className="border rounded-md p-2 space-y-1.5">
                <div className="flex gap-2">
                  <Input placeholder="Nome do serviço" className="h-8 text-xs"
                    value={row.name}
                    onChange={(e) => {
                      const rows = [...block.rows]; rows[idx] = { ...row, name: e.target.value };
                      onChange({ ...block, rows });
                    }} />
                  <Input placeholder="Qnt (ex: 12 posts/mês)" className="h-8 text-xs w-40"
                    value={row.qnt || ''}
                    onChange={(e) => {
                      const rows = [...block.rows]; rows[idx] = { ...row, qnt: e.target.value };
                      onChange({ ...block, rows });
                    }} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => onChange({ ...block, rows: block.rows.filter((r) => r.id !== row.id) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea placeholder="Descrição curta" rows={2} className="text-xs"
                  value={row.desc || ''}
                  onChange={(e) => {
                    const rows = [...block.rows]; rows[idx] = { ...row, desc: e.target.value };
                    onChange({ ...block, rows });
                  }} />
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" className="w-full"
            onClick={() => onChange({ ...block, rows: [...block.rows, { id: uid('row'), name: '', desc: '', qnt: '' } as TableRow] })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar linha
          </Button>
        </>
      )}

      {block.type === 'total' && (
        <>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Modo:</Label>
            <Select value={block.mode} onValueChange={(v: 'single' | 'setup') => onChange({ ...block, mode: v })}>
              <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Total único (mensal)</SelectItem>
                <SelectItem value="setup">Setup + Mensalidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.mode === 'single' ? (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Rótulo (TOTAL)" value={block.label || ''} onChange={(e) => onChange({ ...block, label: e.target.value })} />
              <Input placeholder="Valor (R$ 8.500,00/mês)" value={block.value || ''} onChange={(e) => onChange({ ...block, value: e.target.value })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Rótulo setup" value={block.setupLabel || ''} onChange={(e) => onChange({ ...block, setupLabel: e.target.value })} />
              <Input placeholder="Valor setup (R$ 1.000,00 única vez)" value={block.setupValue || ''} onChange={(e) => onChange({ ...block, setupValue: e.target.value })} />
              <Input placeholder="Rótulo mensalidade" value={block.monthlyLabel || ''} onChange={(e) => onChange({ ...block, monthlyLabel: e.target.value })} />
              <Input placeholder="Valor mensalidade (R$ 400/mês)" value={block.monthlyValue || ''} onChange={(e) => onChange({ ...block, monthlyValue: e.target.value })} />
            </div>
          )}
        </>
      )}

      {block.type === 'terms' && (
        <>
          <Input placeholder="Título (Termos & Condições)"
            value={block.title || ''} onChange={(e) => onChange({ ...block, title: e.target.value })} />
          <Textarea placeholder="Texto (use **negrito** para destacar trechos)" rows={5}
            value={block.body || ''} onChange={(e) => onChange({ ...block, body: e.target.value })} />
        </>
      )}

      {block.type === 'spacer' && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Altura (px)</Label>
          <Input type="number" className="h-8 w-24" value={block.height ?? 20}
            onChange={(e) => onChange({ ...block, height: Number(e.target.value) })} />
        </div>
      )}
    </div>
  );
}
