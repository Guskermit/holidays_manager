"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, HomeIcon } from "lucide-react";
import { strings } from "@/lib/strings";

export function BackNav() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ChevronLeftIcon className="size-4 mr-1" />
        {strings.common.back}
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/main">
          <HomeIcon className="size-4 mr-1" />
          {strings.common.home}
        </Link>
      </Button>
    </div>
  );
}
