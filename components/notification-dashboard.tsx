"use client";

import { useState, useEffect, useCallback } from "react";
import { BellIcon, CheckCheckIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { strings } from "@/lib/strings";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
} from "@/app/main/notifications/actions";

type NotificationItem = {
  id: string;
  notification_id: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  created_by_name: string;
  target_type: string;
  target_name: string | null;
};

export function NotificationDashboard() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const result = await getMyNotifications();
    if (result.data) {
      // Only show unread notifications
      setNotifications(result.data.filter((n) => !n.is_read));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    await fetchNotifications();
  };

  const handleMarkRead = async (recipientId: string) => {
    await markAsRead(recipientId);
    await fetchNotifications();
  };

  // Don't render anything if no pending notifications
  if (!loading && notifications.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <BellIcon className="size-4" />
          {strings.notifications.dashboardPendingTitle}
          {!loading && notifications.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
              {notifications.length}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {!loading && notifications.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheckIcon className="size-3.5" />
              {strings.notifications.dashboardMarkAllRead}
            </button>
          )}
          <Link
            href="/main/notifications"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {strings.notifications.dashboardViewAll}
            <ExternalLinkIcon className="size-3" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border p-4 bg-amber-500/5">
          <p className="text-sm text-muted-foreground">{strings.common.loading}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border p-4 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer"
              onClick={() => handleMarkRead(n.id)}
            >
              <div className="flex items-start gap-3">
                <span className="size-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">{n.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>
                      {strings.notifications.dashboardFrom} {n.created_by_name}
                    </span>
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
                        month: "short",
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
