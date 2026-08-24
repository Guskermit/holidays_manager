"use client";

import { useState, useEffect, useCallback } from "react";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";
import { getMyNotifications, markAsRead, markAllAsRead } from "@/app/main/notifications/actions";

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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const result = await getMyNotifications();
    if (result.data) {
      setNotifications(result.data);
      setUnreadCount(result.unreadCount ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 60 seconds for new notifications
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

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={strings.notifications.bellLabel}
      >
        <BellIcon className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center size-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-[380px] max-h-[480px] rounded-xl border bg-popover shadow-lg overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-sm">
                {strings.notifications.bellLabel}
              </h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheckIcon className="size-3.5 mr-1" />
                  {strings.notifications.markAllRead}
                </Button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {strings.common.loading}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {strings.notifications.bellEmpty}
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                      !n.is_read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                    }`}
                    onClick={() => !n.is_read && handleMarkRead(n.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!n.is_read && (
                            <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <p className="text-sm font-medium truncate">
                            {n.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{n.created_by_name}</span>
                          {n.target_type !== "all" && n.target_name && (
                            <>
                              <span>·</span>
                              <span>{n.target_name}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>
                            {new Date(n.created_at).toLocaleDateString(
                              "es-ES",
                              {
                                day: "2-digit",
                                month: "short",
                              }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t px-4 py-2 text-center">
                <a
                  href="/main/notifications"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  {strings.notifications.viewAll}
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
