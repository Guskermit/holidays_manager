# Arquitectura del Proyecto — Holidays Manager

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend & Backend | [Next.js](https://nextjs.org/) (App Router) |
| Base de datos & Auth | [Supabase](https://supabase.com/) (PostgreSQL + Auth) |
| Despliegue | [Vercel](https://vercel.com/) |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| Lenguaje | TypeScript |

---

## Descripción General

Aplicación web para la gestión de proyectos, empleados y vacaciones dentro de una organización. Permite:

- Administrar proyectos con sus fechas de vigencia.
- Gestionar empleados asociados a uno o más proyectos.
- Controlar el saldo de vacaciones de cada empleado según su categoría.
- Permitir que los empleados soliciten vacaciones y que sus responsables las aprueben o rechacen.

---

## Modelo de Datos

### Diagrama de Entidades

```
categories ──────── employees ──────────────── vacation_requests
                       │    │                        │
                       │    └── employee_projects     │
                    manager       │                   │
                   (self-ref)   projects          (approved_by)
                                                    employees
departments ────── employees
```

---

### Tablas

#### `categories` — Categorías de empleado

Define las categorías profesionales y los días de vacaciones que corresponden a cada una.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `name` | `text` NOT NULL UNIQUE | Nombre de la categoría (ej. Junior, Senior, Manager) |
| `vacation_days` | `integer` NOT NULL | Días de vacaciones anuales asignados a esta categoría |
| `created_at` | `timestamptz` | Fecha de creación |

---

#### `departments` — Departamentos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `name` | `text` NOT NULL UNIQUE | Nombre del departamento |
| `created_at` | `timestamptz` | Fecha de creación |

---

#### `employees` — Empleados

Representa a cada empleado de la organización. Vinculado al sistema de autenticación de Supabase.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `user_id` | `uuid` FK → `auth.users` UNIQUE | Usuario de Supabase Auth |
| `name` | `text` NOT NULL | Nombre completo del empleado |
| `email` | `text` NOT NULL UNIQUE | Correo electrónico |
| `category_id` | `uuid` FK → `categories` | Categoría profesional |
| `department_id` | `uuid` FK → `departments` | Departamento al que pertenece |
| `manager_id` | `uuid` FK → `employees` (self) | Responsable directo (nullable) |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

---

#### `projects` — Proyectos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_engagement` | `text` PK | Identificador de engagement (clave primaria de negocio) |
| `name` | `text` NOT NULL | Nombre del proyecto |
| `start_date` | `date` NOT NULL | Fecha de inicio |
| `end_date` | `date` | Fecha de fin (nullable si está en curso) |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

---

#### `employee_projects` — Asignación Empleado ↔ Proyecto

Tabla de unión para la relación muchos-a-muchos entre empleados y proyectos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `employee_id` | `uuid` FK → `employees` NOT NULL | Empleado asignado |
| `project_id` | `text` FK → `projects.id_engagement` NOT NULL | Proyecto asignado |
| `role` | `text` | Rol del empleado en el proyecto (nullable) |
| `assigned_at` | `date` | Fecha de incorporación al proyecto |
| `unassigned_at` | `date` | Fecha de salida del proyecto (nullable) |

**Constraint:** `UNIQUE (employee_id, project_id)`

---

#### `vacation_requests` — Solicitudes de Vacaciones

Registra cada solicitud de vacaciones de un empleado, su estado y la resolución del responsable.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `employee_id` | `uuid` FK → `employees` NOT NULL | Empleado solicitante |
| `start_date` | `date` NOT NULL | Primer día de vacaciones |
| `end_date` | `date` NOT NULL | Último día de vacaciones |
| `days_requested` | `integer` NOT NULL | Días hábiles solicitados |
| `status` | `text` NOT NULL | Estado: `pending` \| `approved` \| `rejected` \| `cancelled` |
| `approved_by` | `uuid` FK → `employees` | Responsable que resolvió la solicitud (nullable) |
| `resolved_at` | `timestamptz` | Fecha de resolución (nullable) |
| `rejection_reason` | `text` | Motivo de rechazo (nullable) |
| `notes` | `text` | Observaciones del empleado (nullable) |
| `year` | `integer` NOT NULL | Año al que corresponden las vacaciones |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

---

#### `vacation_balances` — Saldo de Vacaciones

Mantiene el saldo anual de vacaciones por empleado. Se actualiza al aprobar o rechazar solicitudes.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | Identificador único |
| `employee_id` | `uuid` FK → `employees` NOT NULL | Empleado |
| `year` | `integer` NOT NULL | Año de referencia |
| `total_days` | `integer` NOT NULL | Días totales asignados (según categoría) |
| `used_days` | `integer` NOT NULL DEFAULT 0 | Días aprobados y consumidos |
| `pending_days` | `integer` NOT NULL DEFAULT 0 | Días en solicitudes pendientes de aprobación |

**Columna derivada:** `remaining_days = total_days - used_days - pending_days`

**Constraint:** `UNIQUE (employee_id, year)`

---

### Relaciones Clave

```
categories    1──N  employees
departments   1──N  employees
employees     1──N  employees         (manager_id, autoreferencia)
employees     N──M  projects          (via employee_projects)
employees     1──N  vacation_requests (como solicitante)
employees     1──N  vacation_requests (como aprobador, approved_by)
employees     1──N  vacation_balances
```

---

## Flujo de Negocio: Solicitud de Vacaciones

```
Empleado crea solicitud (status: pending)
        │
        ▼
Se incrementa vacation_balances.pending_days
        │
        ▼
Responsable revisa la solicitud
        │
   ┌────┴────┐
   │         │
Aprueba    Rechaza
   │         │
   ▼         ▼
used_days  pending_days
    +N         -N
pending_days  (sin cambio en used_days)
    -N
```

---

## Estructura de la Aplicación (App Router)

```
app/
├── auth/                  # Rutas de autenticación (login, sign-up, etc.)
├── protected/             # Rutas protegidas (requieren sesión)
│   ├── projects/          # CRUD de proyectos
│   ├── employees/         # CRUD de empleados
│   └── vacations/         # Gestión de vacaciones
│       ├── requests/      # Listado y aprobación de solicitudes
│       └── balance/       # Saldo de vacaciones
└── layout.tsx
```

---

## Autenticación y Autorización

- **Autenticación:** Supabase Auth (email/password). Cada empleado tiene un `user_id` vinculado a `auth.users`.
- **Enlace `auth.users` ↔ `employees`:** Un trigger de PostgreSQL (`on_auth_user_created`) se ejecuta automáticamente después de cada `INSERT` en `auth.users`. Lee `raw_user_meta_data ->> 'full_name'` y el `email` para crear la fila correspondiente en `public.employees`. El formulario de registro pasa `full_name` como metadata usando `options.data`.
- **Autorización:** Row Level Security (RLS) de Supabase.
  - Un empleado sólo puede ver y crear sus propias solicitudes de vacaciones.
  - Un responsable (`manager_id`) puede ver y resolver las solicitudes de sus subordinados.
  - Los administradores tienen acceso completo a proyectos, empleados y categorías.

---

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Solo en servidor, nunca exponer al cliente
```
