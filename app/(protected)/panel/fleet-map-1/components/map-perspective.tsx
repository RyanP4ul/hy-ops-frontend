import { useEffect } from "react";
import { useMap } from "@/components/ui/map";

/** Google vector maps provide their own tilt and 3D building rendering. */
export function MapPerspective({ onChange }: { onChange: (is3D: boolean) => void }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const sync = () => onChange(map.getPitch() > 1);
    sync();
    map.on("pitch", sync);
    return () => { map.off("pitch", sync); };
  }, [map, onChange]);
  return null;
}
