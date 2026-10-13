-- Aprovacao pelo portal do cliente: o pedido pode ser entregue no portal (sem link proprio) e o cliente avisado por e-mail.
--
-- O que muda:
--   a) approval_requests.via_portal (boolean, padrao false): marca o pedido enviado pelo portal. Pedidos antigos
--      continuam como estao (link proprio).
--   b) client_portal_access.token_enc (texto, nulo): copia CIFRADA (AES-GCM, chave derivada da chave de servico) do link do
--      portal, gravada so pela funcao de borda portal-aviso quando a equipe gera o link. Serve para o e-mail de aviso e os
--      lembretes apontarem o portal. O banco sozinho nao revela o token; links gerados antes desta migration nao tem a copia
--      ate serem gerados de novo.
--
-- Aditiva e reversivel. Nao altera linhas existentes.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261009190000_aprovacao_pelo_portal.sql"
--
-- Reversao:
--   alter table public.approval_requests drop column via_portal;
--   alter table public.client_portal_access drop column token_enc;

begin;

alter table public.approval_requests add column if not exists via_portal boolean not null default false;
alter table public.client_portal_access add column if not exists token_enc text;

comment on column public.approval_requests.via_portal is 'Pedido entregue pelo portal do cliente (sem link proprio); o aviso e os lembretes apontam o portal.';
comment on column public.client_portal_access.token_enc is 'Link do portal cifrado (AES-GCM) pela funcao portal-aviso, so para e-mails de aviso e lembretes. Nunca lido pelo navegador.';

commit;
