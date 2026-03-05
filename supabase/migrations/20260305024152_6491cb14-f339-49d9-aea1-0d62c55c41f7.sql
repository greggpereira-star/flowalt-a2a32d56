-- Bucket dedicado para anexos de nós do mind map
insert into storage.buckets (id, name, public)
values ('mindmap-attachments', 'mindmap-attachments', true)
on conflict (id) do update set public = excluded.public;

-- Limpa políticas antigas (idempotente)
drop policy if exists "Public can view mindmap attachments" on storage.objects;
drop policy if exists "Authenticated users can upload own mindmap attachments" on storage.objects;
drop policy if exists "Users can update own mindmap attachments" on storage.objects;
drop policy if exists "Users can delete own mindmap attachments" on storage.objects;

-- Leitura pública dos anexos de mindmap
create policy "Public can view mindmap attachments"
on storage.objects
for select
to public
using (bucket_id = 'mindmap-attachments');

-- Upload apenas autenticado e dentro da pasta do próprio usuário: {user_id}/arquivo
create policy "Authenticated users can upload own mindmap attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mindmap-attachments'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own mindmap attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mindmap-attachments'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'mindmap-attachments'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own mindmap attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'mindmap-attachments'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);