
# Plano: Espaços Livres + Templates Salvos

## Resumo Executivo

Modificar o comportamento dos Espaços para que todos comecem "em branco" (sem estrutura pré-definida), exceto o **Social Media** que mantém sua estrutura padronizada. Adicionar a funcionalidade de **salvar templates de espaço** personalizados para reutilização futura.

---

## Mudanças de Comportamento

### Antes
- Cada tipo de espaço (Designer, Audiovisual, etc.) aplicava automaticamente pastas e views do template definido em `spaceTemplates.ts`
- Estrutura era "imposta" ao criar o espaço

### Depois  
- Todos os espaços começam vazios (exceto Social Media)
- Usuário cria Pastas manualmente
- Dentro de cada Pasta, cria Views (Kanban, Lista, Calendário, Gantt, Mapa Mental)
- Templates são opcionais e servem para acelerar, não para "engessar"

---

## Alterações Necessárias

### 1. Modificar `src/lib/spaceTemplates.ts`

Simplificar templates para que apenas `social_media` tenha estrutura automática:

```text
- blank: mantém vazio (já está assim)
- social_media: MANTÉM estrutura completa com pastas e views
- designer: folders = [], views = [] (apenas metadados)
- audiovisual: folders = [], views = [] (apenas metadados)
- administrative: folders = [], views = [] (apenas metadados)
```

Os templates ficam apenas como "sugestões visuais" no wizard de criação, sem criar estrutura.

---

### 2. Modificar `src/hooks/useSpaces.ts`

Na função `applyTemplateToSpace`:
- Verificar se o template é `social_media` antes de criar pastas/views automaticamente
- Para outros tipos, não aplicar estrutura automática

---

### 3. Criar Estado Vazio para Espaços

Novo componente: `src/components/spaces/EmptySpaceState.tsx`

Quando um espaço não tem pastas nem views, mostrar:
- Mensagem de boas-vindas
- Botões para criar Views: Kanban | Lista | Calendário | Gantt | Mapa Mental
- Instrução: "Crie uma pasta para começar a organizar seus cards"

---

### 4. Atualizar `src/pages/SpacePage.tsx`

Detectar quando:
- `folders?.length === 0` (espaço vazio)
- Não tem `activeView`

Se estiver vazio, renderizar `<EmptySpaceState>` com opções de criação.

---

### 5. Atualizar `src/components/spaces/SpaceTreeNav.tsx`

- Para espaços vazios, mostrar mensagem convidativa: "Nenhuma pasta. Clique em + para criar"
- Manter comportamento atual para Social Media (já funciona bem)

---

### 6. Criar Funcionalidade de Salvar Template de Espaço

#### 6.1 Novo componente: `src/components/spaces/SaveSpaceAsTemplateDialog.tsx`

Dialog para salvar a estrutura atual de um espaço como template reutilizável:
- Nome do template
- Descrição (opcional)
- Preview das pastas e views que serão salvas

#### 6.2 Nova tabela no banco (já existe `space_templates`, usar ela)

Aproveitar a tabela existente `space_templates` para templates customizados do workspace.

#### 6.3 Novo hook: `src/hooks/useSpaceTemplateActions.ts`

```typescript
// Funções:
- useSaveSpaceAsTemplate(): Salvar estrutura atual do espaço
- useUserSpaceTemplates(): Listar templates do usuário/workspace
- useApplyUserTemplate(): Aplicar template a um espaço existente
```

---

### 7. Adicionar Opção no Menu do Espaço

Em `SpaceTreeNav.tsx` ou no header do espaço:
- Menu de contexto com "Salvar como Template"
- Abre o `SaveSpaceAsTemplateDialog`

---

### 8. Atualizar Dialog de Criação de Espaço

`src/components/settings/CreateSpaceDialog.tsx`:
- Na seleção de templates, incluir templates salvos pelo usuário
- Seção separada: "Templates do Sistema" vs "Seus Templates"
- Templates do usuário podem ser deletados

---

## Fluxo do Usuário

```text
1. Usuário clica em um Espaço (ex: Administrativo)
   ↓
2. Espaço abre VAZIO (sem pastas, sem views)
   ↓
3. Tela mostra Empty State com opções:
   [+ Nova Pasta] 
   ↓
4. Ao criar pasta, pode escolher views:
   [Kanban] [Lista] [Calendário] [Gantt] [Mapa Mental]
   ↓
5. Usuário monta estrutura livremente
   ↓
6. Se quiser, clica em "Salvar como Template"
   ↓
7. Template fica disponível para reutilizar
```

---

## Exceção: Social Media

O fluxo para `social_media` permanece diferente:
- Ao criar, aplica automaticamente estrutura padronizada
- Pastas por colaborador continuam funcionando
- Views específicas (Calendário Editorial, Aprovações) são criadas

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/lib/spaceTemplates.ts` | Modificar - Remover estrutura automática exceto Social Media |
| `src/hooks/useSpaces.ts` | Modificar - Condicionar apply template só para social_media |
| `src/components/spaces/EmptySpaceState.tsx` | **Criar** - Novo estado vazio com CTAs |
| `src/pages/SpacePage.tsx` | Modificar - Renderizar EmptySpaceState quando vazio |
| `src/components/spaces/SaveSpaceAsTemplateDialog.tsx` | **Criar** - Dialog para salvar template |
| `src/hooks/useSpaceTemplateActions.ts` | **Criar** - Hooks para gerenciar templates |
| `src/components/settings/CreateSpaceDialog.tsx` | Modificar - Incluir templates do usuário |
| `src/components/spaces/SpaceTreeNav.tsx` | Modificar - Adicionar opção "Salvar como Template" |

---

## Detalhes Técnicos

### Migração de Banco de Dados

Precisaremos adicionar colunas à tabela `space_templates` existente:

```sql
ALTER TABLE space_templates 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_user_template BOOLEAN DEFAULT false;
```

Isso permitirá distinguir templates do sistema vs templates do usuário.

### RLS para Templates do Usuário

```sql
-- Usuários podem ver seus próprios templates + templates do sistema
CREATE POLICY "Users can view own and system templates" ON space_templates
FOR SELECT USING (
  workspace_id IS NULL -- template do sistema
  OR workspace_id = (SELECT current_workspace_id())
);

-- Apenas admins podem criar templates
CREATE POLICY "Admins can create templates" ON space_templates
FOR INSERT WITH CHECK (
  workspace_id = (SELECT current_workspace_id())
  AND is_admin()
);
```

---

## Estimativa de Esforço

- **Fase 1** - Espaços em branco: ~30 min
- **Fase 2** - Empty State: ~15 min  
- **Fase 3** - Salvar como Template: ~45 min
- **Fase 4** - Listagem/Aplicação de Templates: ~30 min

**Total estimado**: ~2 horas de implementação

