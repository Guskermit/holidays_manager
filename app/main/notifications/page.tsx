import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { getMyNotifications } from "./actions";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", authData.claims.sub)
    .single();

  if (!employee) redirect("/auth/login");

  const { data: notifications } = await getMyNotifications();

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">
          {strings.notifications.bellLabel}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {notifications && notifications.length > 0
            ? strings.notifications.unreadCount(
                notifications.filter((n) => !n.is_read).length
              )
            : strings.notifications.bellEmpty}
        </p>
      </div>

      {!notifications || notifications.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {strings.notifications.bellEmpty}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${
                !n.is_read
                  ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                  : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {!n.is_read && (
                      <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <h3 className="font-medium">{n.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{n.created_by_name}</span>
                    {n.target_type !== "all" && n.target_name && (
                      <>
                        <span>·</span>
                        <span>{n.target_name}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(n.created_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
