-- Insert default venues (salones) that match the import template
INSERT INTO public.venues (name, capacity, location) VALUES
  ('ROSALIA', 200, 'Planta Baja'),
  ('PONDAL', 150, 'Planta Baja'),
  ('CASTELAO', 250, 'Primera Planta'),
  ('CURROS', 100, 'Primera Planta'),
  ('CUNQUEIRO', 80, 'Segunda Planta'),
  ('HALL', 50, 'Entrada'),
  ('RESTAURANTE', 120, 'Planta Baja'),
  ('BAR', 40, 'Planta Baja')
ON CONFLICT DO NOTHING;

-- Insert default units
INSERT INTO public.units (name, abbreviation) VALUES
  ('Kilogramo', 'kg'),
  ('Gramo', 'g'),
  ('Litro', 'L'),
  ('Mililitro', 'ml'),
  ('Unidad', 'ud'),
  ('Docena', 'doc'),
  ('Caja', 'caja'),
  ('Bolsa', 'bolsa'),
  ('Paquete', 'paq')
ON CONFLICT DO NOTHING;

-- Insert default product categories
INSERT INTO public.product_categories (name, description) VALUES
  ('Aceites', 'Aceites y grasas'),
  ('Harinas', 'Harinas y cereales'),
  ('Vegetales', 'Verduras y hortalizas'),
  ('Lácteos', 'Productos lácteos'),
  ('Pescados', 'Pescados y mariscos'),
  ('Carnes', 'Carnes y aves'),
  ('Granos', 'Arroz, legumbres'),
  ('Huevos', 'Huevos'),
  ('Condimentos', 'Especias y condimentos'),
  ('Bebidas', 'Bebidas'),
  ('Panadería', 'Pan y bollería'),
  ('Congelados', 'Productos congelados')
ON CONFLICT DO NOTHING;