
-- Fix: Remove auth.users references from arquiteto policies (causes "permission denied for table users")

-- Drop broken policies
DROP POLICY IF EXISTS "Arquiteto sees own projetos" ON public.projetos;
DROP POLICY IF EXISTS "Arquiteto sees own comissoes" ON public.comissoes;

-- Recreate using auth.jwt()->>'email' instead of auth.users
CREATE POLICY "Arquiteto sees own projetos" ON public.projetos
FOR SELECT TO authenticated
USING (
  empresa_id = get_empresa_id(auth.uid())
  AND has_role(auth.uid(), 'arquiteto'::app_role)
  AND arquiteto_id IN (
    SELECT id FROM fornecedores
    WHERE email = (auth.jwt()->>'email')
  )
);

CREATE POLICY "Arquiteto sees own comissoes" ON public.comissoes
FOR SELECT TO authenticated
USING (
  empresa_id = get_empresa_id(auth.uid())
  AND has_role(auth.uid(), 'arquiteto'::app_role)
  AND fornecedor_id IN (
    SELECT id FROM fornecedores
    WHERE email = (auth.jwt()->>'email')
  )
);
