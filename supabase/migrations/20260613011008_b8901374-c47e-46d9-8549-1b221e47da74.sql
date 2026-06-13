
CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendada',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas TO authenticated;
GRANT ALL ON public.visitas TO service_role;

ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage visitas"
  ON public.visitas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_visitas_updated_at
  BEFORE UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_visitas_data_inicio ON public.visitas(data_inicio);
CREATE INDEX idx_visitas_empresa ON public.visitas(empresa_id);

CREATE TABLE public.visita_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas(id) ON DELETE CASCADE,
  tecnico_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visita_id, tecnico_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_tecnicos TO authenticated;
GRANT ALL ON public.visita_tecnicos TO service_role;

ALTER TABLE public.visita_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage visita_tecnicos"
  ON public.visita_tecnicos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_visita_tecnicos_visita ON public.visita_tecnicos(visita_id);
CREATE INDEX idx_visita_tecnicos_tecnico ON public.visita_tecnicos(tecnico_id);
