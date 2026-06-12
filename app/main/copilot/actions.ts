"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function saveCopilotProfile(input: {
  hasCopilot: boolean;
  engagement: string;
  clients: string[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) {
    redirect("/auth/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) {
    return { error: "Employee profile not found" };
  }

  const sanitizedClients = Array.from(
    new Set(input.clients.map((c) => c.trim()).filter(Boolean))
  );

  const engagement = input.engagement.trim();

  if (input.hasCopilot && !engagement) {
    return { error: "Debes indicar el engagement donde se solicitó la licencia." };
  }

  if (input.hasCopilot && sanitizedClients.length === 0) {
    return { error: "Selecciona al menos un cliente para usar Copilot." };
  }

  const { error } = await supabase
    .from("employees")
    .update({
      has_copilot: input.hasCopilot,
      copilot_engagement: input.hasCopilot ? engagement : null,
      copilot_clients: input.hasCopilot ? sanitizedClients : null,
    })
    .eq("id", employee.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/main/copilot");
  revalidatePath("/main");
  return {};
}
