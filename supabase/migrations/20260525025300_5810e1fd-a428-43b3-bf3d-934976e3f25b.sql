-- Categorias de Finanças Pessoais
CREATE TABLE IF NOT EXISTS public.financas_pessoais_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'retirada', 'devolucao')),
    cor TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lançamentos de Finanças Pessoais
CREATE TABLE IF NOT EXISTS public.financas_pessoais_lancamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    categoria_id UUID REFERENCES public.financas_pessoais_categorias(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa', 'retirada', 'devolucao')),
    valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
    data_vencimento DATE NOT NULL,
    mes_referencia TEXT NOT NULL, -- Formato "MM/YYYY"
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    recorrente BOOLEAN DEFAULT false,
    lancamento_pai_id UUID REFERENCES public.financas_pessoais_lancamentos(id) ON DELETE CASCADE,
    
    -- Campos de Baixa/Pagamento
    valor_pago NUMERIC(15, 2),
    data_pagamento DATE,
    observacao TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.financas_pessoais_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financas_pessoais_lancamentos ENABLE ROW LEVEL SECURITY;

-- Políticas Categorias
CREATE POLICY "Usuários podem ver suas categorias" ON public.financas_pessoais_categorias
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Usuários podem criar suas categorias" ON public.financas_pessoais_categorias
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Usuários podem editar suas categorias" ON public.financas_pessoais_categorias
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Usuários podem excluir suas categorias" ON public.financas_pessoais_categorias
    FOR DELETE USING (user_id = auth.uid());

-- Políticas Lançamentos
CREATE POLICY "Usuários podem ver seus lançamentos" ON public.financas_pessoais_lancamentos
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Usuários podem criar seus lançamentos" ON public.financas_pessoais_lancamentos
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Usuários podem editar seus lançamentos" ON public.financas_pessoais_lancamentos
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Usuários podem excluir seus lançamentos" ON public.financas_pessoais_lancamentos
    FOR DELETE USING (user_id = auth.uid());

-- Índices
CREATE INDEX idx_fin_pes_lanc_user_mes ON public.financas_pessoais_lancamentos(user_id, mes_referencia);
CREATE INDEX idx_fin_pes_lanc_data ON public.financas_pessoais_lancamentos(data_vencimento);

-- Função de atualização de timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_fin_pes_lanc_updated_at
    BEFORE UPDATE ON public.financas_pessoais_lancamentos
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
