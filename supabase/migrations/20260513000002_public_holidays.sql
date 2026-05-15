-- Public holidays table
-- scope = 'national' | 'madrid' | 'barcelona' | 'valencia' | 'malaga' | 'zaragoza'
CREATE TABLE public_holidays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date NOT NULL,
  name       text NOT NULL,
  scope      text NOT NULL, -- 'national' or office name
  year       integer GENERATED ALWAYS AS (EXTRACT(year FROM date)::integer) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, scope)
);

-- Only admins can write; everyone authenticated can read
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all" ON public_holidays
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super-admin')
    )
  );

CREATE POLICY "authenticated_read" ON public_holidays
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed with the existing hardcoded holidays so the DB is immediately usable

-- NATIONAL
INSERT INTO public_holidays (date, name, scope) VALUES
  -- 2025
  ('2025-01-01', 'Año Nuevo', 'national'),
  ('2025-01-06', 'Reyes Magos', 'national'),
  ('2025-04-18', 'Viernes Santo', 'national'),
  ('2025-05-01', 'Día del Trabajo', 'national'),
  ('2025-08-15', 'Asunción de la Virgen', 'national'),
  ('2025-10-12', 'Fiesta Nacional de España', 'national'),
  ('2025-11-01', 'Todos los Santos', 'national'),
  ('2025-12-06', 'Día de la Constitución', 'national'),
  ('2025-12-08', 'Inmaculada Concepción', 'national'),
  ('2025-12-25', 'Navidad', 'national'),
  -- 2026
  ('2026-01-01', 'Año Nuevo', 'national'),
  ('2026-01-06', 'Reyes Magos', 'national'),
  ('2026-04-03', 'Viernes Santo', 'national'),
  ('2026-05-01', 'Día del Trabajo', 'national'),
  ('2026-08-15', 'Asunción de la Virgen', 'national'),
  ('2026-10-12', 'Fiesta Nacional de España', 'national'),
  ('2026-11-01', 'Todos los Santos', 'national'),
  ('2026-12-06', 'Día de la Constitución', 'national'),
  ('2026-12-08', 'Inmaculada Concepción', 'national'),
  ('2026-12-25', 'Navidad', 'national')
ON CONFLICT (date, scope) DO NOTHING;

-- MADRID
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2025-03-21', 'Jueves Santo', 'madrid'),
  ('2025-05-02', 'Fiesta de la Comunidad de Madrid', 'madrid'),
  ('2025-11-10', 'Almudena', 'madrid'),
  ('2025-12-26', 'Puente', 'madrid'),
  ('2026-03-19', 'San José', 'madrid'),
  ('2026-04-02', 'Jueves Santo', 'madrid'),
  ('2026-05-15', 'San Isidro', 'madrid'),
  ('2026-11-09', 'Almudena', 'madrid')
ON CONFLICT (date, scope) DO NOTHING;

-- BARCELONA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2025-04-21', 'Lunes de Pascua', 'barcelona'),
  ('2025-06-24', 'San Juan', 'barcelona'),
  ('2025-09-11', 'Diada Nacional de Catalunya', 'barcelona'),
  ('2025-09-24', 'La Mercè', 'barcelona'),
  ('2025-12-26', 'San Esteban', 'barcelona'),
  ('2026-04-06', 'Lunes de Pascua', 'barcelona'),
  ('2026-06-24', 'San Juan', 'barcelona'),
  ('2026-09-11', 'Diada Nacional de Catalunya', 'barcelona'),
  ('2026-09-24', 'La Mercè', 'barcelona'),
  ('2026-12-26', 'San Esteban', 'barcelona')
ON CONFLICT (date, scope) DO NOTHING;

-- VALENCIA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2025-03-19', 'San José', 'valencia'),
  ('2025-04-21', 'Lunes de Pascua', 'valencia'),
  ('2025-10-09', 'Dia de la Comunitat Valenciana', 'valencia'),
  ('2026-03-19', 'San José', 'valencia'),
  ('2026-04-06', 'Lunes de Pascua', 'valencia'),
  ('2026-10-09', 'Dia de la Comunitat Valenciana', 'valencia')
ON CONFLICT (date, scope) DO NOTHING;

-- MÁLAGA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2025-02-28', 'Día de Andalucía', 'malaga'),
  ('2025-04-17', 'Jueves Santo', 'malaga'),
  ('2025-08-19', 'Feria de Málaga', 'malaga'),
  ('2026-02-28', 'Día de Andalucía', 'malaga'),
  ('2026-03-02', 'Traslado Día de Andalucía', 'malaga'),
  ('2026-04-02', 'Jueves Santo', 'malaga'),
  ('2026-08-19', 'Feria de Málaga', 'malaga')
ON CONFLICT (date, scope) DO NOTHING;

-- ZARAGOZA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2025-01-27', 'Santo Tomás de Aquino', 'zaragoza'),
  ('2025-04-17', 'Jueves Santo', 'zaragoza'),
  ('2025-04-23', 'San Jorge — Día de Aragón', 'zaragoza'),
  ('2025-10-13', 'El Pilar (traslado)', 'zaragoza'),
  ('2026-01-27', 'Santo Tomás de Aquino', 'zaragoza'),
  ('2026-04-02', 'Jueves Santo', 'zaragoza'),
  ('2026-04-23', 'San Jorge — Día de Aragón', 'zaragoza'),
  ('2026-10-13', 'Fiesta local Zaragoza', 'zaragoza')
ON CONFLICT (date, scope) DO NOTHING;
