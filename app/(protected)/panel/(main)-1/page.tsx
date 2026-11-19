import type { Metadata } from "next";
import { DashboardProvider } from "./provider";
import DashboardPage from "./components/dashboard-page";

export const metadata: Metadata = {
  title: "HYOps - Dashboard",
  description: "Orders, fleet locations, delivery schedules and business performance.",
};

export default function Page() {
  return <DashboardProvider><DashboardPage /></DashboardProvider>;
}
