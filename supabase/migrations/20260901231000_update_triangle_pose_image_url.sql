UPDATE public.exercises
SET image_url = 'https://locsjrjekkyjbeapgreu.supabase.co/storage/v1/object/public/Images/Excercise/a-female-doing-yoga.svg'
WHERE name ILIKE '%triangle%' OR id = '3';
