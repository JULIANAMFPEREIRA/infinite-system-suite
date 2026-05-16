-- Add email column to profiles if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Populate email column from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Since the user asked for logic changes in the frontend to show email, 
-- we need to make sure this column is readable via RLS if it's not already.
-- Assuming profiles are readable by the user's company members.
