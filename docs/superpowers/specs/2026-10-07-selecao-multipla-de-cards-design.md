# Seleção múltipla de cards (duplicar e arquivar em lote)

Data: 2026-10-07 · Escopo: Kanban e Lista da página de tarefas (`/tasks`).

## Objetivo
Permitir marcar vários cards e, de uma vez, duplicá-los (no mesmo espaço ou em outro) ou arquivá-los.
No Flowalt "excluir" é arquivar (`status = 'archived'`); não há exclusão permanente.

## Fora do escopo
Mover em lote, trocar responsável em lote, Agenda/Calendário, exclusão permanente.

## Seleção
- Caixinha por card (Kanban e Lista), visível ao passar o mouse; ao marcar a primeira, todas ficam visíveis e clicar no card marca/desmarca em vez de abrir.
- Lista: caixinha no cabeçalho marca todos os cards visíveis (estado intermediário quando parcial).
- Kanban: caixinha no título da coluna seleciona a coluna inteira.
- Shift+clique seleciona intervalo na Lista. Esc ou "Limpar" encerra.
- Vale só para cards visíveis (respeita filtros); trocar de espaço/página limpa a seleção.
- Arrastar e soltar segue igual fora do modo de seleção; em modo de seleção o arraste de card marcado é desativado para não haver gesto ambíguo.

## Barra de ações
Fixa embaixo, centralizada, só com ≥1 selecionado; aparece e some com transição curta (respeita prefers-reduced-motion).
Conteúdo: "N selecionados" · Duplicar · Duplicar para outro espaço… · Arquivar (destrutivo, separado visualmente) · Limpar.
- Duplicar: cópia na mesma coluna, título com "(cópia)", reaproveitando a lógica de cópia existente.
- Para outro espaço: popover ancorado à barra com espaço de destino e modo (cópia/espelho), como no menu do card.
- Arquivar: diálogo de confirmação ("Arquivar N cards? Saem do quadro, não são apagados").
- Anúncio por leitor de tela (aria-live) da contagem; todos os controles alcançáveis por teclado, foco visível.

## Permissões
Arquivar segue a regra atual: admin ou criador do card. Em seleção mista arquiva-se o permitido; o aviso final informa os ignorados. Botão desativado, com explicação, se nenhum selecionado for permitido. Duplicar segue a permissão de criar card no espaço de destino.

## Execução e erros
Operação em lote por ação, cada card independente (falha de um não derruba os outros). Resumo final em aviso ("5 duplicados, 1 falhou"), com possibilidade de desfazer o arquivamento no próprio aviso. Uma única invalidação de cache ao final.

## Estrutura
- `src/lib/cards/bulk.ts` (+ teste): separa permitidos/ignorados, monta resumo.
- `src/hooks/useCardSelection.ts`: estado da seleção (ids, intervalo, limpar).
- `src/hooks/useBulkCardActions.ts`: duplicar e arquivar em lote.
- `src/components/cards/CardSelectionBar.tsx`: barra.
- Ajustes em `DraggableCard`, `ListView`, `KanbanWithColumns`, `TasksPage`.

## Design
Seguir o sistema visual atual (tokens, roxo da marca, cantos e sombras dos popovers). Barra com superfície elevada e contraste AA, alvo de toque ≥40px, destrutivo em cor de alerta só no hover/foco e no diálogo. Caixinhas não deslocam o layout do card (ocupam espaço já reservado). Estado selecionado: contorno de marca + fundo sutil, nunca só cor.

## Testes
Unitários de `bulk.ts`; verificação no Chrome (Kanban e Lista) como sócio e como membro comum (permissão de arquivar), incluindo teclado.
