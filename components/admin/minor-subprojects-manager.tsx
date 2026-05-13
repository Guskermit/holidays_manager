"use client";

import { useState, useTransition } from "react";
import { PlusIcon, PencilIcon, TrashIcon, CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  createSubproject,
  updateSubproject,
  deleteSubproject,
} from "@/app/main/admin/minor/actions";
import { strings } from "@/lib/strings";

// ── Color palette (same as project form) ─────────────────────────────────────

const COLOR_PALETTE = [
  { label: "Indigo",  value: "#6366f1" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Cyan",    value: "#06b6d4" },
  { label: "Emerald", value: "#10b981" },
  { label: "Lime",    value: "#84cc16" },
  { label: "Amber",   value: "#f59e0b" },
  { label: "Orange",  value: "#f97316" },
  { label: "Red",     value: "#ef4444" },
  { label: "Pink",    value: "#ec4899" },
  { label: "Purple",  value: "#a855f7" },
  { label: "Slate",   value: "#64748b" },
  { label: "Stone",   value: "#78716c" },
];

type Subproject = {
  id: string;
  name: string;
  active: boolean;
  color: string;
};

type Props = {
  subprojects: Subproject[];
};

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PALETTE.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={cn(
            "size-6 rounded-full border-2 transition-transform focus:outline-none",
            value === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
          )}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}

export function MinorSubprojectsManager({ subprojects: initial }: Props) {
  const [subprojects, setSubprojects] = useState<Subproject[]>(initial);
  const [newName, setNewName]         = useState("");
  const [newColor, setNewColor]       = useState(COLOR_PALETTE[0].value);
  const [editId, setEditId]           = useState<string | null>(null);
  const [editName, setEditName]       = useState("");
  const [editActive, setEditActive]   = useState(true);
  const [editColor, setEditColor]     = useState(COLOR_PALETTE[0].value);
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", newColor);

    startTransition(async () => {
      const result = await createSubproject(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setNewName("");
        setSubprojects(prev => [
          ...prev,
          { id: crypto.randomUUID(), name, active: true, color: newColor },
        ]);
      }
    });
  };

  // ── Edit ───────────────────────────────────────────────────────────────────

  const startEdit = (sp: Subproject) => {
    setEditId(sp.id);
    setEditName(sp.name);
    setEditActive(sp.active);
    setEditColor(sp.color || COLOR_PALETTE[0].value);
    setError(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setError(null);
  };

  const handleUpdate = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("active", editActive ? "true" : "false");
    formData.set("color", editColor);

    startTransition(async () => {
      const result = await updateSubproject(id, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditId(null);
        setSubprojects(prev =>
          prev.map(sp => sp.id === id ? { ...sp, name, active: editActive, color: editColor } : sp)
        );
      }
    });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    if (!confirm(strings.minor.subprojectDeleteConfirm)) return;
    setError(null);

    startTransition(async () => {
      const result = await deleteSubproject(id);
      if (result?.error) {
        setError(result.error);
      } else {
        setSubprojects(prev => prev.filter(sp => sp.id !== id));
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Add new subproject */}
      <div className="flex flex-col gap-3 max-w-md p-4 rounded-lg border bg-muted/20">
        <p className="text-sm font-medium">Nuevo subproyecto</p>
        <div className="flex gap-2">
          <Input
            placeholder={strings.minor.addSubprojectPlaceholder}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
            disabled={isPending}
          />
          <Button onClick={handleCreate} disabled={isPending || !newName.trim()}>
            <PlusIcon className="size-4 mr-1.5" />
            {strings.minor.addSubprojectButton}
          </Button>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
      </div>

      {/* Subprojects list */}
      {subprojects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.minor.subprojectEmpty}</p>
      ) : (
        <div className="rounded-md border overflow-hidden max-w-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium px-4 py-3">{strings.minor.subprojectColName}</th>
                <th className="text-left font-medium px-4 py-3">{strings.minor.subprojectColStatus}</th>
                <th className="text-right font-medium px-4 py-3">{strings.minor.subprojectColActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subprojects.map(sp => (
                <tr key={sp.id} className="hover:bg-muted/30">
                  {editId === sp.id ? (
                    <>
                      <td className="px-4 py-3 space-y-2">
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleUpdate(sp.id); if (e.key === "Escape") cancelEdit(); }}
                          className="h-8 text-sm"
                          autoFocus
                          disabled={isPending}
                        />
                        <ColorPicker value={editColor} onChange={setEditColor} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditActive(a => !a)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs border transition-colors",
                            editActive
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                              : "bg-muted text-muted-foreground border-input"
                          )}
                        >
                          {editActive ? strings.minor.subprojectActive : strings.minor.subprojectInactive}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" onClick={() => handleUpdate(sp.id)} disabled={isPending}>
                            <CheckIcon className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} disabled={isPending}>
                            <XIcon className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-3 rounded-full shrink-0"
                            style={{ backgroundColor: sp.color || "#6366f1" }}
                          />
                          {sp.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sp.active ? "default" : "secondary"}>
                          {sp.active ? strings.minor.subprojectActive : strings.minor.subprojectInactive}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(sp)}
                            disabled={isPending}
                          >
                            <PencilIcon className="size-3.5 mr-1" />
                            {strings.common.edit}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(sp.id)}
                            disabled={isPending}
                          >
                            <TrashIcon className="size-3.5 mr-1" />
                            {strings.minor.subprojectDeleteButton}
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
