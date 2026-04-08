-- Add new status_projeto enum values
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'infraestrutura';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'instalacao';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'cabeamento';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'programacao';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'personalizacao';

-- Add hora and status_visita to visitas_tecnicas
ALTER TABLE public.visitas_tecnicas ADD COLUMN IF NOT EXISTS hora text;
ALTER TABLE public.visitas_tecnicas ADD COLUMN IF NOT EXISTS status_visita text NOT NULL DEFAULT 'agendada';