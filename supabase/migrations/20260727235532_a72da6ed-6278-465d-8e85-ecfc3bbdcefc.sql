ALTER TABLE public.metas            ADD COLUMN IF NOT EXISTS subcategoria text;
ALTER TABLE public.duelos           ADD COLUMN IF NOT EXISTS subcategoria text;
ALTER TABLE public.desafios_equipe  ADD COLUMN IF NOT EXISTS subcategoria text;