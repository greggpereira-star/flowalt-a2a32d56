-- Enable realtime for dda_boletos table
ALTER TABLE public.dda_boletos REPLICA IDENTITY FULL;

-- Add dda_boletos to realtime publication (handle if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'dda_boletos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dda_boletos;
  END IF;
END $$;