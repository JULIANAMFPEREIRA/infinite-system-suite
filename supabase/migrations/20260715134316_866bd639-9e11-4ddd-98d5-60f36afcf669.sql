
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS cnae TEXT,
  ADD COLUMN IF NOT EXISTS data_abertura DATE,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS telefone1 TEXT,
  ADD COLUMN IF NOT EXISTS telefone2 TEXT,
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Storage policies for financeiro-arquivos: allow authenticated users to manage their empresa logo
CREATE POLICY "authenticated_read_financeiro_arquivos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'financeiro-arquivos');

CREATE POLICY "authenticated_insert_financeiro_arquivos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'financeiro-arquivos');

CREATE POLICY "authenticated_update_financeiro_arquivos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'financeiro-arquivos');

CREATE POLICY "authenticated_delete_financeiro_arquivos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'financeiro-arquivos');
