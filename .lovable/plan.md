
# Plano: Habilitar Views Gantt, Calendário e Mapa Mental

## Resumo

Remover as restrições "Em breve" e habilitar as views **Gantt**, **Calendário** e **Mapa Mental** para uso em todos os espaços.

---

## Análise do Estado Atual

| View | Componente Existente | Status |
|------|---------------------|--------|
| Kanban | `KanbanBoard.tsx`, `KanbanAdvanced.tsx` | Funcionando |
| Lista | `ListView.tsx` | Funcionando |
| Calendário | `CalendarView.tsx` (agenda), parcial em SpacePage | Placeholder |
| Gantt | `GanttAdvanced.tsx` (coordenação) | Existe, não integrado |
| Mapa Mental | Não existe | Precisa criar |

---

## Alterações Necessárias

### 1. Remover Restrição "Em breve" do Dialog

**Arquivo:** `src/components/social-media/CreateViewDialog.tsx`

Remover a propriedade `coming: true` das opções Gantt e Mapa Mental no array `DEFAULT_VIEW_TYPES`.

---

### 2. Adicionar View Types no SpacePage

**Arquivo:** `src/pages/SpacePage.tsx`

Adicionar 'gantt' e 'mindmap' ao type `ViewType`:

```text
type ViewType = 'kanban' | 'kanban-advanced' | 'list' | 'calendar' | 'gantt' | 'mindmap' | ...
```

Adicionar mapeamento no `getViewTypeFromConfig`:

```text
if (viewType === 'gantt') return 'gantt';
if (viewType === 'mindmap') return 'mindmap';
```

---

### 3. Criar Componente de Calendário para Espaços

**Novo arquivo:** `src/components/cards/CalendarBoardView.tsx`

Componente que exibe cards em formato de calendário mensal, similar ao `CalendarView.tsx` mas focado em cards do espaço:

- Grid de calendário mensal
- Cards posicionados pela `due_date`
- Navegação entre meses
- Click em card abre detalhes

---

### 4. Criar Componente de Mapa Mental

**Novo arquivo:** `src/components/cards/MindMapView.tsx`

Componente de visualização hierárquica de cards:

- Nó central = Espaço ou Pasta
- Nós secundários = Cards agrupados por status
- Conexões visuais entre nós
- Expansão/colapso de grupos
- Click em card abre detalhes

---

### 5. Integrar Gantt no SpacePage

**Arquivo:** `src/pages/SpacePage.tsx`

Reutilizar o componente `GanttAdvanced.tsx` existente, adaptando para receber cards do espaço/pasta atual.

---

### 6. Renderizar Views no SpacePage

**Arquivo:** `src/pages/SpacePage.tsx`

Adicionar condicionais para renderizar os novos componentes:

```text
} : view === 'calendar' ? (
  <CalendarBoardView cards={filteredCards} onCardClick={handleCardClick} />
) : view === 'gantt' ? (
  <GanttAdvanced cards={filteredCards} dependencies={[]} onCardClick={...} />
) : view === 'mindmap' ? (
  <MindMapView cards={filteredCards} onCardClick={handleCardClick} spaceName={space.name} />
) : (
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/cards/CalendarBoardView.tsx` | Calendário de cards por due_date |
| `src/components/cards/MindMapView.tsx` | Visualização hierárquica de cards |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/social-media/CreateViewDialog.tsx` | Remover `coming: true` |
| `src/pages/SpacePage.tsx` | Adicionar types + renderização |
| `src/components/spaces/EmptySpaceState.tsx` | Atualizar para incluir todas as views |

---

## Fluxo Final do Usuário

```text
1. Usuário clica em "Nova View" dentro de uma pasta
   ↓
2. Dialog mostra 5 opções habilitadas:
   [Kanban] [Lista] [Calendário] [Gantt] [Mapa Mental]
   ↓
3. Usuário seleciona qualquer uma
   ↓
4. View é criada e renderizada corretamente
```

---

## Detalhes Técnicos

### CalendarBoardView
- Usa `date-fns` para manipulação de datas (já instalado)
- Grid 7 colunas × 5-6 linhas
- Cards aparecem no dia da `due_date`
- Suporte a drag-and-drop para mover datas

### MindMapView
- Layout radial ou hierárquico usando CSS Grid/Flexbox
- Sem dependências externas adicionais
- Cards agrupados por status no primeiro nível
- Animações de expansão/colapso
- Cores por status do card

### GanttAdvanced Integration
- Componente já existe e funciona bem
- Precisa passar dependencies vazio `[]` inicialmente
- Cards são mapeados por `start_date` e `due_date`

---

## Estimativa

- Remover restrições + integrar Gantt: ~15 min
- CalendarBoardView: ~30 min
- MindMapView: ~45 min
- Testes e ajustes: ~15 min

**Total: ~1h45min**
