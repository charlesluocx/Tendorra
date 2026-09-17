INSERT INTO public.consultant_categories (name, is_predefined, status, is_continuing)
SELECT 'MEP Engineer', true, 'active', false
WHERE NOT EXISTS (SELECT 1 FROM public.consultant_categories WHERE name = 'MEP Engineer');

UPDATE public.consultant_categories
SET status = 'hidden'
WHERE name IN ('Hydraulic Engineer', 'Electrical Engineer', 'Mechanical Engineer');
