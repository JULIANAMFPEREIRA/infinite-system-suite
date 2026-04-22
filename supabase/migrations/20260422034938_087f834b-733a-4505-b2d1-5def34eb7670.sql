-- Habilitar pg_net para chamadas HTTP do banco
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Tabela de logs de WhatsApp
CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  parceiro_id uuid NOT NULL,
  pagamento_rt_id uuid,
  telefone text,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pendente', -- pendente | enviado | erro | simulado | sem_telefone
  erro text,
  provider text,
  data timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_logs_parceiro ON public.whatsapp_logs(parceiro_id);
CREATE INDEX idx_whatsapp_logs_pagamento ON public.whatsapp_logs(pagamento_rt_id);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_logs_empresa_select" ON public.whatsapp_logs
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id(auth.uid()));

CREATE POLICY "whatsapp_logs_empresa_insert" ON public.whatsapp_logs
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()));

CREATE POLICY "whatsapp_logs_empresa_update" ON public.whatsapp_logs
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id(auth.uid()));

CREATE POLICY "whatsapp_logs_parceiro_select" ON public.whatsapp_logs
  FOR SELECT TO authenticated
  USING (parceiro_id = get_fornecedor_id_by_email((auth.jwt() ->> 'email'::text)));

-- Função: formatar mensagem padrão
CREATE OR REPLACE FUNCTION public.format_whatsapp_rt_message(
  _parceiro_nome text,
  _projeto_nome text,
  _valor numeric,
  _data date
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'Olá, ' || COALESCE(_parceiro_nome, 'parceiro') || '! 👋' || E'\n\n' ||
         'Você recebeu um pagamento de comissão 💰' || E'\n\n' ||
         'Projeto: ' || COALESCE(_projeto_nome, '—') || E'\n' ||
         'Valor: R$ ' || to_char(_valor, 'FM999G999G990D00') || E'\n' ||
         'Data: ' || to_char(_data, 'DD/MM/YYYY') || E'\n\n' ||
         'Acompanhe mais detalhes no portal.';
$$;

-- Trigger: ao inserir pagamento_rt, gerar log de WhatsApp
CREATE OR REPLACE FUNCTION public.trg_enviar_whatsapp_rt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parceiro_nome text;
  v_telefone text;
  v_projeto_nome text;
  v_mensagem text;
  v_status text;
  v_erro text;
BEGIN
  -- Evitar duplicação: se já existe log para este pagamento, não recriar
  IF EXISTS (SELECT 1 FROM public.whatsapp_logs WHERE pagamento_rt_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT nome, telefone INTO v_parceiro_nome, v_telefone
  FROM public.fornecedores WHERE id = NEW.parceiro_id;

  SELECT nome INTO v_projeto_nome
  FROM public.projetos WHERE id = NEW.projeto_id;

  v_mensagem := public.format_whatsapp_rt_message(
    v_parceiro_nome, v_projeto_nome, NEW.valor, NEW.data
  );

  IF v_telefone IS NULL OR length(trim(v_telefone)) = 0 THEN
    v_status := 'sem_telefone';
    v_erro := 'Parceiro sem telefone cadastrado';
  ELSE
    v_status := 'simulado';
    v_erro := NULL;
  END IF;

  INSERT INTO public.whatsapp_logs (
    empresa_id, parceiro_id, pagamento_rt_id, telefone, mensagem, status, erro, provider
  ) VALUES (
    NEW.empresa_id, NEW.parceiro_id, NEW.id, v_telefone, v_mensagem, v_status, v_erro, 'simulado'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca travar o pagamento por causa do WhatsApp
  INSERT INTO public.whatsapp_logs (
    empresa_id, parceiro_id, pagamento_rt_id, mensagem, status, erro, provider
  ) VALUES (
    NEW.empresa_id, NEW.parceiro_id, NEW.id, COALESCE(v_mensagem, ''), 'erro', SQLERRM, 'simulado'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enviar_whatsapp_rt ON public.pagamentos_rt;
CREATE TRIGGER trg_enviar_whatsapp_rt
  AFTER INSERT ON public.pagamentos_rt
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enviar_whatsapp_rt();