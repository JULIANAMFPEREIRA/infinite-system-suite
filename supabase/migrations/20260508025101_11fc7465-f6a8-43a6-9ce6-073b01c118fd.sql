-- Adiciona o valor 'concluido' ao enum status_crm
ALTER TYPE public.status_crm ADD VALUE IF NOT EXISTS 'concluido';