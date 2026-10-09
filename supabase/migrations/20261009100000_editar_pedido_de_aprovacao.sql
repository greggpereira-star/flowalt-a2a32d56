-- Editar um pedido de aprovacao que ainda esta em aberto, sem cancelar nem gerar novo link.
--
-- Ate aqui, errou um texto ou esqueceu a midia? Cancelar o pedido e refazer tudo. Agora a equipe edita o pedido
-- enquanto ele esta 'pending': corrige texto, troca ou acrescenta midia, acrescenta uma etapa que faltou (ex.: Midia)
-- ou tira uma etapa que ainda nao foi respondida. O link continua o mesmo.
--
-- Regras (todas validadas no banco, nao so na tela):
--   - so membro com papel de escrita; so pedido 'pending';
--   - etapa que o cliente JA respondeu (aprovada ou com ajuste) nao pode ser alterada nem removida: mexer nela mudaria
--     o que ele decidiu. Para isso, nova rodada;
--   - o pedido por etapas precisa continuar com pelo menos uma etapa, e toda etapa precisa ter pelo menos uma peca;
--   - arquivo so de anexos do proprio card (caminho comeca pelo id do card);
--   - tudo ou nada: e uma funcao so, dentro de uma transacao.
-- Registra o evento 'edited' na trilha e, se pedido, uma mensagem da equipe na conversa do pedido.
--
-- Aditiva: so acrescenta um tipo de evento e duas funcoes.
--
-- Aplicar (DDL de seguranca, guardrail 15 do blueprint):
--   ssh mchat-vps "cd /var/www/flowalt/supabase/migrations && docker exec -i supabase-db psql -U postgres < 20261009100000_editar_pedido_de_aprovacao.sql"
--
-- Reversao:
--   drop function public.approval_editar_pedido(uuid, text, text, jsonb, text);
--   drop function public.approval_inserir_itens(uuid, uuid, uuid, text, jsonb, int);
--   (e recriar approval_events_type_check sem 'edited')

begin;

alter table public.approval_events drop constraint if exists approval_events_type_check;
alter table public.approval_events
  add constraint approval_events_type_check check (type in (
    'sent', 'viewed', 'commented', 'approved', 'changes_requested', 'reminder', 'expired', 'canceled', 'link_renewed',
    'stage_approved', 'stage_changes_requested', 'edited'
  ));

-- Insere as pecas de uma etapa (ou do pedido rapido, com p_stage null). Devolve quantas inseriu.
create or replace function public.approval_inserir_itens(
  p_request uuid, p_workspace uuid, p_card uuid, p_stage text, p_itens jsonb, p_base int
) returns int language plpgsql security definer set search_path = public as $$
declare it jsonb; i int := 0; v_kind text; v_path text; v_body text;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then return 0; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    v_kind := it->>'kind';
    if v_kind not in ('image', 'video', 'document', 'text', 'link') then raise exception 'tipo de peca invalido'; end if;
    if v_kind = 'text' then
      v_body := btrim(coalesce(it->>'body', ''));
      if v_body = '' then continue; end if;
      if char_length(v_body) > 20000 then raise exception 'texto grande demais'; end if;
      insert into public.approval_items(request_id, workspace_id, kind, stage, body, sort_order)
        values (p_request, p_workspace, 'text', p_stage, v_body, p_base + i);
    else
      v_path := it->>'storage_path';
      if v_path is null or position('..' in v_path) > 0 or v_path not like (p_card::text || '/%') then
        raise exception 'arquivo fora dos anexos deste card';
      end if;
      insert into public.approval_items(request_id, workspace_id, kind, stage, bucket, storage_path, file_name, sort_order)
        values (p_request, p_workspace, v_kind, p_stage, 'attachments', v_path, left(coalesce(it->>'file_name', ''), 200), p_base + i);
    end if;
    i := i + 1;
  end loop;
  return i;
end;
$$;

-- p_stages:
--   pedido rapido:   [{"items": [...]}]
--   pedido em etapas: [{"stage": "midia", "remove": false, "items": [...]}, {"stage": "tema", "remove": true}, ...]
-- Etapas que nao aparecem em p_stages ficam como estao.
create or replace function public.approval_editar_pedido(
  p_request uuid, p_title text, p_message text, p_stages jsonb, p_notify text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests%rowtype;
  est jsonb;
  v_stage text;
  v_dec public.approval_stage_decisions%rowtype;
  v_ordem text[] := array['tema', 'conteudo', 'midia', 'legenda'];
  v_n int;
  v_autor text;
begin
  select * into r from public.approval_requests where id = p_request for update;
  if not found then raise exception 'pedido nao encontrado'; end if;
  if auth.uid() is null or not public.is_workspace_member(auth.uid(), r.workspace_id) or not public.brand_can_write(r.workspace_id) then
    raise exception 'sem permissao para editar este pedido';
  end if;
  if r.status <> 'pending' then raise exception 'so pedidos em aberto podem ser editados'; end if;
  if p_title is null or char_length(btrim(p_title)) = 0 or char_length(p_title) > 200 then raise exception 'titulo invalido'; end if;
  if p_stages is null or jsonb_typeof(p_stages) <> 'array' then raise exception 'conteudo invalido'; end if;

  update public.approval_requests
     set title = btrim(p_title), message = nullif(btrim(coalesce(p_message, '')), '')
   where id = p_request;

  if r.mode = 'quick' then
    est := p_stages->0;
    delete from public.approval_items where request_id = p_request;
    v_n := public.approval_inserir_itens(p_request, r.workspace_id, r.card_id, null, est->'items', 0);
    if v_n = 0 then raise exception 'o pedido precisa ter pelo menos uma peca'; end if;
  else
    for est in select * from jsonb_array_elements(p_stages) loop
      v_stage := est->>'stage';
      if v_stage is null or not (v_stage = any (v_ordem)) then raise exception 'etapa invalida'; end if;
      select * into v_dec from public.approval_stage_decisions where request_id = p_request and stage = v_stage;
      if found and v_dec.status <> 'pending' then
        raise exception 'a etapa % ja foi respondida pelo cliente e nao pode ser alterada', v_stage;
      end if;

      if coalesce((est->>'remove')::boolean, false) then
        delete from public.approval_items where request_id = p_request and stage = v_stage;
        delete from public.approval_stage_decisions where request_id = p_request and stage = v_stage;
      else
        if not found then
          insert into public.approval_stage_decisions(request_id, workspace_id, stage) values (p_request, r.workspace_id, v_stage);
        end if;
        delete from public.approval_items where request_id = p_request and stage = v_stage;
        v_n := public.approval_inserir_itens(p_request, r.workspace_id, r.card_id, v_stage, est->'items', array_position(v_ordem, v_stage) * 100);
        if v_n = 0 then raise exception 'a etapa % precisa ter pelo menos uma peca', v_stage; end if;
      end if;
    end loop;

    -- Sem etapa aguardando o cliente, nada mais fecharia o pedido (ele ficaria aberto para sempre).
    select count(*) into v_n from public.approval_stage_decisions where request_id = p_request and status = 'pending';
    if v_n = 0 then raise exception 'o pedido precisa ter pelo menos uma etapa aguardando o cliente'; end if;
  end if;

  insert into public.approval_events(request_id, workspace_id, type, actor_kind, actor_label)
    values (p_request, r.workspace_id, 'edited', 'member', (select email from auth.users where id = auth.uid()));

  if p_notify is not null and char_length(btrim(p_notify)) > 0 then
    select coalesce(nullif(btrim(pr.full_name), ''), split_part(pr.email, '@', 1), 'Equipe') into v_autor
      from public.profiles pr where pr.id = auth.uid();
    insert into public.approval_comments(request_id, workspace_id, author_kind, user_id, author_name, body)
      values (p_request, r.workspace_id, 'member', auth.uid(), coalesce(v_autor, 'Equipe'), left(btrim(p_notify), 4000));
  end if;
end;
$$;

revoke execute on function public.approval_inserir_itens(uuid, uuid, uuid, text, jsonb, int) from public, anon, authenticated;
revoke execute on function public.approval_editar_pedido(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.approval_editar_pedido(uuid, text, text, jsonb, text) to authenticated;

commit;
