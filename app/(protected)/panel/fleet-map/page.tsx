import type { Metadata } from "next";
import { FleetWorkspace } from "./components/fleet-workspace";

export const metadata: Metadata = {
  title: "HyOps — Fleet Map",
  description: "Live fleet tracking, delivery stops, and dispatch.",
};

export default function Page() {
  return <FleetWorkspace />;
}
