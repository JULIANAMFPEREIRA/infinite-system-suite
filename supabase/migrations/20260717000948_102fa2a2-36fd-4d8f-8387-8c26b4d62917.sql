UPDATE public.crm_orcamentos o
SET status_kanban = 'concluido'
WHERE o.status_kanban IS NULL
  AND o.aprovado = true
  AND EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.cliente_id = o.cliente_id
      AND p.status = 'concluido'
      AND p.deletado = false
  );