import type { Metadata } from "next";
import { DashboardProvider } from "../(main)/provider";
import DashboardPage1 from "../(main)/components/dashboard-1/dashboard-page";

export const metadata: Metadata = {
  title: "HYOps - Dashboard Command Center",
  description: "Operations control, live fleet monitoring, dispatch calendar, and business intelligence.",
};

export default function Page() {
  return (
    <DashboardProvider>
      <DashboardPage1 />
    </DashboardProvider>
  );
}
