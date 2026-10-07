-- Onda 6: lembretes inteligentes. Guarda o que ja foi lembrado, para cada card seguir a agenda de degraus (1, 2, 4 e 7 dias,
-- depois a cada 7) em vez de repetir todo dia. So a funcao lembretes-diarios (chave de servico) le e escreve aqui.
begin;

create table if not exists public.lembretes_enviados (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null,
  card_id       uuid not null references public.cards(id) on delete cascade,
  tipo          text not null check (tipo in ('atrasado', 'vence_em_breve', 'aprovacao_parada', 'escala_equipe', 'sem_responsavel')),
  dias          int not null,
  enviado_em    timestamptz not null default now()
);
create index if not exists idx_lembretes_enviados_card on public.lembretes_enviados (workspace_id, card_id, user_id, tipo, enviado_em);

-- RLS ligada e sem nenhuma politica: usuarios (e anonimos) nao enxergam nada; a chave de servico ignora a RLS.
alter table public.lembretes_enviados enable row level security;
revoke all on table public.lembretes_enviados from anon, authenticated;

commit;
