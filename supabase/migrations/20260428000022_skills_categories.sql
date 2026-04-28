-- ============================================================
-- Add category to skills table and seed predefined skills
-- ============================================================

-- 1. Add category column
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Frontend';

-- 2. Replace the name-only unique index with a (name, category) one
--    so the same skill name can exist in different categories if needed.
DROP INDEX IF EXISTS skills_name_ci;
CREATE UNIQUE INDEX skills_name_category_ci ON public.skills (lower(name), lower(category));

-- 3. Restrict skill creation to admins; add admin delete policy
DROP POLICY IF EXISTS "skills_insert" ON public.skills;

CREATE POLICY "skills_insert"
  ON public.skills FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "skills_delete"
  ON public.skills FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. Seed predefined skills
INSERT INTO public.skills (name, category) VALUES
  -- Frontend
  ('Angular',                              'Frontend'),
  ('React',                                'Frontend'),
  ('Vue',                                  'Frontend'),
  ('Diseño UI/UX',                         'Frontend'),
  ('Maquetación',                          'Frontend'),
  -- Backend
  ('Spring',                               'Backend'),
  ('Quarkus',                              'Backend'),
  ('Python APIs (FastAPI, Flask, etc)',     'Backend'),
  ('Node (Express, etc)',                  'Backend'),
  ('Loopback',                             'Backend'),
  -- BBDD
  ('Relacional',                           'BBDD'),
  ('No relacional',                        'BBDD'),
  ('Cloud',                                'BBDD'),
  ('AWS',                                  'BBDD'),
  ('Azure',                                'BBDD'),
  ('GCP',                                  'BBDD'),
  -- Infra/DevOps
  ('Terraform',                            'Infra/DevOps'),
  ('Kubernetes',                           'Infra/DevOps'),
  ('Docker',                               'Infra/DevOps'),
  ('CI/CD',                                'Infra/DevOps'),
  -- Arquitectura
  ('Microservicios',                       'Arquitectura'),
  ('Basada en eventos',                    'Arquitectura'),
  ('API Rest',                             'Arquitectura'),
  ('Diseño en cloud',                      'Arquitectura'),
  -- IA/Data
  ('RAG',                                  'IA/Data'),
  ('LLMs/IA generativa',                   'IA/Data'),
  ('Integración con agentes',              'IA/Data'),
  ('Machine learning',                     'IA/Data'),
  ('Big Data',                             'IA/Data')
ON CONFLICT DO NOTHING;
