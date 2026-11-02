"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { DeliveryCalendarEntry } from "@/schema/delivery-calendar";
import { request } from "@/components/http";

type DashboardData = {
  revenue: number;
  monthly_revenue: { month: string; revenue: number }[];
  daily_sales: { day: string; sales: number }[];
  active_deliveries: { run: string; customer: string; destination: string; driver: string; status: string; progress: string }[];
  upcoming_deliveries: { run: string; date: string; time: string; customer: string; destination: string; driver: string }[];
  delivery_calendar: DeliveryCalendarEntry[];
  top_selling_products: { name: string; sku: string; sold: number; revenue: number | null; percent: number }[];
  top_customers: { name: string; location: string; orders: number; amount: number | null; percent: number }[];
  total_orders: number; total_active_deliveries: number; total_pending: number;
};

type DashboardContext = {
  dashboardQuery: UseQueryResult<DashboardData, Error>;
};

const DashboardContext = createContext<DashboardContext | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context)
    throw new Error("useDashboard must be used inside DashboardProvider");
  return context;
}

export function DashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ["dashboard_query"],
    queryFn: async () => {
      const response = await request("GET", `/api/dashboard/stats`);

      if (!response.ok) throw new Error("Dashboard statistics unavailable");

      const result = await response.json();

      return result;
    },
  });

  return (
    <DashboardContext.Provider
      value={{
        dashboardQuery,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
