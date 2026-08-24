import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackNav } from "@/components/back-nav";
import { strings } from "@/lib/strings";
import { NotificationsManager } from "@/components/admin/notifications-manager";
import { getNotifications } from "./actions";

export default async function AdminNotificationsPage() {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/auth/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", authData.claims.sub)
    .single();

  if (
    currentEmployee?.role !== "admin" &&
    currentEmployee?.role !== "super-admin"
  )
    redirect("/main");

  // Fetch notifications
  const { data: notifications, error: notifError } = await getNotifications();

  // Fetch projects for the target selector
  const { data: projects } = await supabase
    .from("projects")
    .select("id_engagement, name")
    .order("name");

  // Fetch employees for the target selector
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <BackNav />
      <div>
        <h1 className="text-2xl font-bold">
          {strings.notifications.adminPageTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {strings.notifications.adminPageSubtitle}
        </p>
      </div>
      {notifError && (
        <p className="text-sm text-red-500">{notifError}</p>
      )}
      <NotificationsManager
        notifications={notifications ?? []}
        projects={projects ?? []}
        employees={employees ?? []}
      />
    </div>
  );
}
