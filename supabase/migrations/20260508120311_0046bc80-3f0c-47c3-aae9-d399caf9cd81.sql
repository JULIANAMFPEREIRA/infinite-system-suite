-- Create tables for the INFINIT Network Authorization System

-- Authorizations table
CREATE TABLE public.authorizations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded')),
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

-- Authorization items table
CREATE TABLE public.authorization_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    authorization_id UUID NOT NULL REFERENCES public.authorizations(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    description TEXT,
    response TEXT CHECK (response IN ('approved', 'rejected')),
    observation TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorization_items ENABLE ROW LEVEL SECURITY;

-- Policies for authorizations
CREATE POLICY "Public can view authorizations by slug" 
ON public.authorizations FOR SELECT 
USING (true);

CREATE POLICY "Public can update authorizations status" 
ON public.authorizations FOR UPDATE 
USING (status = 'pending');

CREATE POLICY "Authenticated users have full access to authorizations" 
ON public.authorizations FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Policies for authorization_items
CREATE POLICY "Public can view items for public authorizations" 
ON public.authorization_items FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.authorizations 
    WHERE id = authorization_items.authorization_id
));

CREATE POLICY "Public can update item responses" 
ON public.authorization_items FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.authorizations 
    WHERE id = authorization_items.authorization_id AND status = 'pending'
));

CREATE POLICY "Authenticated users have full access to authorization_items" 
ON public.authorization_items FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for authorization_items
CREATE TRIGGER update_authorization_items_updated_at
BEFORE UPDATE ON public.authorization_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
