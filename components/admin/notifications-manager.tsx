"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CopyIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  SearchIcon,
} from "lucide-react";
import {
  createNotification,
  updateNotification,
  deleteNotification,
  copyNotification,
  toggleNotificationActive,
  type NotificationRow,
} from "@/app/main/admin/notifications/actions";

type Project = { id_engagement: string; name: string };
type Employee = { id: string; name: string };

type NotificationsManagerProps = {
  notifications: NotificationRow[];
  projects: Project[];
  employees: Employee[];
};

export function NotificationsManager({
  notifications: initial,
  projects,
  employees,
}: NotificationsManagerProps) {
  const [notifications, setNotifications] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formTargetType, setFormTargetType] = useState<
    "all" | "project" | "employee"
  >("all");
  const [formTargetId, setFormTargetId] = useState("");
  const [formRecurrence, setFormRecurrence] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");

  // Search/filter
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNotifications = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.creator_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function resetForm() {
    setEditingId(null);
    setFormTitle("");
    setFormMessage("");
    setFormTargetType("all");
    setFormTargetId("");
    setFormRecurrence("none");
    setShowForm(false);
    setError(null);
  }

  function handleEdit(n: NotificationRow) {
    setEditingId(n.id);
    setFormTitle(n.title);
    setFormMessage(n.message);
    setFormTargetType(n.target_type);
    setFormTargetId(n.target_id ?? "");
    setFormRecurrence(n.recurrence);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function handleSubmit() {
    if (!formTitle.trim() || !formMessage.trim()) {
      setError("Título y mensaje son obligatorios.");
      return;
    }
    if (formTargetType !== "all" && !formTargetId) {
      setError("Selecciona un destinatario.");
      return;
    }

    setError(null);
    setSuccess(null);

    const input = {
      title: formTitle.trim(),
      message: formMessage.trim(),
      targetType: formTargetType,
      targetId: formTargetId || null,
      recurrence: formRecurrence,
    };

    startTransition(async () => {
      let result;
      if (editingId) {
        result = await updateNotification(editingId, input);
      } else {
        result = await createNotification(input);
      }

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          editingId
            ? strings.notifications.successUpdated
            : strings.notifications.successCreated
        );
        resetForm();
        // Re-fetch
        const { getNotifications } = await import(
          "@/app/main/admin/notifications/actions"
        );
        const refreshed = await getNotifications();
        if (refreshed.data) setNotifications(refreshed.data);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(strings.notifications.confirmDelete)) return;
    startTransition(async () => {
      const result = await deleteNotification(id);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(strings.notifications.successDeleted);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    });
  }

  function handleCopy(id: string) {
    if (!confirm(strings.notifications.confirmCopy)) return;
    startTransition(async () => {
      const result = await copyNotification(id);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(strings.notifications.successCopied);
        const { getNotifications } = await import(
          "@/app/main/admin/notifications/actions"
        );
        const refreshed = await getNotifications();
        if (refreshed.data) setNotifications(refreshed.data);
      }
    });
  }

  function handleToggleActive(id: string, currentActive: boolean) {
    startTransition(async () => {
      const result = await toggleNotificationActive(id, !currentActive);
      if (result.error) {
        setError(result.error);
      } else {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, is_active: !currentActive } : n
          )
        );
      }
    });
  }

  function getTargetLabel(n: NotificationRow) {
    switch (n.target_type) {
      case "all":
        return strings.notifications.targetAll;
      case "project":
        return strings.notifications.targetProject(n.target_name ?? n.target_id ?? "");
      case "employee":
        return strings.notifications.targetEmployee(n.target_name ?? n.target_id ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          size="sm"
        >
          <PlusIcon className="size-4 mr-1" />
          {strings.notifications.newButton}
        </Button>
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={strings.admin.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Messages */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border bg-card p-6 flex flex-col gap-4">
          <h3 className="font-semibold text-lg">
            {editingId
              ? strings.notifications.editTitle
              : strings.notifications.newTitle}
          </h3>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label>{strings.notifications.titleLabel}</Label>
            <Input
              placeholder={strings.notifications.titlePlaceholder}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="flex flex-col gap-1.5">
            <Label>{strings.notifications.messageLabel}</Label>
            <textarea
              placeholder={strings.notifications.messagePlaceholder}
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Target type */}
          <div className="flex flex-col gap-1.5">
            <Label>{strings.notifications.targetTypeLabel}</Label>
            <div className="flex gap-2">
              {(["all", "project", "employee"] as const).map((type) => (
                <Button
                  key={type}
                  variant={formTargetType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFormTargetType(type);
                    setFormTargetId("");
                  }}
                >
                  {type === "all"
                    ? strings.notifications.targetTypeAll
                    : type === "project"
                    ? strings.notifications.targetTypeProject
                    : strings.notifications.targetTypeEmployee}
                </Button>
              ))}
            </div>
          </div>

          {/* Target selector */}
          {formTargetType === "project" && (
            <div className="flex flex-col gap-1.5">
              <Label>{strings.notifications.targetProjectLabel}</Label>
              <select
                value={formTargetId}
                onChange={(e) => setFormTargetId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">
                  {strings.notifications.targetProjectPlaceholder}
                </option>
                {projects.map((p) => (
                  <option key={p.id_engagement} value={p.id_engagement}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formTargetType === "employee" && (
            <div className="flex flex-col gap-1.5">
              <Label>{strings.notifications.targetEmployeeLabel}</Label>
              <select
                value={formTargetId}
                onChange={(e) => setFormTargetId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">
                  {strings.notifications.targetEmployeePlaceholder}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recurrence */}
          <div className="flex flex-col gap-1.5">
            <Label>{strings.notifications.recurrenceLabel}</Label>
            <div className="flex gap-2">
              {(
                ["none", "daily", "weekly", "monthly"] as const
              ).map((r) => (
                <Button
                  key={r}
                  variant={formRecurrence === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormRecurrence(r)}
                >
                  {r === "none"
                    ? strings.notifications.recurrenceNone
                    : r === "daily"
                    ? strings.notifications.recurrenceDaily
                    : r === "weekly"
                    ? strings.notifications.recurrenceWeekly
                    : strings.notifications.recurrenceMonthly}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              size="sm"
            >
              {isPending
                ? editingId
                  ? strings.notifications.submitUpdating
                  : strings.notifications.submitCreating
                : editingId
                ? strings.notifications.submitUpdate
                : strings.notifications.submitCreate}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              {strings.common.cancel}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {strings.notifications.empty}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colTitle}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colMessage}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colTarget}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colRecurrence}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colStatus}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colCreatedBy}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colCreatedAt}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {strings.notifications.colActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredNotifications.map((n) => (
                <tr key={n.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                    {n.title}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[250px] truncate">
                    {n.message}
                  </td>
                  <td className="px-4 py-3 text-xs">{getTargetLabel(n)}</td>
                  <td className="px-4 py-3 text-xs">
                    {strings.notifications.badgeRecurrence(n.recurrence)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        n.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {n.is_active
                        ? strings.notifications.badgeActive
                        : strings.notifications.badgeInactive}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {n.creator_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title={
                          n.is_active
                            ? strings.notifications.deactivateButton
                            : strings.notifications.activateButton
                        }
                        onClick={() => handleToggleActive(n.id, n.is_active)}
                        disabled={isPending}
                      >
                        {n.is_active ? (
                          <ToggleRightIcon className="size-4 text-green-600" />
                        ) : (
                          <ToggleLeftIcon className="size-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title={strings.notifications.editButton}
                        onClick={() => handleEdit(n)}
                        disabled={isPending}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title={strings.notifications.copyButton}
                        onClick={() => handleCopy(n.id)}
                        disabled={isPending}
                      >
                        <CopyIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500 hover:text-red-700"
                        title={strings.notifications.deleteButton}
                        onClick={() => handleDelete(n.id)}
                        disabled={isPending}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
