-- Add columns to empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add is_active to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure crm-files bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-files', 'crm-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public access to logos
CREATE POLICY "Public Access to Logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'crm-files');

-- Create policy for authenticated uploads to logos
CREATE POLICY "Authenticated Uploads to Logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'crm-files' AND auth.role() = 'authenticated');
