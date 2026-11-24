# API Web Service — Holidays Manager

Base URL: `http://localhost:4000`

No authentication required for GET endpoints. The PUT endpoint (Endpoint 4) requires a secret token.

---

## Endpoint 1 — Get Engagement & Employees

```
GET /api/engagements/{code}
```

### Path Params

| Param  | Type   | Description                   |
| ------ | ------ | ----------------------------- |
| `code` | string | **Required.** Engagement code |

### Example

```bash
curl http://localhost:4000/api/engagements/ENG-2026-001
```

### Response (200 OK)

```json
{
  "engagement": {
    "id": "a1b2c3d4-...",
    "code": "ENG-2026-001",
    "name": "Backend Development",
    "client_id": "proj-123",
    "client_name": "Acme Corp",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "total_amount": 50000,
    "estimated_expenses": 5000
  },
  "employees": [
    {
      "id": "emp-uuid-1",
      "name": "Ana García",
      "category": "Senior",
      "office": "madrid",
      "imputaciones": [
        { "start_date": "2026-01-01", "end_date": "2026-06-30", "weekly_hours": 42 },
        { "start_date": "2026-07-01", "end_date": null, "weekly_hours": 30 }
      ]
    }
  ]
}
```

### Field Reference — `engagement`

| Field              | Type    | Description                                   |
| ------------------ | ------- | --------------------------------------------- |
| `id`               | uuid    | Internal engagement ID                        |
| `code`             | string  | Engagement code (the lookup key)              |
| `name`             | string  | Engagement name                               |
| `client_id`        | string  | Internal client/project ID                    |
| `client_name`      | string  | Human-readable client name                    |
| `start_date`       | string  | Start date (`YYYY-MM-DD` or null)             |
| `end_date`         | string  | End date (`YYYY-MM-DD` or null)               |
| `total_amount`     | number  | Total contract amount                         |
| `estimated_expenses` | number | Estimated expenses                          |

### Field Reference — `employees[]`

| Field      | Type           | Description                                                   |
| ---------- | -------------- | ------------------------------------------------------------- |
| `id`       | uuid           | Employee ID                                                   |
| `name`     | string         | Full name                                                     |
| `category` | string         | `Staff`, `Senior`, `Manager`, `Senior-Manager`, `Externo`, `Socio`, `Intern` |
| `office`   | string \| null | `madrid`, `barcelona`, `valencia`, `málaga`, `zaragoza`, `sevilla` |

### Field Reference — `employees[].imputaciones[]`

| Field          | Type           | Description                                    |
| -------------- | -------------- | ---------------------------------------------- |
| `start_date`   | string         | Period start (`YYYY-MM-DD`)                    |
| `end_date`     | string \| null | Period end (`YYYY-MM-DD`). `null` = open-ended |
| `weekly_hours` | number         | Hours per week during this period              |

### Errors

| Status | Cause                       |
| ------ | --------------------------- |
| 404    | Engagement code not found   |
| 500    | Database error              |

---

## Endpoint 2 — Send Notification

```
GET /api/notifications/send
```

### Query Params

| Param       | Type   | Description                                                              |
| ----------- | ------ | ------------------------------------------------------------------------ |
| `title`     | string | **Required.** Notification title                                         |
| `message`   | string | **Required.** Notification body text                                     |
| `employees` | string | **Required.** Comma-separated employee IDs (e.g. `uuid1,uuid2`). Use the IDs from the engagements endpoint |
| `from`      | string | Optional. Sender employee ID. Defaults to the first admin employee       |

### Example

```bash
curl "http://localhost:4000/api/notifications/send?title=Alerta&message=Tu+licencia+expira+en+3+d%C3%ADas&employees=emp-uuid-1,emp-uuid-2"
```

### Response (200 OK)

```json
{
  "notification_id": "b2c3d4e5-...",
  "title": "Alerta",
  "message": "Tu licencia expira en 3 días",
  "recipients_notified": 2,
  "recipients": [
    { "id": "emp-uuid-1", "name": "Ana García", "email": "ana@acme.com" },
    { "id": "emp-uuid-2", "name": "Carlos López", "email": "carlos@acme.com" }
  ]
}
```

### Errors

| Status | Cause                                      |
| ------ | ------------------------------------------ |
| 400    | Missing required parameter                 |
| 404    | No employees found for the provided IDs    |
| 500    | Database error or no admin found           |

### Notes

- The notification appears in the app's notification bell for each recipient.
- If `from` is not provided, the first admin employee is used as the sender.
- Duplicate IDs are automatically deduplicated.
- **Typical flow:** Call the engagements endpoint first to get employee IDs, then use those IDs here to send notifications.

---

## Endpoint 3 — Get Employee Time-Off

```
GET /api/employees/{email}/time-off
```

Returns the vacations, official holidays and non-working days of an employee, looked up by their email. Weekends are **not** included in `non_working_days`.

### Path Params

| Param   | Type   | Description                                       |
| ------- | ------ | ------------------------------------------------- |
| `email` | string | **Required.** Employee email (URL-encoded if needed, e.g. `ana%40acme.com`) |

### Query Params

| Param  | Type   | Description                                                     |
| ------ | ------ | --------------------------------------------------------------- |
| `year` | string | Optional. Year to query. Defaults to the current year (2000–2100) |

### Example

```bash
curl "http://localhost:4000/api/employees/ana%40acme.com/time-off?year=2026"
```

### Response (200 OK)

```json
{
  "employee": {
    "id": "emp-uuid-1",
    "name": "Ana García",
    "email": "ana@acme.com",
    "office": "madrid",
    "category": "Senior"
  },
  "year": 2026,
  "vacations": [
    {
      "start_date": "2026-08-10",
      "end_date": "2026-08-21",
      "days_requested": 10,
      "status": "approved",
      "type": "vacation"
    },
    {
      "start_date": "2026-05-04",
      "end_date": "2026-05-05",
      "days_requested": 2,
      "status": "pending",
      "type": "bootcamp"
    }
  ],
  "public_holidays": [
    { "date": "2026-01-01", "name": "Año Nuevo", "scope": "national" },
    { "date": "2026-05-15", "name": "San Isidro", "scope": "madrid" }
  ],
  "non_working_days": ["2026-01-01", "2026-05-15", "2026-08-10", "2026-08-11"]
}
```

### Field Reference — `employee`

| Field      | Type           | Description                                       |
| ---------- | -------------- | ------------------------------------------------- |
| `id`       | uuid           | Employee ID                                      |
| `name`     | string         | Full name                                         |
| `email`    | string         | Employee email                                    |
| `office`   | string \| null | `madrid`, `barcelona`, `valencia`, `malaga`, `zaragoza`, `sevilla` |
| `category` | string         | Employee category                                 |

### Field Reference — `vacations[]`

| Field            | Type           | Description                                                            |
| ---------------- | -------------- | ---------------------------------------------------------------------- |
| `start_date`     | string         | Time-off start (`YYYY-MM-DD`)                                          |
| `end_date`       | string         | Time-off end (`YYYY-MM-DD`)                                            |
| `days_requested` | number         | Working days requested                                                 |
| `status`         | string         | `approved` or `pending` (rejected/cancelled are excluded)              |
| `type`           | string         | `vacation`, `bootcamp`, `medical_leave` or `other`                     |

### Field Reference — `public_holidays[]`

| Field   | Type   | Description                                          |
| ------- | ------ | ---------------------------------------------------- |
| `date`  | string | Holiday date (`YYYY-MM-DD`)                          |
| `name`  | string | Holiday name                                         |
| `scope` | string | `national` or the employee's office                  |

### Field Reference — `non_working_days`

Sorted array of `YYYY-MM-DD` dates the employee does not work: official holidays (national + office) plus **approved** time-off ranges. Weekends are always excluded.

### Errors

| Status | Cause                                    |
| ------ | ---------------------------------------- |
| 400    | Missing email or invalid `year` param    |
| 404    | No employee found for the provided email |
| 500    | Database error                           |

### Notes

- Holidays are resolved against the employee's office: national holidays plus office-specific ones.
- Pending vacations are returned in `vacations[]` but do **not** count towards `non_working_days` — only approved ones do.
- If the employee has no office, only national holidays are returned.

---

## Endpoint 4 — Push Weekly Imputaciones (Consola)

```
PUT /api/imputaciones
```

Receives the weekly imputation file generated by the external console (`formato: "consola-imputaciones/semanal"`) and stores it in `employee_console_imputations`, which feeds the employee dashboard ("Imputaciones de la semana") and the read-only admin grid at `/main/admin/employee-imputaciones`.

### Auth

Required header (one of):

| Header                    | Value                   |
| ------------------------- | ----------------------- |
| `x-api-key`               | `IMPUTACIONES_API_TOKEN` |
| `Authorization`           | `Bearer <IMPUTACIONES_API_TOKEN>` |

### Semantics

- **Week replacement per employee.** For each `(email, lunes)` present in the payload, any existing imputations for that employee and week are deleted first and replaced with the incoming records. Weeks or employees not present in the payload are left untouched.
- Unknown **emails** or **engagement codes** are stored anyway (`employee_id` stays `null` for unknown emails) and reported in `incidencias` with HTTP **207**.
- The `forzado` / `pendiente` flags are ignored (not stored).
- Week key (`lunes`) = the `lunes` field when provided, otherwise the Monday of the ISO week containing `semana`.

### Request Body

```json
{
  "formato": "consola-imputaciones/semanal",
  "version": "1",
  "generado": "2026-11-23T12:00:00Z",
  "fechaCorte": "2026-11-21",
  "redondeo": 0.5,
  "semanas": ["2026-11-21", "2026-11-28"],
  "personas": [
    {
      "email": "gustavo.lopezmartinez@es.ey.com",
      "nombre": "Gustavo Lopez",
      "tipo": "EY",
      "semanas": [
        {
          "semana": "2026-11-27",
          "lunes": "2026-11-23",
          "viernes": "2026-11-27",
          "horas": 40,
          "engagements": [
            { "engagement": "E-1235456", "horas": 32, "forzado": false, "pendiente": false },
            { "engagement": "E-1235457", "horas": 8, "forzado": false, "pendiente": false }
          ]
        }
      ]
    }
  ]
}
```

### Field Reference

| Field                      | Type   | Required | Description                                            |
| -------------------------- | ------ | -------- | ------------------------------------------------------ |
| `personas`                 | array  | yes      | Non-empty list of people                               |
| `personas[].email`         | string | yes      | Employee email (matched case-insensitively)            |
| `personas[].semanas`       | array  | no       | Weeks for that person                                  |
| `...semanas[].semana`      | string | yes      | Week identifier (`YYYY-MM-DD`)                         |
| `...semanas[].lunes`       | string | no       | Week start Monday; derived from `semana` if omitted    |
| `...semanas[].viernes`     | string | no       | Week end; defaults to `lunes + 4` days                 |
| `...engagements[].engagement` | string | yes   | Engagement code (e.g. `E-1235456`)                     |
| `...engagements[].horas`   | number | yes      | Hours to impute (`>= 0`)                               |
| `formato`, `version`, `generado`, `fechaCorte`, `redondeo` | — | no | Stored as audit metadata per row           |

Fields not listed above (`nombre`, `tipo`, top-level `semanas`, week-level `horas`, `forzado`, `pendiente`) are accepted but ignored.

### Example

```bash
curl -X PUT http://localhost:4000/api/imputaciones \
  -H "x-api-key: $IMPUTACIONES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @imputaciones-semanal.json
```

### Response (200 OK)

```json
{
  "status": "ok",
  "personas": 1,
  "filas": 2,
  "incidencias": {
    "emails_desconocidos": [],
    "engagements_desconocidos": []
  }
}
```

### Response (207 Partial Content)

Same body when some emails/engagement codes could not be resolved — the rows are still saved:

```json
{
  "status": "partial",
  "personas": 1,
  "filas": 2,
  "incidencias": {
    "emails_desconocidos": ["no.existe@es.ey.com"],
    "engagements_desconocidos": ["E-9999999"]
  }
}
```

### Errors

| Status | Cause                                              |
| ------ | -------------------------------------------------- |
| 400    | Invalid JSON, missing `personas`, or bad field     |
| 401    | Missing or invalid token                           |
| 500    | `IMPUTACIONES_API_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY` not configured, or database error |

---

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>      # PUT /api/imputaciones only
IMPUTACIONES_API_TOKEN=<secret-shared-with-console>  # PUT /api/imputaciones only
```

> ℹ️ GET endpoints use the **publishable (anon) key** and rely on public RLS policies from migrations `20260826000003_api_public_read_policies.sql` and `20261108000001_api_time_off_read_policies.sql`. The PUT endpoint uses the **service-role key** (after validating its token), so the anon key cannot modify `employee_console_imputations`.

---

## Connection Guide

### Node.js / TypeScript

```typescript
const API = "http://localhost:4000";

// ── Engagement ───────────────────────────────────────────
interface Imputacion {
  start_date: string;
  end_date: string | null;
  weekly_hours: number;
}

interface Employee {
  id: string;
  name: string;
  category: string;
  office: string | null;
  imputaciones: Imputacion[];
}

interface EngagementResponse {
  engagement: {
    id: string;
    code: string;
    name: string;
    client_id: string;
    client_name: string;
    start_date: string | null;
    end_date: string | null;
    total_amount: number;
    estimated_expenses: number;
  };
  employees: Employee[];
}

async function getEngagement(code: string): Promise<EngagementResponse> {
  const res = await fetch(`${API}/api/engagements/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Notification ─────────────────────────────────────────
interface NotificationResponse {
  notification_id: string;
  title: string;
  message: string;
  recipients_notified: number;
  recipients: { id: string; name: string; email: string }[];
}

async function sendNotification(params: {
  title: string;
  message: string;
  employees: string[];    // employee IDs
  from?: string;           // sender employee ID
}): Promise<NotificationResponse> {
  const qs = new URLSearchParams({
    title: params.title,
    message: params.message,
    employees: params.employees.join(","),
  });
  if (params.from) qs.set("from", params.from);

  const res = await fetch(`${API}/api/notifications/send?${qs}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Employee time-off ────────────────────────────────────
interface TimeOffResponse {
  employee: {
    id: string;
    name: string;
    email: string;
    office: string | null;
    category: string;
  };
  year: number;
  vacations: {
    start_date: string;
    end_date: string;
    days_requested: number;
    status: "approved" | "pending";
    type: "vacation" | "bootcamp" | "medical_leave" | "other";
  }[];
  public_holidays: { date: string; name: string; scope: string }[];
  non_working_days: string[]; // "YYYY-MM-DD", weekends excluded
}

async function getTimeOff(email: string, year?: number): Promise<TimeOffResponse> {
  const qs = year ? `?year=${year}` : "";
  const res = await fetch(`${API}/api/employees/${encodeURIComponent(email)}/time-off${qs}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Usage examples ───────────────────────────────────────
const eng = await getEngagement("ENG-2026-001");
console.log(`${eng.engagement.name} — ${eng.employees.length} employees`);

const notif = await sendNotification({
  title: "Aviso importante",
  message: "Reunión a las 10:00",
  employees: ["emp-uuid-1", "emp-uuid-2"],  // get IDs from engagements endpoint
});
console.log(`Notified ${notif.recipients_notified} employees`);

const timeOff = await getTimeOff("ana@acme.com", 2026);
console.log(`${timeOff.employee.name}: ${timeOff.non_working_days.length} non-working days`);
```

### Python

```python
import requests

API = "http://localhost:4000"

def get_engagement(code: str) -> dict:
    res = requests.get(f"{API}/api/engagements/{code}")
    res.raise_for_status()
    return res.json()

def send_notification(title: str, message: str, employees: list[str], from_id: str = None) -> dict:
    """employees: list of employee IDs from holidays_manager"""
    params = {
        "title": title,
        "message": message,
        "employees": ",".join(employees),
    }
    if from_id:
        params["from"] = from_id
    res = requests.get(f"{API}/api/notifications/send", params=params)
    res.raise_for_status()
    return res.json()

# Usage
eng = get_engagement("ENG-2026-001")
for emp in eng["employees"]:
    hours = sum(i["weekly_hours"] for i in emp["imputaciones"])
    print(f"{emp['name']} ({emp['category']}): {hours} h/week")

notif = send_notification(
    title="Aviso importante",
    message="Reunión a las 10:00",
    employees=["emp-uuid-1", "emp-uuid-2"],
)
print(f"Notified {notif['recipients_notified']} employees")

def get_time_off(email: str, year: int = None) -> dict:
    res = requests.get(f"{API}/api/employees/{email}/time-off", params={"year": year} if year else None)
    res.raise_for_status()
    return res.json()

time_off = get_time_off("ana@acme.com", 2026)
print(f"{time_off['employee']['name']}: {len(time_off['non_working_days'])} non-working days")
```

### cURL

```bash
# Get engagement
curl http://localhost:4000/api/engagements/ENG-2026-001 | jq

# Send notification
curl "http://localhost:4000/api/notifications/send?title=Alerta&message=Urgente&employees=emp-uuid-1" | jq

# Get employee time-off by email
curl "http://localhost:4000/api/employees/ana%40acme.com/time-off?year=2026" | jq

# Push weekly imputaciones (consola)
curl -X PUT http://localhost:4000/api/imputaciones \
  -H "x-api-key: $IMPUTACIONES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @imputaciones-semanal.json | jq
```

---

## General Notes

- GET endpoints are **unsecured** (no auth token required). `PUT /api/imputaciones` requires the `IMPUTACIONES_API_TOKEN` header.
- `/api/*` paths bypass the login redirect in the middleware so they work without a session.
- Engagements: employees sorted by category — Senior-Manager → Manager → Senior → Staff → Externo → Socio → Intern.
- Notifications: the notification appears in the recipient's bell icon inside the app.
- Time-off: holidays are resolved against the employee's office; `non_working_days` excludes weekends and only counts approved time-off.
- For the consuming project: copy the TypeScript interfaces (`EngagementResponse`, `NotificationResponse`, `TimeOffResponse`) directly into your codebase.
