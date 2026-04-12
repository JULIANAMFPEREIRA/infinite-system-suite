-- Create a helper function
CREATE OR REPLACE FUNCTION public.get_fornecedor_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.fornecedores WHERE email = _email LIMIT 1;
$$;

-- Add RLS policy for funcionario to see only linked projects
CREATE POLICY "Funcionario sees linked projetos"
ON public.projetos
FOR SELECT
TO authenticated
USING (
  empresa_id = get_empresa_id(auth.uid())
  AND has_role(auth.uid(), 'funcionario'::app_role)
  AND (
    arquiteto_id IN (
      SELECT id FROM fornecedores WHERE email = (auth.jwt() ->> 'email'::text)
    )
    OR cliente_id IN (
      SELECT id FROM clientes WHERE email = (auth.jwt() ->> 'email'::text)
    )
  )
);

-- Funcionario sees own comissoes only
CREATE POLICY "Funcionario sees own comissoes"
ON public.comissoes
FOR SELECT
TO authenticated
USING (
  empresa_id = get_empresa_id(auth.uid())
  AND has_role(auth.uid(), 'funcionario'::app_role)
  AND fornecedor_id IN (
    SELECT id FROM fornecedores WHERE email = (auth.jwt() ->> 'email'::text)
  )
);