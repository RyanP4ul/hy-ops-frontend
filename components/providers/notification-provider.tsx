"use client";

import { NotificationQueryResponse } from "@/schema/notification";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import React, { createContext, useContext } from "react";
import { toast } from "sonner";

type NotificationContextType = {
  notification_query: UseQueryResult<NotificationQueryResponse>;
  markAllAsRead: () => Promise<void>;
};

export const NotificationContext =
  createContext<NotificationContextType | null>(null);

export function useNotification() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotification must be used inside NotificationProvider");
  }

  return context;
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const notification_query = useQuery({
    queryKey: ["notification"],

    queryFn: async () => {
      const response = await fetch(`/api/notifications`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      return (await response.json()) as NotificationQueryResponse;
    },
  });

  const markAllAsRead = async () => {
    const response = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok) {
      toast.error(result?.message || "Failed to mark all as read");
    } else {
      toast.success(
        result?.message || "Notifications marked as read successfully",
      );

      notification_query.refetch();
    }
  };

  return (
    <NotificationContext.Provider value={{ notification_query, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}
