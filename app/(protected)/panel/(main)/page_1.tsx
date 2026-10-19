import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";

import data from "./data.json";
import "leaflet/dist/leaflet.css";
import { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import DashboardMap from "@/components/static/dashboard-map";

export const metadata: Metadata = {
  title: "HyOps - Dashboard",
  description: "HyOps Desc",
};

export default function Page() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col lg:flex-row gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          <div className="w-full lg:w-2/3 rounded-xl relative flex flex-col">
            <DashboardMap />
          </div>
          <div className="w-full lg:w-1/3 grid grid-cols-2 grid-rows-3 gap-4">
            <SectionCards />
          </div>
        </div>
        <DataTable data={data} />
      </div>
    </div>
  );
}
