-- Relatórios financeiros (PDF) no storage eram legíveis por qualquer membro ativo do workspace.
-- Agora só super_admin, owner (sócio/master) e finance.
drop policy if exists financial_reports_storage_select on storage.objects;
drop policy if exists financial_reports_storage_insert on storage.objects;
drop policy if exists financial_reports_storage_delete on storage.objects;

create policy financial_reports_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'financial-reports' and public.has_finance_access(auth.uid(), nullif((storage.foldername(name))[1], '')::uuid));
create policy financial_reports_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'financial-reports' and public.has_finance_access(auth.uid(), nullif((storage.foldername(name))[1], '')::uuid));
create policy financial_reports_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'financial-reports' and public.has_finance_access(auth.uid(), nullif((storage.foldername(name))[1], '')::uuid));
