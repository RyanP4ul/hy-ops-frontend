import type { Metadata } from "next";
import { FleetWorkspace } from "./components/fleet-workspace";

export const metadata: Metadata = {
  title: "HyOps — Fleet Dispatch Map",
  description:
    "Live fleet tracking, route verification, delivery stop status, and dispatch operations.",
};

export default function Page() {
  return <FleetWorkspace />;
}
