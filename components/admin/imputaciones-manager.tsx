"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/lib/strings";
import { sortEmployeesByCategory } from "@/lib/categories";
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  SettingsIcon,
  ArrowRightIcon,
} from "lucide-react";
import {
  getEngagements,
  createEngagement,
  updateEngagement,
  deleteEngagement,
  getEmployeesByClient,
  getAssignedEmployeeIds,
  type EngagementRow,
} from "@/app/main/admin/imputaciones/actions";

type Client = { id_engagement: string; name: string };
type Employee = { id: string; name: string; category: string };

type ImputacionesManagerProps = {
  clients: Client[];
};

export function ImputacionesManager({ clients }: ImputacionesManagerProps) {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientEmployees, setClientEmployees] = useState<Employee[]>([]);
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selected engagement for assignment
  const [selectedEngId, setSelectedEngId] = useState<string | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

  // Engagement management form state
  const [showEngForm, setShowEngForm] = useState(false);
  const [editingEngId, setEditingEngId] = useState<string | null>(null);
  const [engCode, setEngCode] = useState("");
  const [engName, setEngName] = useState("");
  const [engStartDate, setEngStartDate] = useState("");
  const [engEndDate, setEngEndDate] = useState("");
  const [engTotalAmount, setEngTotalAmount] = useState<number>(0);
  const [engEstimatedExpenses, setEngEstimatedExpenses] = useState<number>(0);

  // Fetch data when client changes
  useEffect(() => {
    if (!selectedClientId) {
      setClientEmployees([]);
      setEngagements([]);
      setSelectedEngId(null);
      setSelectedEmpIds(new Set());
      return;
    }

    setLoading(true);
    setSelectedEngId(null);
    setSelectedEmpIds(new Set());
    Promise.all([
      getEmployeesByClient(selectedClientId),
      getEngagements(selectedClientId),
    ]).then(([empResult, engResult]) => {
      if (empResult.data) setClientEmployees(empResult.data);
      if (engResult.data) setEngagements(engResult.data);
      setLoading(false);
    });
  }, [selectedClientId]);

  // Fetch assigned employees when an engagement is selected
  useEffect(() => {
    if (!selectedEngId) {
      setSelectedEmpIds(new Set());
      return;
    }
    getAssignedEmployeeIds(selectedEngId).then((result) => {
      if (result.data) {
        setSelectedEmpIds(new Set(result.data));
      }
    });
  }, [selectedEngId]);

  // ── Engagement CRUD ────────────────────────────────────────

  function resetEngForm() {
    setEditingEngId(null);
    setEngCode("");
    setEngName("");
    setEngStartDate("");
    setEngEndDate("");
    setEngTotalAmount(0);
    setEngEstimatedExpenses(0);
    setShowEngForm(false);
    setError(null);
  }

  function handleEditEng(e: EngagementRow) {
    setEditingEngId(e.id);
    setEngCode(e.engagement_code);
    setEngName(e.name);
    setEngStartDate(e.start_date ?? "");
    setEngEndDate(e.end_date ?? "");
    setEngTotalAmount(e.total_amount ?? 0);
    setEngEstimatedExpenses(e.estimated_expenses ?? 0);
    setShowEngForm(true);
    setError(null);
    setSuccess(null);
  }

  function handleSubmitEng() {
    if (!engCode.trim() || !engName.trim()) {
      setError("El código y el nombre son obligatorios.");
      return;
    }

    setError(null);
    setSuccess(null);

    const input = {
      clientId: selectedClientId,
      engagementCode: engCode.trim(),
      name: engName.trim(),
      startDate: engStartDate || null,
      endDate: engEndDate || null,
      totalAmount: engTotalAmount,
      estimatedExpenses: engEstimatedExpenses,
    };

    startTransition(async () => {
      let result;
      if (editingEngId) {
        result = await updateEngagement(editingEngId, input);
      } else {
        result = await createEngagement(input);
      }

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(strings.imputaciones.engagementSaved);
        resetEngForm();
        const refreshed = await getEngagements(selectedClientId);
        if (refreshed.data) setEngagements(refreshed.data);
      }
    });
  }

  function handleDeleteEng(id: string) {
    if (!confirm(strings.imputaciones.engagementDeleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteEngagement(id);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(strings.imputaciones.engagementDeleted);
        setEngagements((prev) => prev.filter((e) => e.id !== id));
        if (selectedEngId === id) setSelectedEngId(null);
      }
    });
  }

  function toggleEmployee(empId: string) {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  function goToEngagementDetail() {
    if (selectedEngId) {
      const empParam = Array.from(selectedEmpIds).join(",");
      router.push(
        `/main/admin/imputaciones/${selectedEngId}${empParam ? `?employees=${empParam}` : ""}`
      );
    }
  }

  // ── Derived state ──────────────────────────────────────────

  const selectedEng = engagements.find((e) => e.id === selectedEngId);

  return (
    <div className="flex flex-col gap-4">
      {/* Client selector */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
          <Label>{strings.imputaciones.clientFilterLabel}</Label>
          <select
            value={selectedClientId}
            onChange={(e) => {
              setSelectedClientId(e.target.value);
              resetEngForm();
              setSelectedEngId(null);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">
              {strings.imputaciones.clientSelectPlaceholder}
            </option>
            {clients.map((c) => (
              <option key={c.id_engagement} value={c.id_engagement}>
                {c.name}
              </option>
            ))}
          </select>
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

      {!selectedClientId ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {strings.imputaciones.clientSelectPlaceholder}
        </div>
      ) : loading ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {strings.common.loading}
        </div>
      ) : (
        <>
          {/* ── Step 1: Select Engagement ───────────────────── */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <SettingsIcon className="size-4" />
                {strings.imputaciones.selectEngagementTitle}
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetEngForm();
                  setShowEngForm(true);
                }}
              >
                <PlusIcon className="size-3.5 mr-1" />
                {strings.imputaciones.newEngagementButton}
              </Button>
            </div>

            {/* Engagement form */}
            {showEngForm && (
              <div className="mt-3 rounded-md border bg-muted/30 p-4 flex flex-col gap-3">
                <h3 className="font-medium text-sm">
                  {editingEngId
                    ? strings.imputaciones.editEngagementTitle
                    : strings.imputaciones.newEngagementTitle}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>{strings.imputaciones.engagementCodeLabel}</Label>
                    <Input
                      placeholder={strings.imputaciones.engagementCodePlaceholder}
                      value={engCode}
                      onChange={(e) => setEngCode(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{strings.imputaciones.engagementNameLabel}</Label>
                    <Input
                      placeholder={strings.imputaciones.engagementNamePlaceholder}
                      value={engName}
                      onChange={(e) => setEngName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{strings.imputaciones.engagementStartDate}</Label>
                    <Input
                      type="date"
                      value={engStartDate}
                      onChange={(e) => setEngStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{strings.imputaciones.engagementEndDate}</Label>
                    <Input
                      type="date"
                      value={engEndDate}
                      onChange={(e) => setEngEndDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{strings.imputaciones.engagementTotalAmount}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={engTotalAmount || ""}
                      onChange={(e) =>
                        setEngTotalAmount(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{strings.imputaciones.engagementEstimatedExpenses}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={engEstimatedExpenses || ""}
                      onChange={(e) =>
                        setEngEstimatedExpenses(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSubmitEng}
                    disabled={isPending}
                  >
                    {isPending
                      ? strings.imputaciones.engagementSavingButton
                      : strings.imputaciones.engagementSaveButton}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetEngForm}>
                    {strings.common.cancel}
                  </Button>
                </div>
              </div>
            )}

            {/* Engagement list — click to select */}
            {engagements.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {strings.imputaciones.engagementEmpty}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {engagements.map((eng) => {
                  const isSelected = selectedEngId === eng.id;
                  return (
                    <div
                      key={eng.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "bg-background hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedEngId(isSelected ? null : eng.id);
                        setSelectedEmpIds(new Set());
                      }}
                    >
                      <span className="font-medium">
                        {eng.engagement_code}
                      </span>
                      <span className="text-muted-foreground">–</span>
                      <span className="flex-1">{eng.name}</span>
                      {(eng.total_amount ?? 0) > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {new Intl.NumberFormat("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          }).format(eng.total_amount)}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEng(eng);
                          }}
                          disabled={isPending}
                        >
                          <PencilIcon className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 text-red-500 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEng(eng.id);
                          }}
                          disabled={isPending}
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Step 2: Assign Employees to Selected Engagement ── */}
          {selectedEng && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {strings.imputaciones.assignEmployeesTitle}{" "}
                  <span className="text-primary">
                    {selectedEng.engagement_code} – {selectedEng.name}
                  </span>
                </h2>
                <Button
                  size="sm"
                  onClick={goToEngagementDetail}
                  disabled={isPending || selectedEmpIds.size === 0}
                >
                  {strings.imputaciones.finalizeButton}
                  {selectedEmpIds.size > 0 && (
                    <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5">
                      {selectedEmpIds.size}
                    </span>
                  )}
                  <ArrowRightIcon className="size-3.5 ml-1" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                {strings.imputaciones.assignEmployeesHint}
              </p>

              {clientEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {strings.imputaciones.employeesEmpty}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sortEmployeesByCategory(clientEmployees).map((emp) => (
                    <div
                      key={emp.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        selectedEmpIds.has(emp.id)
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "bg-background hover:bg-muted/50"
                      }`}
                      onClick={() => toggleEmployee(emp.id)}
                    >
                      <span className="flex-1 font-medium">{emp.name}</span>
                      <Button
                        size="icon"
                        variant={selectedEmpIds.has(emp.id) ? "default" : "outline"}
                        className="size-7 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEmployee(emp.id);
                        }}
                        title={strings.imputaciones.addEmployeeToEngagement}
                      >
                        {selectedEmpIds.has(emp.id) ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          <PlusIcon className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
