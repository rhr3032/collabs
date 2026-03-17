ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS priority_reason text;