"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export function NotificationsBell({
  workspaceId,
  notifications: initialNotifications,
}: {
  workspaceId: string;
  notifications: NotificationItem[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function handleMarkAll() {
    setMarking(true);
    const result = await markAllNotificationsRead(workspaceId);
    if (!result.error) setNotifications([]);
    setMarking(false);
  }

  async function handleDismiss(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        Notificaciones
        {notifications.length > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold">Notificaciones</span>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={marking}
                className="text-[11px] text-primary hover:underline disabled:opacity-50"
              >
                Marcar todas como leidas
              </button>
            )}
          </div>
          <div className="mt-1 max-h-72 space-y-1 overflow-auto">
            {notifications.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No hay notificaciones nuevas
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "rounded-lg p-2 text-left hover:bg-muted",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium">{n.title}</p>
                    <button
                      onClick={() => handleDismiss(n.id)}
                      className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Ok
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
