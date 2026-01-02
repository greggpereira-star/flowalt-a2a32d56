# Módulo de Avisos Internos e Aniversários

## Visão Geral

O módulo de Avisos Internos permite a comunicação institucional clara, auditável e impossível de ser ignorada dentro do FlowAlt. Inclui avisos manuais, automáticos (feriados/datas) e celebrações de aniversário com conformidade LGPD.

## Tabelas

### `notices`
Avisos oficiais do workspace.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Identificador único |
| workspace_id | uuid | Workspace do aviso |
| title | text | Título do aviso |
| content | text | Conteúdo/descrição |
| category | text | general, urgent, celebration, holiday, birthday, maintenance, policy |
| priority | text | low, normal, high, critical |
| status | text | draft, scheduled, active, closed, archived |
| requires_confirmation | boolean | Exige confirmação "Li e estou ciente" |
| target_roles | text[] | Roles que podem ver o aviso |
| starts_at | timestamptz | Data/hora de início |
| ends_at | timestamptz | Data/hora de término |
| auto_generated | boolean | Se foi gerado automaticamente |
| source_type | text | manual, calendar_event, birthday, system |

### `notice_reads`
Registro de leituras e confirmações.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| notice_id | uuid | Aviso lido |
| user_id | uuid | Usuário que leu |
| read_at | timestamptz | Quando foi lido |
| confirmed_at | timestamptz | Quando confirmou (se required) |

### `base_calendar_events`
Feriados e datas gerais do workspace.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| title | text | Nome do evento |
| event_date | date | Data do evento |
| recurrence | text | none, yearly, monthly |
| category | text | holiday, celebration, important_date, custom |
| generate_notice | boolean | Se gera aviso automático |

### `user_birthdays`
Aniversários dos usuários (LGPD Compliant).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| user_id | uuid | Usuário (PK) |
| workspace_id | uuid | Workspace |
| birth_date | date | Data de nascimento |
| visibility | text | public, team, private |

## Conformidade LGPD

- **Idade nunca exposta**: O sistema usa apenas dia/mês para o aviso
- **Visibilidade controlada**: Usuário escolhe quem vê seu aniversário
- **Data completa protegida**: Apenas funções do sistema acessam birth_date
- **Sem hints de existência**: Buscas não revelam dados privados

## Hooks Disponíveis

### `useNotices()`
```typescript
const { 
  notices,           // Lista de avisos
  unreadNotices,     // Avisos não lidos
  birthdayNotices,   // Avisos de aniversário ativos
  markAsRead,        // Marcar como lido
  confirmNotice      // Confirmar aviso crítico
} = useNotices();
```

### `useUserBirthday()`
```typescript
const { 
  birthday,      // Dados do aniversário
  saveBirthday   // Salvar/atualizar aniversário
} = useUserBirthday();
```

## Componentes UI

### `NoticesCenter`
Central de avisos no header (ícone sino com badge).

### `BirthdayBanner`
Banner celebratório na Home com confetes/balões.
- Animações respeitam `prefers-reduced-motion`
- Efeitos ativam apenas 1x por sessão

### `BirthdaySettings`
Configuração de aniversário em Settings > Perfil.
- Seleção de data
- Controle de visibilidade

## Functions do Banco

### `generate_birthday_notices()`
Gera avisos de aniversário automaticamente. Deve ser executada diariamente via cron.

### `archive_old_notices()`
Arquiva avisos antigos. Deve ser executada diariamente via cron.

## Integrações

- **Home**: BirthdayBanner exibido
- **Header**: NoticesCenter ao lado de notificações
- **Calendário**: Aniversários com ícone 🎂
- **Settings**: Aba Perfil com BirthdaySettings

## RLS Policies

### notices
- SELECT: Membros do workspace veem avisos active/closed
- INSERT/UPDATE/DELETE: Apenas admin/owner

### user_birthdays
- SELECT: Próprio usuário, ou público se visibility='public', ou admin
- INSERT: Próprio usuário se membro do workspace
- UPDATE/DELETE: Próprio usuário

## Exemplo de Uso

```typescript
// Salvar aniversário
const { saveBirthday } = useUserBirthday();
await saveBirthday.mutateAsync({
  birth_date: '1990-05-15',
  visibility: 'public'
});

// Listar avisos não lidos
const { unreadNotices } = useNotices();
console.log(`${unreadNotices.length} avisos não lidos`);
```
