/**
 * Brand Core do cliente: o que cada tipo de peça guarda (campos, rótulos e dicas) e as regras puras de limpeza e
 * completude. A tabela `client_brand_items` guarda tudo em `data` (jsonb); quem define a forma é este arquivo.
 */

export type TipoDeItem = 'diagnosis' | 'persona' | 'competitor' | 'offer';

export interface CampoDef {
  chave: string;
  rotulo: string;
  dica?: string;
  tipo: 'texto' | 'longo' | 'select';
  opcoes?: { valor: string; rotulo: string }[];
  /** Conta na completude do item. */
  essencial?: boolean;
}

export interface SecaoDef {
  tipo: TipoDeItem;
  /** Uma peça só por cliente (diagnóstico) ou várias. */
  unico: boolean;
  titulo: string;
  ajuda: string;
  singular: string;
  /** Texto do botão de adicionar. */
  adicionar: string;
  vazio: { titulo: string; texto: string };
  /** Campo que dá nome ao cartão. */
  campoTitulo?: string;
  /** Campo mostrado como segunda linha do cartão. */
  campoResumo?: string;
  campos: CampoDef[];
}

export const LIMITE_CAMPO = 4000;

const ETAPAS_DA_ESTEIRA = [
  { valor: 'isca', rotulo: '1. Isca / Gratuito' },
  { valor: 'entrada', rotulo: '2. Entrada' },
  { valor: 'principal', rotulo: '3. Principal' },
  { valor: 'premium', rotulo: '4. Premium' },
  { valor: 'recorrente', rotulo: '5. Recorrente' },
];

export const SECOES: Record<TipoDeItem, SecaoDef> = {
  diagnosis: {
    tipo: 'diagnosis',
    unico: true,
    titulo: 'Diagnóstico do perfil',
    ajuda: 'O raio-x do perfil hoje: o que está bom, o que está fraco e onde estão as oportunidades.',
    singular: 'diagnóstico',
    adicionar: 'Fazer o diagnóstico',
    vazio: { titulo: 'Diagnóstico ainda não feito', texto: 'Registre como o perfil está hoje para medir a evolução depois.' },
    campos: [
      { chave: 'perfil_url', rotulo: 'Perfil analisado', dica: '@ ou link do perfil principal.', tipo: 'texto', essencial: true },
      { chave: 'bio', rotulo: 'Bio atual', dica: 'Copie a bio como está hoje.', tipo: 'longo' },
      { chave: 'identidade_visual', rotulo: 'Identidade visual do feed', dica: 'Cores, padrão de capas, consistência, qualidade das imagens.', tipo: 'longo', essencial: true },
      { chave: 'conteudo_atual', rotulo: 'O que é publicado hoje', dica: 'Formatos, frequência, temas, quem aparece.', tipo: 'longo', essencial: true },
      { chave: 'resposta_do_publico', rotulo: 'Como o público responde', dica: 'O que gera mais curtidas, comentários, salvamentos e mensagens.', tipo: 'longo' },
      { chave: 'pontos_fortes', rotulo: 'Pontos fortes', tipo: 'longo', essencial: true },
      { chave: 'pontos_fracos', rotulo: 'Pontos fracos', tipo: 'longo', essencial: true },
      { chave: 'oportunidades', rotulo: 'Oportunidades', dica: 'O que dá para fazer nos próximos meses.', tipo: 'longo', essencial: true },
      { chave: 'observacoes', rotulo: 'Observações', tipo: 'longo' },
    ],
  },
  persona: {
    tipo: 'persona',
    unico: false,
    titulo: 'Personas',
    ajuda: 'Quem compra do cliente. Uma ficha por perfil de comprador, com dores, desejos e o jeito de falar.',
    singular: 'persona',
    adicionar: 'Adicionar persona',
    vazio: { titulo: 'Nenhuma persona ainda', texto: 'Comece pela pessoa que mais compra. Depois acrescente as outras.' },
    campoTitulo: 'nome',
    campoResumo: 'resumo',
    campos: [
      { chave: 'nome', rotulo: 'Nome da persona', dica: 'Ex.: Mariana, a empreendedora ocupada.', tipo: 'texto', essencial: true },
      { chave: 'resumo', rotulo: 'Quem é', dica: 'Idade, profissão, momento de vida.', tipo: 'longo', essencial: true },
      { chave: 'onde_esta', rotulo: 'Onde está', dica: 'Redes, horários e como consome conteúdo.', tipo: 'longo' },
      { chave: 'dores', rotulo: 'Dores', dica: 'O que incomoda e a faz buscar uma solução.', tipo: 'longo', essencial: true },
      { chave: 'desejos', rotulo: 'Desejos', dica: 'O que ela quer alcançar.', tipo: 'longo', essencial: true },
      { chave: 'objetivos', rotulo: 'Objetivos', tipo: 'longo' },
      { chave: 'objecoes', rotulo: 'Objeções', dica: 'O que a faz hesitar antes de comprar.', tipo: 'longo' },
      { chave: 'como_fala', rotulo: 'Como fala', dica: 'Frases, gírias e termos que ela usa de verdade.', tipo: 'longo' },
      { chave: 'gatilhos', rotulo: 'O que faz comprar', tipo: 'longo' },
    ],
  },
  competitor: {
    tipo: 'competitor',
    unico: false,
    titulo: 'Concorrência',
    ajuda: 'Quem disputa o mesmo público e como se diferenciar de cada um.',
    singular: 'concorrente',
    adicionar: 'Adicionar concorrente',
    vazio: { titulo: 'Nenhum concorrente ainda', texto: 'Registre de três a cinco, entre diretos e referências.' },
    campoTitulo: 'nome',
    campoResumo: 'posicionamento',
    campos: [
      { chave: 'nome', rotulo: 'Nome', tipo: 'texto', essencial: true },
      { chave: 'perfil_url', rotulo: 'Perfil ou site', dica: '@ ou link.', tipo: 'texto', essencial: true },
      {
        chave: 'tipo', rotulo: 'Tipo', tipo: 'select',
        opcoes: [
          { valor: 'direto', rotulo: 'Concorrente direto' },
          { valor: 'indireto', rotulo: 'Concorrente indireto' },
          { valor: 'referencia', rotulo: 'Referência (outro mercado)' },
        ],
      },
      { chave: 'posicionamento', rotulo: 'Posicionamento', dica: 'Como se apresenta ao mercado.', tipo: 'longo', essencial: true },
      { chave: 'conteudo', rotulo: 'Conteúdo e frequência', dica: 'O que publica e com que regularidade.', tipo: 'longo' },
      { chave: 'pontos_fortes', rotulo: 'Pontos fortes', tipo: 'longo' },
      { chave: 'pontos_fracos', rotulo: 'Pontos fracos', tipo: 'longo' },
      { chave: 'diferenciar', rotulo: 'Como nos diferenciar', dica: 'O que o nosso cliente pode fazer de diferente.', tipo: 'longo', essencial: true },
    ],
  },
  offer: {
    tipo: 'offer',
    unico: false,
    titulo: 'Esteira de ofertas',
    ajuda: 'Os produtos e serviços do cliente, do mais acessível ao mais completo, para o conteúdo vender com estratégia.',
    singular: 'oferta',
    adicionar: 'Adicionar oferta',
    vazio: { titulo: 'Nenhuma oferta ainda', texto: 'Liste o que o cliente vende, começando pela porta de entrada.' },
    campoTitulo: 'nome',
    campoResumo: 'preco',
    campos: [
      { chave: 'nome', rotulo: 'Nome da oferta', tipo: 'texto', essencial: true },
      { chave: 'etapa', rotulo: 'Etapa da esteira', tipo: 'select', opcoes: ETAPAS_DA_ESTEIRA, essencial: true },
      { chave: 'preco', rotulo: 'Preço', dica: 'Ex.: R$ 197, ou "sob consulta".', tipo: 'texto', essencial: true },
      { chave: 'publico', rotulo: 'Para quem é', tipo: 'longo' },
      { chave: 'descricao', rotulo: 'O que entrega', tipo: 'longo', essencial: true },
      { chave: 'conteudo_para_vender', rotulo: 'Como o conteúdo deve vender isso', dica: 'Ângulos, provas e chamadas que funcionam.', tipo: 'longo' },
      { chave: 'link', rotulo: 'Link da oferta', tipo: 'texto' },
    ],
  },
};

export type DadosDoItem = Record<string, string>;

/** Mantém só os campos conhecidos do tipo, como texto aparado e limitado. Valor de `select` fora das opções vira vazio. */
export function limparDados(def: SecaoDef, bruto: unknown): DadosDoItem {
  const origem = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const out: DadosDoItem = {};
  for (const c of def.campos) {
    const v = origem[c.chave];
    let s = typeof v === 'string' ? v.trim().slice(0, LIMITE_CAMPO) : '';
    if (c.tipo === 'select' && !c.opcoes?.some(o => o.valor === s)) s = '';
    if (s) out[c.chave] = s;
  }
  return out;
}

export function completude(def: SecaoDef, dados: DadosDoItem): { preenchidos: number; total: number; faltando: string[] } {
  const essenciais = def.campos.filter(c => c.essencial);
  const faltando = essenciais.filter(c => !(dados[c.chave] ?? '').trim()).map(c => c.rotulo);
  return { preenchidos: essenciais.length - faltando.length, total: essenciais.length, faltando };
}

export function tituloDoItem(def: SecaoDef, dados: DadosDoItem): string {
  const t = def.campoTitulo ? (dados[def.campoTitulo] ?? '').trim() : '';
  return t || `Sem nome`;
}

export function resumoDoItem(def: SecaoDef, dados: DadosDoItem): string {
  const campo = def.campos.find(c => c.chave === def.campoResumo);
  const bruto = (def.campoResumo ? (dados[def.campoResumo] ?? '') : '').trim();
  if (!bruto) return '';
  const texto = campo?.tipo === 'select' ? campo.opcoes?.find(o => o.valor === bruto)?.rotulo ?? bruto : bruto;
  return texto.length > 140 ? `${texto.slice(0, 139).trimEnd()}…` : texto;
}

/** Ordem da esteira: isca → recorrente; sem etapa vai para o fim. Dentro da etapa, mantém a ordem dada. */
export function ordenarEsteira<T extends { data: DadosDoItem }>(itens: T[]): T[] {
  const ordem = ETAPAS_DA_ESTEIRA.map(e => e.valor);
  const pos = (i: T) => {
    const k = ordem.indexOf(i.data.etapa ?? '');
    return k === -1 ? ordem.length : k;
  };
  return itens.map((item, idx) => ({ item, idx })).sort((a, b) => pos(a.item) - pos(b.item) || a.idx - b.idx).map(x => x.item);
}

export function rotuloDaEtapa(valor: string | undefined): string {
  return ETAPAS_DA_ESTEIRA.find(e => e.valor === valor)?.rotulo ?? '';
}
