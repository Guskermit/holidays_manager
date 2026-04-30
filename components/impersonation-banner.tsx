import { createClient } from "@/lib/supabase/server";
import { getImpersonatedEmployeeId } from "@/lib/impersonation";
import { stopImpersonation } from "@/app/main/impersonation/actions";
import { UserXIcon } from "lucide-react";

export async function ImpersonationBanner() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return null;

  const { data: realEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (realEmployee?.role !== "super-admin") return null;

  const impersonatedId = await getImpersonatedEmployeeId();
  if (!impersonatedId) return null;

  const { data: impersonated } = await supabase
    .from("employees")
    .select("name")
    .eq("id", impersonatedId)
    .single();

  if (!impersonated) return null;

  return (
    <div className="w-full bg-amber-500 text-white text-sm">
      <div className="max-w-[1440px] mx-auto px-8 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <UserXIcon className="size-4 shrink-0" />
          <span>
            Viewing as <strong>{impersonated.name}</strong>
          </span>
        </div>
        <form action={stopImpersonation}>
          <button
            type="submit"
            className="text-xs font-semibold underline underline-offset-2 hover:text-white/80 transition-colors"
          >
            Back to my account
          </button>
        </form>
      </div>
    </div>
  );
}
