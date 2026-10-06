-- Onda 1 (blueprint V3): suporte aos lembretes e a expiracao automatica da Sala de Aprovacao.
--
--   token_enc       token do link CIFRADO (AES-GCM, chave derivada da chave de servico), gravado so quando o pedido
--                   e enviado por e-mail, para o lembrete reenviar o mesmo link. Sem a chave de servico, o banco
--                   sozinho nao revela o token. Limpo quando o link e renovado.
--   reminder_count  quantos lembretes ja foram feitos (maximo 3: D+1, D+2 e D+4).
--
-- Aditiva. Reversao: alter table public.approval_requests drop column token_enc, drop column reminder_count;
begin;
alter table public.approval_requests add column if not exists token_enc text;
alter table public.approval_requests add column if not exists reminder_count int not null default 0;
commit;
