-- Add image_url column to public.exercises table if it doesn't already exist
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Comment on column
COMMENT ON COLUMN public.exercises.image_url IS 'Optional image URL for the exercise icon display';
