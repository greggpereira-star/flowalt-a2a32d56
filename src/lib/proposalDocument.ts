// Modelo de documento do Gerador de Propostas ALT.
// Estrutura por blocos — nada engessado: cada bloco tem estilos próprios.

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TextStyle {
  fontFamily?: string;   // ex.: 'Poppins', 'Inter', 'Archivo Black'
  fontSize?: number;     // px
  fontWeight?: number;   // 400..900
  align?: TextAlign;
  color?: string;
  italic?: boolean;
  letterSpacing?: number;
}

// Blocos de conteúdo -------------------------------------------------
export interface SectionBlock {
  id: string;
  type: 'section';
  title?: string;         // ex.: "1 - Comunicação Estratégica"
  body?: string;          // suporta **negrito** e quebras de linha
  titleStyle?: TextStyle;
  bodyStyle?: TextStyle;
  gap?: number;           // espaço antes do bloco (px)
}

export interface SubsectionBlock {
  id: string;
  type: 'subsection';
  title?: string;
  body?: string;
  indent?: boolean;       // recuo à esquerda
  titleStyle?: TextStyle;
  bodyStyle?: TextStyle;
  gap?: number;
}

export interface TableRow {
  id: string;
  name: string;           // "Social Media"
  desc?: string;          // descrição menor
  qnt?: string;           // "12 posts/mês"
}
export interface TableBlock {
  id: string;
  type: 'table';
  headerLeft?: string;    // "Descrição"
  headerRight?: string;   // "Qnt"
  rows: TableRow[];
  gap?: number;
}

export interface TotalBlock {
  id: string;
  type: 'total';
  mode: 'single' | 'setup';   // single: TOTAL R$ x | setup: SETUP + Mensalidade
  label?: string;             // "TOTAL"
  value?: string;             // "R$ 8.500,00/mês"
  valueBold?: boolean;
  setupLabel?: string;        // "SETUP/IMPLEMENTAÇÃO"
  setupValue?: string;        // "R$ 1.000,00 única vez"
  monthlyLabel?: string;      // "Mensalidade"
  monthlyValue?: string;      // "R$ 400/mês"
  gap?: number;
}

export interface TermsBlock {
  id: string;
  type: 'terms';
  title?: string;             // "Termos & Condições"
  body?: string;              // suporta **negrito**
  gap?: number;
}

export interface SpacerBlock {
  id: string;
  type: 'spacer';
  height?: number;            // px
}

export type ProposalBlock =
  | SectionBlock | SubsectionBlock | TableBlock | TotalBlock | TermsBlock | SpacerBlock;

// Opção (cada "Orçamento 1/2/3" é uma página) ------------------------
export interface ProposalOption {
  id: string;
  title: string;              // "Orçamento 1" ou "Orçamento"
  tier?: string;              // "Essencial" / "Avançado" (subtítulo)
  blocks: ProposalBlock[];
  // dados p/ contrato (ao aprovar esta opção)
  priceValue?: number;        // valor numérico p/ MRR
  priceKind?: 'monthly' | 'oneoff';
}

// Tema global --------------------------------------------------------
export interface ProposalTheme {
  titleFont: string;          // fonte do título "Orçamento"
  titleFontSize?: number;     // tamanho do título (px)
  bodyFont: string;           // fonte do corpo
  sidebarText: string;        // texto vertical da faixa lateral
  sidebarFont?: string;       // fonte da faixa lateral
  sidebarFontSize: number;    // tamanho da fonte da faixa lateral
  sidebarWeight?: number;     // peso da fonte da faixa lateral
}

export interface ProposalDocumentModel {
  theme: ProposalTheme;
  clientName: string;
  date: string;               // dd/mm/aa
  options: ProposalOption[];
}

// Fontes disponíveis no seletor
export const PROPOSAL_FONTS = [
  'Poppins', 'Inter', 'Montserrat', 'Archivo Black', 'Anton',
  'Helvetica Neue', 'Arial',
] as const;

export const DEFAULT_THEME: ProposalTheme = {
  titleFont: 'Poppins',
  titleFontSize: 74,
  bodyFont: 'Inter',
  sidebarText: 'estratégia, gestão e comunicação',
  sidebarFont: 'Inter',
  sidebarFontSize: 50,
  sidebarWeight: 600,
};

let _seq = 0;
export const uid = (p = 'b') => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;

// Documento inicial (exemplo pronto p/ editar)
export function createEmptyDocument(clientName = '', date = ''): ProposalDocumentModel {
  return {
    theme: { ...DEFAULT_THEME },
    clientName,
    date: date || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    options: [createEmptyOption('Orçamento 1')],
  };
}

export function createEmptyOption(title = 'Orçamento'): ProposalOption {
  return {
    id: uid('opt'),
    title,
    blocks: [
      { id: uid(), type: 'section', title: 'Operação Mensal de Comunicação', body: 'Descreva aqui o escopo geral desta proposta.' },
      { id: uid(), type: 'total', mode: 'single', label: 'TOTAL', value: 'R$ 0,00/mês', valueBold: true },
      { id: uid(), type: 'terms', title: 'Termos & Condições', body: 'Os serviços serão iniciados mediante aprovação do orçamento. As entregas seguem o escopo contratado, e solicitações adicionais ou fora do planejamento serão orçadas à parte. Estão inclusas até duas revisões por entrega. Os prazos consideram o envio completo das informações e materiais necessários por parte do cliente. Não estão inclusos custos de mídia, impressão ou serviços de terceiros. As condições de pagamento serão definidas conforme a proposta aprovada.' },
    ],
    priceKind: 'monthly',
  };
}

// Clona um bloco gerando novos ids (para duplicar)
export function cloneBlock(block: ProposalBlock): ProposalBlock {
  const copy: any = JSON.parse(JSON.stringify(block));
  copy.id = uid();
  if (copy.type === 'table' && Array.isArray(copy.rows)) {
    copy.rows = copy.rows.map((r: any) => ({ ...r, id: uid('row') }));
  }
  return copy;
}

// Converte **negrito** + quebras de linha em HTML seguro (conteúdo interno da agência)
export function richToHtml(text: string | undefined): string {
  if (!text) return '';
  const esc = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}
