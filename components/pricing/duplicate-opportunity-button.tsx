"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "lucide-react";
import { strings } from "@/lib/strings";
import { duplicateOpportunity } from "@/app/main/pricing/actions";

export function DuplicateOpportunityButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateOpportunity(id);
      if ("id" in result) {
        router.push(`/main/pricing/${result.id}`);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={handleDuplicate}
      className="text-muted-foreground hover:text-foreground"
    >
      <CopyIcon className="size-3.5 mr-1" />
      {isPending ? "..." : strings.pricing.duplicateButton}
    </Button>
  );
}
