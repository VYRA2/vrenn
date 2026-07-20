ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET onboarding_done = true WHERE created_at < now();