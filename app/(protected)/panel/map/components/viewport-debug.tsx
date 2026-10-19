"use client";

import { StyleKey } from "@/types/geocode";
import { useFleetMap } from "../provider";

export default function ViewportDebug() {
  const { viewport, style, setStyle } = useFleetMap();
  return (
    <>
      <div className="bg-background/80 absolute right-2 bottom-2 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded border px-2 py-1.5 font-mono text-xs backdrop-blur">
        <span>
          <span className="text-muted-foreground">lng:</span>{" "}
          {viewport.center[0].toFixed(3)}
        </span>

        <span>
          <span className="text-muted-foreground">lat:</span>{" "}
          {viewport.center[1].toFixed(3)}
        </span>

        <span>
          <span className="text-muted-foreground">zoom:</span>{" "}
          {viewport.zoom.toFixed(1)}
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10">
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as StyleKey)}
          className="bg-background text-foreground rounded-md border px-2 py-1.5 text-sm shadow"
        >
          <option value="default">Default</option>
          <option value="openstreetmap3d">3D</option>
        </select>
      </div>
    </>
  );
}
