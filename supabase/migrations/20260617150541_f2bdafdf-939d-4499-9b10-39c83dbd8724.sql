DROP POLICY IF EXISTS "auth users manage orcamento_grupos" ON public.orcamento_grupos;

CREATE POLICY "Users manage orcamento_grupos by empresa"
ON public.orcamento_grupos
FOR ALL
TO authenticated
USING (empresa_id = public.get_empresa_id(auth.uid()))
WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));