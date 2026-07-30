ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, username, avatar_url, onboarding_done)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || substr(NEW.id::text, 1, 4)),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;