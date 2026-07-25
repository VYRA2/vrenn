-- Renomear coluna aposta_creditos → custodia_creditos em duelos
-- (palavra "aposta" é permanentemente banida do VRENN)
ALTER TABLE public.duelos
  RENAME COLUMN aposta_creditos TO custodia_creditos;

NOTIFY pgrst, 'reload schema';
