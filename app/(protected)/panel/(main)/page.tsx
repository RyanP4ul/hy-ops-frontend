import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";

import data from "./data.json";
import "leaflet/dist/leaflet.css";
import { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import DashboardMap from "@/components/static/dashboard-map";
import { DashboardProvider } from "./provider";
import DashboardPage from "./components/dashboard-page";

export const metadata: Metadata = {
  title: "HyOps - Dashboard",
  description: "HyOps Desc",
};

export default function Page() {
  return (
    <DashboardProvider>
      <DashboardPage />
    </DashboardProvider>
  );
}
