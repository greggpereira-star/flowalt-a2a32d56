
# Plano: Chat Fluido com Sistema de @Mencoes

## Visao Geral

O objetivo principal e implementar um sistema de mencoes (@) no chat dos cards, similar ao ClickUp, permitindo marcar membros do workspace diretamente nas conversas. Isso tornara o chat mais fluido e colaborativo.

---

## O Que Sera Implementado

### 1. Sistema de @Mencoes no Chat

O usuario podera digitar "@" no campo de comentario e vera uma lista de sugestoes com os membros do workspace, podendo selecionar quem deseja mencionar.

**Como funcionara:**
- Ao digitar "@", aparece um popup com lista de membros
- Filtragem automatica conforme digita o nome
- Avatar e nome do membro sao exibidos
- Clicar ou pressionar Enter seleciona a mencao
- Mencoes aparecem destacadas no texto (estilo chip/badge)

### 2. Visual do Chat Melhorado

- Mensagens com mencoes exibem os nomes destacados
- Layout mais limpo e moderno
- Scroll automatico para novas mensagens
- Indicador visual quando usuario e mencionado

---

## Etapas Tecnicas

```text
+-------------------+       +---------------------+       +-------------------+
|  Instalar         | ----> |  Criar componente   | ----> |  Atualizar        |
|  TipTap Mention   |       |  MentionList        |       |  RichTextEditor   |
+-------------------+       +---------------------+       +-------------------+
                                     |
                                     v
                           +---------------------+
                           |  Atualizar          |
                           |  CommentsPanel      |
                           +---------------------+
                                     |
                                     v
                           +---------------------+
                           |  Melhorar visual    |
                           |  RichTextViewer     |
                           +---------------------+
```

### Etapa 1: Adicionar Dependencias TipTap

Instalar os pacotes necessarios para mencoes:
- `@tiptap/extension-mention` - Extensao de mencoes
- `@tiptap/suggestion` - Utilitario para autocomplete

### Etapa 2: Criar Componente de Lista de Mencoes

Novo arquivo `src/components/ui/mention-list.tsx`:
- Componente que renderiza a lista de sugestoes
- Recebe membros do workspace como props
- Suporta navegacao por teclado (setas, Enter, Escape)
- Exibe avatar + nome de cada membro
- Filtra resultados conforme digitacao

### Etapa 3: Atualizar RichTextEditor

Modificar `src/components/ui/rich-text-editor.tsx`:
- Adicionar extensao Mention do TipTap
- Configurar o caractere trigger "@"
- Conectar com componente MentionList
- Renderizar mencoes como chips coloridos no texto

Novas props adicionadas:
```typescript
interface RichTextEditorProps {
  // ... props existentes
  mentionSuggestions?: Array<{
    id: string;
    name: string;
    avatar_url?: string | null;
  }>;
  onMentionsChange?: (mentionIds: string[]) => void;
}
```

### Etapa 4: Atualizar CommentsPanel

Modificar `src/components/cards/CommentsPanel.tsx`:
- Buscar membros do workspace usando `useWorkspaceMembers`
- Passar lista de membros para o RichTextEditor
- Capturar IDs dos usuarios mencionados
- Salvar mencoes junto com o comentario (campo ja existe no banco)
- Auto-scroll para novas mensagens

### Etapa 5: Atualizar RichTextViewer

Modificar `src/components/ui/rich-text-viewer.tsx`:
- Renderizar mencoes salvas com estilo destacado
- Exibir "@NomeDoUsuario" em cor diferente
- Tooltip opcional com informacoes do usuario

---

## Arquivos a Serem Modificados/Criados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `package.json` | Modificar | Adicionar dependencias TipTap |
| `src/components/ui/mention-list.tsx` | Criar | Componente de sugestoes |
| `src/components/ui/rich-text-editor.tsx` | Modificar | Integrar extensao Mention |
| `src/components/ui/rich-text-viewer.tsx` | Modificar | Renderizar mencoes |
| `src/components/cards/CommentsPanel.tsx` | Modificar | Integrar membros e mencoes |

---

## Fluxo de Usuario Final

1. Usuario abre um card e vai para aba "Chat"
2. Comeca a digitar um comentario
3. Digita "@" para mencionar alguem
4. Popup aparece com lista de membros do workspace
5. Usuario seleciona o membro (clique ou Enter)
6. Mencao aparece como chip destacado no texto
7. Usuario envia o comentario
8. Comentario salvo com lista de IDs mencionados
9. Na lista de comentarios, mencoes aparecem destacadas

---

## Consideracoes Sobre Sugestoes Adicionais

Voce mencionou outras melhorias como card centralizado/movel e reorganizacao visual do card. Essas sao mudancas maiores de UX que podem ser abordadas em um proximo passo, ja que o foco principal desta implementacao e o **chat com @mencoes**.

Se desejar, posso criar um plano separado para:
- Modal centralizado/redimensionavel para o card
- Reorganizacao das abas priorizando prazo, briefing, tarefas e chat
