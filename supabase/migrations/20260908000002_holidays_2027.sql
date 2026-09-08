-- Seed public holidays for 2027
-- Source: Nager.Date API (https://date.nager.at/api/v3/PublicHolidays/2027/ES)
-- Regional holidays added based on official community calendars.

-- NATIONAL
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2027-01-01', 'Año Nuevo', 'national'),
  ('2027-01-06', 'Día de Reyes / Epifanía del Señor', 'national'),
  ('2027-03-26', 'Viernes Santo', 'national'),
  ('2027-05-01', 'Fiesta del trabajo', 'national'),
  ('2027-08-15', 'Asunción de la Virgen', 'national'),
  ('2027-10-12', 'Fiesta Nacional de España', 'national'),
  ('2027-11-01', 'Todos los Santos', 'national'),
  ('2027-12-06', 'Día de la Constitución', 'national'),
  ('2027-12-08', 'Inmaculada Concepción', 'national'),
  ('2027-12-25', 'Navidad', 'national')
ON CONFLICT (date, scope) DO NOTHING;

-- MADRID
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2027-03-25', 'Jueves Santo', 'madrid'),
  ('2027-05-02', 'Fiesta de la Comunidad de Madrid', 'madrid'),
  ('2027-11-02', 'Almudena (traslado)', 'madrid')
ON CONFLICT (date, scope) DO NOTHING;

-- BARCELONA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2027-03-29', 'Lunes de Pascua', 'barcelona'),
  ('2027-06-24', 'San Juan', 'barcelona'),
  ('2027-09-11', 'Diada Nacional de Catalunya', 'barcelona'),
  ('2027-12-26', 'San Esteban', 'barcelona')
ON CONFLICT (date, scope) DO NOTHING;

-- VALENCIA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2027-03-19', 'San José', 'valencia'),
  ('2027-03-29', 'Lunes de Pascua', 'valencia'),
  ('2027-10-09', 'Dia de la Comunitat Valenciana', 'valencia')
ON CONFLICT (date, scope) DO NOTHING;

-- MÁLAGA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2027-02-28', 'Día de Andalucía', 'malaga'),
  ('2027-03-25', 'Jueves Santo', 'malaga')
ON CONFLICT (date, scope) DO NOTHING;

-- ZARAGOZA
INSERT INTO public_holidays (date, name, scope) VALUES
  ('2027-03-25', 'Jueves Santo', 'zaragoza'),
  ('2027-04-23', 'San Jorge — Día de Aragón', 'zaragoza')
ON CONFLICT (date, scope) DO NOTHING;
