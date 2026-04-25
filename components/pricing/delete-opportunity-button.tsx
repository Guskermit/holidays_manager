"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import { strings } from "@/lib/strings";
import { deleteOpportunity } from "@/app/main/pricing/actions";

export function DeleteOpportunityButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(strings.pricing.deleteConfirm)) return;
    startTransition(async () => {
      await deleteOpportunity(id);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={handleDelete}
      className="text-muted-foreground hover:text-red-500"
    >
      <Trash2Icon className="size-3.5 mr-1" />
      {strings.pricing.deleteButton}
    </Button>
  );
}
