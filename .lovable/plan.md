# Plano — Banco de Ideias / Central Criativa

Reconstrução completa do módulo. Hoje é uma lista/formulário (`IdeasBankView.tsx`) usando `ideas_bank`. Vamos virar uma experiência visual estilo Pinterest/Milanote, integrada a Pastas/Espaços e ao fluxo de Cards do FlowAlt.

Para caber bem e não virar um PR gigante e instável, proponho **3 fases**. Fase 1 entrega o aceite visual/funcional. Fases 2 e 3 são incrementos.

---

## Fase 1 — MVP visual + integração com cards (entra agora)

### 1.1 Banco de dados (migração única)

Novas tabelas (com `workspace_id`, RLS multi-tenant, GRANTs, triggers `updated_at`):

- **`idea_boards`** — pastas/coleções
  `id, workspace_id, space_id?, folder_id?, name, description, cover_url, category, tags[], created_by, created_at, updated_at, archived_at`
- **`idea_references`** — referências dentro de uma board
  `id, workspace_id, board_id, type (enum), title, description, source_url, thumbnail_url, media_url, file_url, file_name, tags[], category, client_id?, created_by, is_favorite, ai_tags, ai_category, ai_summary, ai_suggestions(jsonb), ai_confidence, created_at, updated_at, archived_at`
- **`idea_comments`** — comentários por referência
- **`idea_card_links`** — vínculo `reference_id ↔ card_id`
- **`idea_audit_log`** — auditoria (create/edit/delete/move/card-from-idea)

Enum `idea_reference_type`: `image, video, link, file, document, text, copy, ad, layout, moodboard, competitor, inspiration, campaign`.

**RLS:** todos por `workspace_id` + `has_workspace_access(...)`. Delete em board exige role Owner/Admin/Coordenador via `has_role`/membership. Logs imutáveis (sem update/delete via cliente).

**Migração de dados:** criar uma board “Referências importadas” por workspace que tem `ideas_bank` e migrar registros existentes para `idea_references` mantendo `folder_id` original. (Mantemos `ideas_bank` por compatibilidade, sem quebrar.)

**Storage:** bucket privado `idea-references` para uploads de imagem/vídeo/PDF, signed URLs.

### 1.2 Estrutura de páginas/componentes

```text
src/pages/IdeasBankPage.tsx                  ← rota global /ideas
src/components/ideas-bank/
  ├─ BoardsGalleryView.tsx                   ← tela inicial (grid de pastas)
  ├─ BoardCard.tsx                           ← capa + meta + menu
  ├─ BoardMoodboardView.tsx                  ← masonry da pasta (Pinterest-like)
  ├─ ReferenceCard.tsx                       ← card masonry (image/video/link/file/text)
  ├─ ReferenceDetailSheet.tsx                ← drawer lateral / modal mobile
  ├─ AddReferenceDialog.tsx                  ← upload + link + texto, com preview
  ├─ CreateBoardDialog.tsx
  ├─ CreateCardFromIdeaDialog.tsx            ← reaproveita fluxo de Card rápido / Briefing
  ├─ IdeasFiltersBar.tsx                     ← busca, filtros, ordenação, toggle grid/lista
  ├─ EmptyBoards.tsx / EmptyMoodboard.tsx
  └─ hooks/
      ├─ useIdeaBoards.ts
      ├─ useIdeaReferences.ts
      ├─ useIdeaComments.ts
      └─ useLinkPreview.ts                   ← captura OG via edge function
```

- **Módulo global:** entrada no sidebar “Banco de Ideias” → `IdeasBankPage` (grid de boards do workspace).
- **View dentro de Pasta:** novo tipo de view `ideas_bank` em `CreateViewDialog` / `FolderViewSwitcher` que renderiza `BoardMoodboardView` filtrado por `folder_id` (auto-cria/usa uma board ligada ao folder).

### 1.3 Edge function

- `link-preview` — recebe URL, busca Open Graph (title, image, description, domain), retorna JSON. Tratamento de erro → cai pra edição manual.

### 1.4 UX/Comportamento (não negociável)

- Clique na **pasta** abre o **moodboard**, nunca o formulário.
- Masonry com `CSS columns` (sem libs extras), alturas variadas, ícone de tipo no canto, tags chips, hover com ações rápidas.
- Detalhe da referência abre em **Sheet lateral (desktop)** / **Dialog full-screen (mobile)**.
- Botão flutuante “+” no mobile.
- Estados vazios com CTA conforme spec (seções 12).
- Toda mudança crítica grava em `idea_audit_log`.

### 1.5 Criar card a partir da ideia

- `CreateCardFromIdeaDialog` pergunta: Espaço → Pasta → View, Tipo (Card rápido | Nova demanda briefing), Responsável, Prazo (datetime), Urgência.
- Pré-preenche título/descrição/tags/anexos.
- Insere em `cards` (fluxo existente) + cria `idea_card_links`.
- Card recebe metadado `source: { type: 'idea', board_id, reference_id }` em `custom_fields` para exibir “Origem: Banco de Ideias / Pasta / Referência” no detalhe do card.

### 1.6 Permissões (RBAC existente)

- Owner/Admin: tudo
- Coordenador: criar/editar/excluir/mover/organizar
- Member: criar referências + comentar + criar card
- Viewer: somente leitura
- Reaproveita `usePermissions` + `has_role` no Postgres.

---

## Fase 2 — Inteligência (entra depois do MVP estabilizado)

- Edge function `idea-ai-enrich` (Lovable AI Gateway, `google/gemini-2.5-flash`):
  - Ao criar/atualizar referência → preenche `ai_tags`, `ai_category`, `ai_summary`, `ai_suggestions` (ângulo, CTA, formato, público).
- UI: bloco “Sugestões inteligentes” no detalhe da referência, com botão “Aplicar tags sugeridas”.
- Para imagens/prints de anúncio: vision (gemini-2.5-pro) com prompt focado em copy/ângulo.

## Fase 3 — Refinos

- Drag-and-drop entre boards.
- Seleção múltipla → mover / criar card em lote / arquivar.
- Compartilhamento de board com link público read-only.
- Favoritos por usuário (tabela `idea_favorites` por user) — hoje fica como contador simples na referência.
- Visualização Lista compacta (toggle já existe na barra, mas implementação mínima na fase 1).

---

## Detalhes técnicos relevantes

- **Masonry sem dependência nova:** `columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 [&>*]:break-inside-avoid` + `mb-4` nos filhos.
- **Uploads:** `supabase.storage.from('idea-references').upload(...)` com path `${workspace_id}/${board_id}/${uuid}-${sanitizedName}` (respeita regra de sanitização do projeto). Signed URLs via hook `useSignedUrl` existente.
- **Realtime:** ativar `idea_references` no `supabase_realtime` para refletir adições de outros usuários no moodboard aberto.
- **Compatibilidade:** `IdeasBankView.tsx` atual continua existindo até a migração de dados rodar; depois é substituído por `BoardMoodboardView` dentro do `SpacePage`/`FolderViewSwitcher`.
- **Design tokens:** usa tokens já definidos em `index.css`/`tailwind.config.ts`. Sem cores hardcoded. Bordas suaves, sombras leves, chips para tags — DNA FlowAlt.
- **Responsivo:** grid 1–2 colunas no mobile, drawer vira full-screen, filtros em `Sheet` bottom.
- **Auditoria:** trigger Postgres em `idea_references` e `idea_boards` grava em `idea_audit_log`.

---

## Critérios de aceite cobertos na Fase 1

Todos os itens da seção 14 do brief, **exceto** as sugestões de IA (Fase 2) e seleção múltipla/compartilhar público (Fase 3). Estrutura de IA já fica no schema (`ai_*` columns) pronta pra Fase 2 sem nova migração.

---

## O que eu preciso confirmar antes de codar

1. **Fase 1 agora, Fases 2 e 3 depois?** Ou prefere tudo de uma vez (vai dobrar o tamanho do PR e o risco)?
2. **Migrar os dados existentes** de `ideas_bank` pra `idea_references` automaticamente, certo? (Mantendo `ideas_bank` intacto como fallback.)
3. **Rota global**: confirma `/ideas` no sidebar principal?

Se responder “toca Fase 1, sim pra migração, sim pra /ideas” eu já saio executando: migração → edge function de link preview → componentes → integração com SpacePage/FolderViewSwitcher → estados vazios.
