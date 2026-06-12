"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import { saveCopilotProfile } from "@/app/main/copilot/actions";

type Props = {
  initialHasCopilot: boolean;
  initialEngagement: string;
  initialClients: string[];
  clientOptions: string[];
};

export function CopilotLicenseForm({
  initialHasCopilot,
  initialEngagement,
  initialClients,
  clientOptions,
}: Props) {
  const [hasCopilot, setHasCopilot] = useState(initialHasCopilot);
  const [engagement, setEngagement] = useState(initialEngagement);
  const [selectedClients, setSelectedClients] = useState<string[]>(initialClients);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleClient = (client: string) => {
    setSelectedClients((prev) =>
      prev.includes(client) ? prev.filter((c) => c !== client) : [...prev, client]
    );
  };

  const submit = () => {
    setError(null);
    setSuccess(null);

    if (hasCopilot && !engagement.trim()) {
      setError(strings.copilot.formEngagementRequired);
      return;
    }

    if (hasCopilot && selectedClients.length === 0) {
      setError(strings.copilot.formClientsRequired);
      return;
    }

    startTransition(async () => {
      const result = await saveCopilotProfile({
        hasCopilot,
        engagement,
        clients: selectedClients,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSuccess(strings.copilot.saved);
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="grid gap-3 rounded-md border p-4">
        <Label>{strings.copilot.formLicenseLabel}</Label>
        <div className="flex gap-2">
          {["no", "yes"].map((value) => {
            const isYes = value === "yes";
            const isActive = hasCopilot === isYes;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setHasCopilot(isYes);
                  setError(null);
                  setSuccess(null);
                  if (!isYes) {
                    setEngagement("");
                    setSelectedClients([]);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-full text-sm border transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input hover:bg-accent"
                )}
                disabled={isPending}
              >
                {isYes ? strings.copilot.optionYes : strings.copilot.optionNo}
              </button>
            );
          })}
        </div>

        {hasCopilot && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="copilot-engagement">{strings.copilot.formEngagementLabel}</Label>
              <Input
                id="copilot-engagement"
                value={engagement}
                onChange={(e) => setEngagement(e.target.value)}
                placeholder={strings.copilot.formEngagementPlaceholder}
                disabled={isPending}
              />
            </div>

            <div className="grid gap-3">
              <Label>{strings.copilot.formClientsLabel}</Label>
              {clientOptions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {clientOptions.map((client) => (
                    <button
                      key={client}
                      type="button"
                      onClick={() => toggleClient(client)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm border transition-colors",
                        selectedClients.includes(client)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-accent"
                      )}
                      disabled={isPending}
                    >
                      {client}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{strings.copilot.noClientsAvailable}</p>
              )}
              <p className="text-xs text-muted-foreground">{strings.copilot.formClientsHint}</p>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}

      <div>
        <Button type="button" disabled={isPending} onClick={submit}>
          {isPending ? strings.common.saving : strings.common.save}
        </Button>
      </div>
    </div>
  );
}
