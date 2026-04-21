-- Ensure full row data on updates for accurate realtime payloads
ALTER TABLE public.financeiro_receber REPLICA IDENTITY FULL;
ALTER TABLE public.financeiro_pagar REPLICA IDENTITY FULL;
ALTER TABLE public.compras REPLICA IDENTITY FULL;
ALTER TABLE public.necessidades_compra REPLICA IDENTITY FULL;
ALTER TABLE public.projetos REPLICA IDENTITY FULL;
ALTER TABLE public.projeto_itens REPLICA IDENTITY FULL;
ALTER TABLE public.visitas_tecnicas REPLICA IDENTITY FULL;
ALTER TABLE public.crm_orcamentos REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication (idempotent)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'financeiro_receber',
    'financeiro_pagar',
    'compras',
    'necessidades_compra',
    'projetos',
    'projeto_itens',
    'visitas_tecnicas',
    'crm_orcamentos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;