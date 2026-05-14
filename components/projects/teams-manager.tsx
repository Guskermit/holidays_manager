"use client";

import { useState, useTransition } from "react";
import { PlusIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createTeam,
  updateTeam,
  deleteTeam,
  assignEmployeeTeam,
} from "@/app/main/projects/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = {
  id: string;
  name: string;
};

type ProjectEmployee = {
  id: string;
  name: string;
  teamId: string | null;
};

type Props = {
  projectId: string;
  initialTeams: Team[];
  employees: ProjectEmployee[]; // employees already in this project
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamsManager({ projectId, initialTeams, employees: initialEmployees }: Props) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [employees, setEmployees] = useState<ProjectEmployee[]>(initialEmployees);

  // New team form
  const [newTeamName, setNewTeamName] = useState("");

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = () => {
    const trimmed = newTeamName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createTeam(projectId, trimmed);
      if (res.error) { setError(res.error); return; }
      if (res.team) {
        setTeams((prev) => [...prev, res.team!]);
        setNewTeamName("");
        setError(null);
      }
    });
  };

  // ── Rename ─────────────────────────────────────────────────────────────────

  const startEdit = (team: Team) => {
    setEditingId(team.id);
    setEditingName(team.name);
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await updateTeam(id, trimmed);
      if (res.error) { setError(res.error); return; }
      setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
      setEditingId(null);
      setError(null);
    });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteTeam(id);
      if (res.error) { setError(res.error); return; }
      setTeams((prev) => prev.filter((t) => t.id !== id));
      // Clear assignments that belonged to this team
      setEmployees((prev) =>
        prev.map((e) => (e.teamId === id ? { ...e, teamId: null } : e))
      );
      setError(null);
    });
  };

  // ── Assign employee to team ────────────────────────────────────────────────

  const handleAssign = (employeeId: string, teamId: string | null) => {
    startTransition(async () => {
      const res = await assignEmployeeTeam(employeeId, projectId, teamId);
      if (res.error) { setError(res.error); return; }
      setEmployees((prev) =>
        prev.map((e) => (e.id === employeeId ? { ...e, teamId } : e))
      );
      setError(null);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {/* Teams list */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Equipos ({teams.length})
        </h3>

        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No hay equipos aún. Crea el primero.</p>
        )}

        <div className="flex flex-col gap-1">
          {teams.map((team) =>
            editingId === team.id ? (
              <div key={team.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit(team.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
                <Button variant="ghost" size="icon" className="size-7 text-emerald-600" onClick={() => handleSaveEdit(team.id)}>
                  <CheckIcon className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={cancelEdit}>
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/30">
                <span className="flex-1 text-sm font-medium">{team.name}</span>
                <span className="text-xs text-muted-foreground mr-2">
                  {employees.filter((e) => e.teamId === team.id).length} miembro(s)
                </span>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => startEdit(team)}>
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-red-500 hover:text-red-600"
                  onClick={() => handleDelete(team.id)}
                  title="Eliminar equipo (los miembros quedan sin equipo)"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            )
          )}
        </div>

        {/* Add new team */}
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nombre del equipo…"
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <Button variant="outline" size="sm" onClick={handleCreate} disabled={!newTeamName.trim()}>
            <PlusIcon className="size-3.5 mr-1" />
            Añadir
          </Button>
        </div>
      </div>

      {/* Employee-team assignments */}
      {employees.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Asignación de miembros al equipo
          </h3>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left font-medium px-4 py-2.5">Empleado</th>
                  <th className="text-left font-medium px-4 py-2.5 w-56">Equipo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">{emp.name}</td>
                    <td className="px-3 py-2">
                      <select
                        value={emp.teamId ?? ""}
                        onChange={(e) => handleAssign(emp.id, e.target.value || null)}
                        className={cn(
                          "w-full h-8 rounded-md border border-input bg-background px-2 text-sm",
                          "focus:outline-none focus:ring-1 focus:ring-ring",
                          !emp.teamId && "text-muted-foreground"
                        )}
                        disabled={teams.length === 0}
                      >
                        <option value="">— Sin equipo —</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {employees.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Asigna empleados al proyecto para poder organizarlos en equipos.
        </p>
      )}
    </div>
  );
}
