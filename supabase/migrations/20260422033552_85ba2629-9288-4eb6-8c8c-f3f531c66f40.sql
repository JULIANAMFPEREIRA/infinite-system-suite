-- Create notificacoes table
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  parceiro_id uuid NOT NULL,
  projeto_id uuid,
  tipo text NOT NULL DEFAULT 'pagamento_rt',
  titulo text NOT NULL,
  mensagem text NOT NULL,
  data timestamptz NOT NULL DEFAULT now(),
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_parceiro ON public.notificacoes(parceiro_id, lida, data DESC);
CREATE INDEX idx_notificacoes_empresa ON public.notificacoes(empresa_id, data DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Empresa admin sees all notifications of their company
CREATE POLICY "notificacoes_empresa_select"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (empresa_id = get_empresa_id(auth.uid()));

-- Partner sees only own notifications
CREATE POLICY "notificacoes_parceiro_select"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (parceiro_id = get_fornecedor_id_by_email((auth.jwt() ->> 'email')));

-- Authenticated can insert (used by trigger via SECURITY DEFINER but also allow manual)
CREATE POLICY "notificacoes_insert"
  ON public.notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()));

-- Partner can mark own notifications as read
CREATE POLICY "notificacoes_parceiro_update"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (parceiro_id = get_fornecedor_id_by_email((auth.jwt() ->> 'email')));

-- Empresa admin can update notifications
CREATE POLICY "notificacoes_empresa_update"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (empresa_id = get_empresa_id(auth.uid()));

-- Empresa admin can delete
CREATE POLICY "notificacoes_empresa_delete"
  ON public.notificacoes FOR DELETE
  TO authenticated
  USING (empresa_id = get_empresa_id(auth.uid()));

-- Trigger function: create notification on new RT payment
CREATE OR REPLACE FUNCTION public.trg_notificar_pagamento_rt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_nome text;
  v_valor_fmt text;
BEGIN
  SELECT nome INTO v_projeto_nome FROM public.projetos WHERE id = NEW.projeto_id;
  v_valor_fmt := 'R$ ' || to_char(NEW.valor, 'FM999G999G990D00');

  INSERT INTO public.notificacoes (empresa_id, parceiro_id, projeto_id, tipo, titulo, mensagem, data)
  VALUES (
    NEW.empresa_id,
    NEW.parceiro_id,
    NEW.projeto_id,
    'pagamento_rt',
    'Pagamento de comissão recebido',
    'Você recebeu ' || v_valor_fmt || ' referente ao projeto ' || COALESCE(v_projeto_nome, '—'),
    NEW.data::timestamptz
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pagamentos_rt_notificar
  AFTER INSERT ON public.pagamentos_rt
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notificar_pagamento_rt();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;