
-- Add data_aniversario to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS data_aniversario date;

-- Add data_aniversario to fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS data_aniversario date;

-- Add new fields to crm_orcamentos
ALTER TABLE public.crm_orcamentos ADD COLUMN IF NOT EXISTS data_pagamento_avista date;
ALTER TABLE public.crm_orcamentos ADD COLUMN IF NOT EXISTS data_envio_proposta date;

-- Add em_pausa to status_projeto enum
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'em_pausa';
