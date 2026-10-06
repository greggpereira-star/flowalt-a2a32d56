-- Onda 5: liga a flag client_portal so para o Gregg (piloto), no workspace ALT AGENCY.
-- A flag controla so a aba Portal dentro do cliente (onde o link e gerado). A pagina publica do portal abre para
-- quem tem o link, sem depender da flag.
-- Para ampliar, acrescente ids em metadata.user_ids; para liberar o workspace inteiro, apague a chave user_ids.
-- Para desligar: update public.feature_flags set enabled = false where flag_key = 'client_portal';
insert into public.feature_flags (workspace_id, flag_key, enabled, rollout_percentage, metadata)
select '10a7ca16-6328-490f-a6bd-28974a91ef8f', 'client_portal', true, 100,
       '{"user_ids":["22e85fed-6b14-44a1-9cb8-38e2be417dd2"]}'::jsonb
where not exists (select 1 from public.feature_flags where flag_key = 'client_portal' and workspace_id = '10a7ca16-6328-490f-a6bd-28974a91ef8f');
