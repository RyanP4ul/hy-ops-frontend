"use client";

import { NotificationQueryResponse } from "@/schema/notification";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { request } from "@/components/http";
import { toast } from "sonner";

type NotificationContextType = {
  notification_query: UseQueryResult<NotificationQueryResponse>;
  markAllAsRead: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markingAllRead: boolean;
};

export const NotificationContext = createContext<NotificationContextType | null>(null);
export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used inside NotificationProvider");
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const notification_query = useQuery({
    queryKey: ["notification"],
    queryFn: async () => {
      const response = await request("GET", "/api/notifications");
      if (!response.ok) throw new Error("Unable to load notifications. Please retry.");
      const result = await response.json();
      if (!Array.isArray(result.rows)) throw new Error("Unable to load notifications. Please retry.");
      return result as NotificationQueryResponse;
    },
  });
  const markRead = useMutation({
    mutationFn: async (id: number | null) => {
      const response = await request("POST", id === null ? "/api/notifications/mark-all-read" : `/api/notifications/${id}/read`, {});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to mark notifications as read.");
      return id;
    },
    onSuccess: (id) => {
      client.setQueryData<NotificationQueryResponse>(["notification"], old => {
        if (!old) return old;
        const newlyRead = old.rows.filter(row => !row.is_read && (id === null || row.id === id)).length;
        return { total_unread: Math.max(0, old.total_unread - newlyRead), rows: old.rows.map(row => id === null || row.id === id ? { ...row, is_read: true } : row) };
      });
      void client.invalidateQueries({ queryKey: ["notification"] });
    },
    onError: (error) => toast.error(error.message),
  });
  async function markAsRead(id: number) { await markRead.mutateAsync(id).catch(() => {}); }
  async function markAllAsRead() { await markRead.mutateAsync(null).catch(() => {}); }

  return <NotificationContext.Provider value={{ notification_query, markAllAsRead, markAsRead, markingAllRead: markRead.isPending && markRead.variables === null }}>{children}</NotificationContext.Provider>;
}
