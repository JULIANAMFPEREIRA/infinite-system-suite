
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.comissoes ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.financeiro_pagar ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.financeiro_receber ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.visitas_tecnicas ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;
ALTER TABLE public.equipe ADD COLUMN IF NOT EXISTS deletado boolean NOT NULL DEFAULT false;

-- Indexes for performance on soft delete filtering
CREATE INDEX IF NOT EXISTS idx_clientes_deletado ON public.clientes (deletado);
CREATE INDEX IF NOT EXISTS idx_fornecedores_deletado ON public.fornecedores (deletado);
CREATE INDEX IF NOT EXISTS idx_projetos_deletado ON public.projetos (deletado);
CREATE INDEX IF NOT EXISTS idx_produtos_deletado ON public.produtos (deletado);
CREATE INDEX IF NOT EXISTS idx_compras_deletado ON public.compras (deletado);
CREATE INDEX IF NOT EXISTS idx_comissoes_deletado ON public.comissoes (deletado);
CREATE INDEX IF NOT EXISTS idx_contratos_deletado ON public.contratos (deletado);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_deletado ON public.financeiro_pagar (deletado);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_deletado ON public.financeiro_receber (deletado);
CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_deletado ON public.visitas_tecnicas (deletado);
CREATE INDEX IF NOT EXISTS idx_categorias_deletado ON public.categorias (deletado);
CREATE INDEX IF NOT EXISTS idx_equipe_deletado ON public.equipe (deletado);
