
CREATE TABLE public.google_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expiry_date timestamp with time zone,
  google_calendar_id text DEFAULT 'primary',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own google integration"
ON public.google_integrations
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_google_integrations_updated_at
BEFORE UPDATE ON public.google_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add google_event_id to visitas_tecnicas for sync tracking
ALTER TABLE public.visitas_tecnicas
ADD COLUMN google_event_id text DEFAULT NULL;
