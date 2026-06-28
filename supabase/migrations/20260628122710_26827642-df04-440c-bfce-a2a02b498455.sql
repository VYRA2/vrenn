
ALTER TABLE public.duelos
  ADD CONSTRAINT duelos_challenger_profile_fk FOREIGN KEY (challenger_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT duelos_opponent_profile_fk FOREIGN KEY (opponent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
