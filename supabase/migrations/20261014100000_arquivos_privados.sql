-- C2: arquivos privados
-- 1) cria a pasta crm-files (o app usa desde julho, mas ela nunca existiu: todo envio de foto/documento falhava)
-- 2) financeiro-arquivos deixa de ser aberta por link; tudo passa a ser lido por link temporário (o app já faz isso)
-- 3) cada pessoa só lê/envia arquivos dos clientes que ela pode ver (mesmas regras da C1)
-- Caminho dos arquivos no app: {empresa_id}/{cliente_id}/{arquivo}

-- o portal do cliente grava "usuario_id" ao enviar arquivo, mas a coluna não existia
alter table public.crm_arquivos add column if not exists usuario_id uuid default auth.uid();

insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 26214400)
on conflict (id) do update set public = false;

update storage.buckets set public = false where id = 'financeiro-arquivos';

-- clientes visíveis para a pessoa logada, como texto (para comparar com o nome da pasta)
create or replace function public.clientes_visiveis_txt()
returns setof text language sql stable security definer set search_path = public as $$
  select id::text from public.meus_clientes() as id
  union
  select id::text from public.clientes_como_parceiro() as id;
$$;
revoke all on function public.clientes_visiveis_txt() from public, anon;
grant execute on function public.clientes_visiveis_txt() to authenticated;

-- políticas antigas: qualquer logado lia, enviava e apagava qualquer arquivo financeiro
drop policy if exists "Autenticados podem fazer upload" on storage.objects;
drop policy if exists "Autenticados podem ler arquivos" on storage.objects;
drop policy if exists "Autenticados podem deletar seus arquivos" on storage.objects;

-- equipe interna: tudo, nas duas pastas
create policy arquivos_interno_total on storage.objects for all to authenticated
  using (bucket_id in ('crm-files', 'financeiro-arquivos') and public.eh_usuario_interno())
  with check (bucket_id in ('crm-files', 'financeiro-arquivos') and public.eh_usuario_interno());

-- portais, pasta crm-files: lê e envia nos clientes que pode ver; apaga só o que ele mesmo enviou
create policy arquivos_portal_le on storage.objects for select to authenticated
  using (bucket_id = 'crm-files' and (storage.foldername(name))[2] in (select public.clientes_visiveis_txt()));
create policy arquivos_portal_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-files' and (storage.foldername(name))[2] in (select public.clientes_visiveis_txt()));
create policy arquivos_portal_apaga_proprio on storage.objects for delete to authenticated
  using (bucket_id = 'crm-files' and owner_id = auth.uid()::text);

-- portais, pasta financeiro-arquivos: só lê as fotos antigas de obra ligadas a um cliente que pode ver
-- (comprovantes e boletos ficam só para a equipe interna)
create policy arquivos_portal_le_fotos_antigas on storage.objects for select to authenticated
  using (bucket_id = 'financeiro-arquivos'
     and name in (select substring(a.url from '/financeiro-arquivos/(.+)$') from public.crm_arquivos a));
