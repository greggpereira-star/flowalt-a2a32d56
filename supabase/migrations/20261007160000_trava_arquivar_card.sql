-- Arquivar card passa a ser protegido no banco, não só na tela.
-- Antes: qualquer membro com permissão de editar o card conseguia arquivar o de outra pessoa direto pela API
-- (a regra "só quem criou ou administrador" existia apenas no front).
-- Agora: mudar o status para 'archived' exige a mesma regra que a política de exclusão de cards já usa
-- (administrador do workspace, quem criou o card ou o responsável). Editar e mover cards segue como antes.
-- Jobs, edge functions (service role), funções do sistema (ex.: regras automáticas) e o administrador do banco passam.

create or replace function public.trg_exige_permissao_para_arquivar_card()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status is distinct from 'archived'::card_status or old.status is not distinct from 'archived'::card_status then
    return new;
  end if;

  -- Sem sessão de pessoa (cron, service role) ou executando como dono do sistema (funções SECURITY DEFINER,
  -- psql do administrador): não há "quem pediu" para conferir.
  if auth.uid() is null or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if public.has_admin_access(auth.uid(), new.workspace_id)
     or new.created_by = auth.uid()
     or new.owner_id = auth.uid() then
    return new;
  end if;

  raise exception 'Só quem criou o card, o responsável ou um administrador pode arquivá-lo'
    using errcode = '42501';
end $$;

drop trigger if exists cards_exige_permissao_para_arquivar on public.cards;
create trigger cards_exige_permissao_para_arquivar
  before update of status on public.cards
  for each row execute function public.trg_exige_permissao_para_arquivar_card();
