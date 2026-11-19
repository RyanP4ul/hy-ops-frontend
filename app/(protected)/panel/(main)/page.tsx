import type { Metadata } from "next";
import { DashboardProvider } from "../(main)/provider";
import DashboardTwo from "./components/dashboard-two";

export const metadata: Metadata = {
  title: "HYOps - Dashboard",
  description: "Orders, fleet locations, delivery schedules, and cashflow.",
};

export default function Page() {
  return (
    <DashboardProvider>
      <DashboardTwo />
    </DashboardProvider>
  );
}
