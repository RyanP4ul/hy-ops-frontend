import { useEffect, useRef } from "react";
import { useMap } from "@/components/ui/map";

/** North-facing truck with a transparent background and GPS-aligned rotation. */
export function TruckMapIcon({ color, heading, className }: { color: string; heading?: number | null; className?: string }) {
  const { map } = useMap();
  const iconRef = useRef<SVGSVGElement>(null);
  const direction = typeof heading === "number" && Number.isFinite(heading)
    ? ((heading % 360) + 360) % 360
    : null;

  useEffect(() => {
    const rotate = () => {
      if (iconRef.current) {
        // Rotate only the truck: its plate and GPS badge remain upright.
        iconRef.current.style.transform = `rotate(${direction === null ? 0 : direction - (map?.getBearing() ?? 0)}deg)`;
      }
    };
    rotate();
    map?.on("rotate", rotate);
    return () => { map?.off("rotate", rotate); };
  }, [map, direction]);

  return (
    <svg ref={iconRef} viewBox="0 0 40 64" className={className} aria-hidden="true" focusable="false" style={{ transform: `rotate(${direction === null ? 0 : direction - (map?.getBearing() ?? 0)}deg)`, transformOrigin: "center" }}>
      <g fill="#0f172a" stroke="#f8fafc" strokeWidth="1">
        <rect x="3" y="10" width="5" height="12" rx="2" />
        <rect x="32" y="10" width="5" height="12" rx="2" />
        <rect x="3" y="43" width="5" height="14" rx="2" />
        <rect x="32" y="43" width="5" height="14" rx="2" />
      </g>
      <rect x="7" y="3" width="26" height="20" rx="4" fill={color} stroke="#f8fafc" strokeWidth="1.5" />
      <path d="M10 10h20v8H10z" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
      <path d="M12 12h6M22 12h6" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M9 5h5M26 5h5" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" />
      <rect x="8" y="24" width="24" height="36" rx="2" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" />
      <path d="M12 28v26M17 28v26M23 28v26M28 28v26" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M9 25h22v4H9z" fill={color} />
      <path d="M11 58h5M24 58h5" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
