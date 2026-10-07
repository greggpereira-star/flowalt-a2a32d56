-- Onda 6: liga a flag automation_rules so para o Gregg (piloto), no workspace ALT AGENCY.
-- A flag controla a tela "Regras automaticas" (menu Gestao). O motor das regras roda no banco e so age nas regras LIGADAS;
-- todas nascem desligadas, entao esta flag nao muda nada sozinha.
-- Para ampliar, acrescente ids em metadata.user_ids; para liberar o workspace inteiro, apague a chave user_ids.
-- Para desligar: update public.feature_flags set enabled = false where flag_key = 'automation_rules';
insert into public.feature_flags (workspace_id, flag_key, enabled, rollout_percentage, metadata)
select '10a7ca16-6328-490f-a6bd-28974a91ef8f', 'automation_rules', true, 100,
       '{"user_ids":["22e85fed-6b14-44a1-9cb8-38e2be417dd2"]}'::jsonb
where not exists (select 1 from public.feature_flags where flag_key = 'automation_rules' and workspace_id = '10a7ca16-6328-490f-a6bd-28974a91ef8f');
