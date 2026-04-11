ALTER TABLE public.produtos
ADD COLUMN fornecedor_id uuid REFERENCES public.fornecedores(id) DEFAULT NULL;