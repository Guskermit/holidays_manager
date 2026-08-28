"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";

type Engagement = {
  engagement_name: string;
  engagement_code: string;
  weekly_hours: number;
};

export function WeekEngagementList({ engagements }: { engagements: Engagement[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (engagements.length === 0) return null;

  const totalHours = engagements.reduce((s, i) => s + i.weekly_hours, 0);

  return (
    <div className="flex flex-col gap-1.5">
      {engagements.map((imp) => (
        <div key={imp.engagement_code} className="flex items-center justify-between text-xs gap-2">
          <span className="truncate font-medium">
            <span className="text-muted-foreground mr-1.5">{imp.engagement_code}</span>
            {imp.engagement_name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {imp.weekly_hours > 0 && (
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold mr-1">
                {imp.weekly_hours}h
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center size-5 rounded hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
              title="Copiar código"
              onClick={() => handleCopy(imp.engagement_code)}
            >
              {copiedCode === imp.engagement_code ? (
                <CheckIcon className="size-3 text-green-600" />
              ) : (
                <CopyIcon className="size-3" />
              )}
            </button>
          </div>
        </div>
      ))}
      {totalHours > 0 && (
        <div className="flex items-center justify-between text-xs font-bold border-t pt-1.5 mt-1">
          <span>Total</span>
          <span className="text-indigo-600 dark:text-indigo-400">{totalHours}h</span>
        </div>
      )}
    </div>
  );
}
