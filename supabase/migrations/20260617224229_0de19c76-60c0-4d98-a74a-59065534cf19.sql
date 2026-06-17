-- 1. visivel_cliente flag on CRM interactions (the notes tab actually writes here)
ALTER TABLE public.crm_interacoes ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;

-- 2. user_id on notificacoes so messages can target a specific auth user (client/partner)
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON public.notificacoes(user_id);

-- 3. RLS policy: a user can read/insert their own notifications (for messages)
DROP POLICY IF EXISTS "notificacoes_user_own" ON public.notificacoes;
CREATE POLICY "notificacoes_user_own" ON public.notificacoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Trigger: new agenda_visita -> notify client
CREATE OR REPLACE FUNCTION public.trg_notify_cliente_visita()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.clientes WHERE id = NEW.cliente_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (empresa_id, user_id, tipo, titulo, mensagem, data)
  VALUES (NEW.empresa_id, v_user, 'visita', 'Nova visita agendada',
          'Nova visita agendada: ' || COALESCE(NEW.titulo,'sem título') ||
          ' em ' || to_char(NEW.data_inicio, 'DD/MM/YYYY HH24:MI'),
          now());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_cliente_visita ON public.agenda_visitas;
CREATE TRIGGER trg_notify_cliente_visita
AFTER INSERT ON public.agenda_visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_cliente_visita();

-- 5. Trigger: new image (crm_arquivos) -> notify client
CREATE OR REPLACE FUNCTION public.trg_notify_cliente_imagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tipo <> 'imagem' AND NEW.nome_arquivo !~* '\.(jpg|jpeg|png|gif|webp)$' THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.clientes WHERE id = NEW.cliente_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (empresa_id, user_id, tipo, titulo, mensagem, data)
  VALUES (NEW.empresa_id, v_user, 'imagem', 'Nova imagem',
          'Nova imagem adicionada ao seu projeto', now());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_cliente_imagem ON public.crm_arquivos;
CREATE TRIGGER trg_notify_cliente_imagem
AFTER INSERT ON public.crm_arquivos
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_cliente_imagem();

-- 6. Trigger: projeto status change -> notify client
CREATE OR REPLACE FUNCTION public.trg_notify_cliente_status_projeto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.clientes WHERE id = NEW.cliente_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (empresa_id, user_id, projeto_id, tipo, titulo, mensagem, data)
  VALUES (NEW.empresa_id, v_user, NEW.id, 'status', 'Status do projeto atualizado',
          'Status do projeto atualizado para ' || NEW.status::text, now());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_cliente_status_projeto ON public.projetos;
CREATE TRIGGER trg_notify_cliente_status_projeto
AFTER UPDATE OF status ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_cliente_status_projeto();