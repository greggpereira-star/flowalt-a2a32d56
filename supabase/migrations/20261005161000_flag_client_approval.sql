-- Onda 1: liga a flag client_approval so para o Gregg (piloto), no workspace ALT AGENCY.
-- Para ampliar depois, acrescente ids em metadata.user_ids ou apague a chave user_ids para liberar o workspace inteiro.
-- Para desligar: update public.feature_flags set enabled = false where flag_key = 'client_approval';
insert into public.feature_flags (workspace_id, flag_key, enabled, rollout_percentage, metadata)
select '10a7ca16-6328-490f-a6bd-28974a91ef8f', 'client_approval', true, 100,
       '{"user_ids":["22e85fed-6b14-44a1-9cb8-38e2be417dd2"]}'::jsonb
where not exists (select 1 from public.feature_flags where flag_key = 'client_approval' and workspace_id = '10a7ca16-6328-490f-a6bd-28974a91ef8f');
