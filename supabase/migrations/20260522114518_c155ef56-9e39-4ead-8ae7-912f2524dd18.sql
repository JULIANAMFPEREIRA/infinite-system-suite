-- Criar tabela de anotações do usuário
CREATE TABLE IF NOT EXISTS public.anotacoes_usuario (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL,
    conteudo TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE public.anotacoes_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários podem ver suas próprias anotações" 
ON public.anotacoes_usuario 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias anotações" 
ON public.anotacoes_usuario 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias anotações" 
ON public.anotacoes_usuario 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias anotações" 
ON public.anotacoes_usuario 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_anotacoes_updated_at') THEN
        CREATE TRIGGER update_anotacoes_updated_at
        BEFORE UPDATE ON public.anotacoes_usuario
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;