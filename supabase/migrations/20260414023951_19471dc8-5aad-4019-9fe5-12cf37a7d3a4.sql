ALTER TABLE public.crm_orcamentos
ADD COLUMN frete_vencimento date DEFAULT NULL,
ADD COLUMN imposto_vencimento date DEFAULT NULL;