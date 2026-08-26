# API Web Service — Holidays Manager

Base URL: `http://localhost:4000`

No authentication required for any endpoint.

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

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

> ℹ️ Both endpoints use the **publishable (anon) key** and rely on public RLS policies from migration `20260826000003_api_public_read_policies.sql`.

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

// ── Usage examples ───────────────────────────────────────
const eng = await getEngagement("ENG-2026-001");
console.log(`${eng.engagement.name} — ${eng.employees.length} employees`);

const notif = await sendNotification({
  title: "Aviso importante",
  message: "Reunión a las 10:00",
  employees: ["emp-uuid-1", "emp-uuid-2"],  // get IDs from engagements endpoint
});
console.log(`Notified ${notif.recipients_notified} employees`);
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
```

### cURL

```bash
# Get engagement
curl http://localhost:4000/api/engagements/ENG-2026-001 | jq

# Send notification
curl "http://localhost:4000/api/notifications/send?title=Alerta&message=Urgente&employees=emp-uuid-1" | jq
```

---

## General Notes

- Both endpoints are **unsecured** (no auth token required).
- Engagements: employees sorted by category — Senior-Manager → Manager → Senior → Staff → Externo → Socio → Intern.
- Notifications: the notification appears in the recipient's bell icon inside the app.
- For the consuming project: copy the TypeScript interfaces (`EngagementResponse`, `NotificationResponse`) directly into your codebase.
