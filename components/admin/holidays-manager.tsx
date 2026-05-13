"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OFFICE_LABELS, type Office } from "@/lib/holidays";
import {
  createHoliday,
  updateHoliday,
  deleteHoliday,
  importHolidaysFromApi,
} from "@/app/main/admin/holidays/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Scope = "national" | Office;

type Holiday = {
  id: string;
  date: string;
  name: string;
  scope: string;
};

type Props = {
  holidays: Holiday[];
  currentYear: number;
};

// ── Scope options ─────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "national", label: "Nacional" },
  ...Object.entries(OFFICE_LABELS).map(([k, v]) => ({
    value: k as Office,
    label: v,
  })),
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function scopeLabel(scope: string): string {
  if (scope === "national") return "Nacional";
  return OFFICE_LABELS[scope as Office] ?? scope;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HolidaysManager({ holidays: initialHolidays, currentYear }: Props) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [activeTab, setActiveTab] = useState<Scope>("national");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");
  const [, startTransition] = useTransition();

  const filtered = holidays
    .filter((h) => h.scope === activeTab)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleCreate = () => {
    if (!newDate || !newName.trim()) { setError("Fecha y nombre son obligatorios"); return; }
    const fd = new FormData();
    fd.set("date", newDate);
    fd.set("name", newName.trim());
    fd.set("scope", activeTab);

    startTransition(async () => {
      const res = await createHoliday(fd);
      if (res?.error) { setError(res.error); return; }
      // Optimistic update
      setHolidays((prev) => [
        ...prev,
        { id: crypto.randomUUID(), date: newDate, name: newName.trim(), scope: activeTab },
      ]);
      setNewDate("");
      setNewName("");
      setError(null);
    });
  };

  const startEdit = (h: Holiday) => {
    setEditingId(h.id);
    setEditDate(h.date);
    setEditName(h.name);
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("date", editDate);
    fd.set("name", editName);

    startTransition(async () => {
      const res = await updateHoliday(fd);
      if (res?.error) { setError(res.error); return; }
      setHolidays((prev) =>
        prev.map((h) => (h.id === id ? { ...h, date: editDate, name: editName } : h))
      );
      setEditingId(null);
      setError(null);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteHoliday(id);
      if (res?.error) { setError(res.error); return; }
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      setError(null);
    });
  };

  // ── Import from API ────────────────────────────────────────────────────────

  const handleImport = () => {
    setImportStatus("loading");
    setImportMsg("");
    startTransition(async () => {
      const res = await importHolidaysFromApi(currentYear, activeTab);
      if (res.error) {
        setImportStatus("error");
        setImportMsg(res.error);
      } else {
        setImportStatus("done");
        setImportMsg(`${res.imported} festivos importados/actualizados`);
        // Refresh list from server via revalidation — reload simpler than refetch
        setTimeout(() => window.location.reload(), 1200);
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {SCOPE_OPTIONS.map((opt) => {
          const count = holidays.filter((h) => h.scope === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => { setActiveTab(opt.value); setEditingId(null); setError(null); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {opt.label}
              <span className="ml-1.5 text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Import button */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          disabled={importStatus === "loading"}
          className={cn(
            importStatus === "done"  && "border-emerald-500 text-emerald-700",
            importStatus === "error" && "border-red-500 text-red-600",
          )}
        >
          <DownloadIcon className="size-3.5 mr-1.5" />
          {importStatus === "loading"
            ? "Importando…"
            : `Importar festivos nacionales ${currentYear} desde API`}
        </Button>
        {importMsg && (
          <span className={cn(
            "text-xs",
            importStatus === "done"  && "text-emerald-600",
            importStatus === "error" && "text-red-500",
          )}>
            {importMsg}
          </span>
        )}
        {activeTab !== "national" && (
          <span className="text-xs text-muted-foreground">
            La API solo proporciona festivos nacionales. Los locales se gestionan manualmente.
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left font-medium px-4 py-3 w-36">Fecha</th>
              <th className="text-left font-medium px-4 py-3">Nombre</th>
              <th className="text-left font-medium px-4 py-3 w-28">Centro</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((h) =>
              editingId === h.id ? (
                <tr key={h.id} className="bg-muted/20">
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(h.id); if (e.key === "Escape") cancelEdit(); }}
                    />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{scopeLabel(h.scope)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-emerald-600" onClick={() => handleSaveEdit(h.id)}>
                        <CheckIcon className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={cancelEdit}>
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={h.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums">{formatDate(h.date)}</td>
                  <td className="px-4 py-3">{h.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{scopeLabel(h.scope)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(h)}>
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-red-500 hover:text-red-600" onClick={() => handleDelete(h.id)}>
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            )}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay festivos para {scopeLabel(activeTab)}.
                </td>
              </tr>
            )}

            {/* New row */}
            <tr className="bg-muted/10 border-t-2">
              <td className="px-3 py-2">
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="YYYY-MM-DD"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Nombre del festivo"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
              </td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{scopeLabel(activeTab)}</td>
              <td className="px-3 py-2">
                <Button variant="ghost" size="icon" className="size-7 text-emerald-600 hover:text-emerald-700" onClick={handleCreate}>
                  <PlusIcon className="size-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Los festivos nacionales se aplican a todos los centros de trabajo. Los festivos de cada centro se suman a los nacionales al calcular días hábiles.
      </p>
    </div>
  );
}
