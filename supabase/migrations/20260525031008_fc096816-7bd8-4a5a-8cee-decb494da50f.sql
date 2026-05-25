-- Create unique constraint for user_id and empresa_id on anotacoes_usuario table
-- This is required for the upsert functionality in the Dashboard to work correctly.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'anotacoes_usuario_user_empresa_unique'
    ) THEN
        ALTER TABLE public.anotacoes_usuario 
        ADD CONSTRAINT anotacoes_usuario_user_empresa_unique UNIQUE (user_id, empresa_id);
    END IF;
END $$;