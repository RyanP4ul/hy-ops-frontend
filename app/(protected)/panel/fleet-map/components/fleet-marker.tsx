import { TriangleAlert } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { MarkerContent, MarkerTooltip } from "@/components/ui/map";

export type MarkerTone =
  | "vehicle"
  | "lalamove"
  | "parked"
  | "cluster"
  | "warehouse"
  | "return"
  | "next"
  | "pending"
  | "delivered"
  | "failed"
  | "preview"
  | "gps";

type MarkerShape = "beacon" | "pill" | "teardrop" | "depot" | "pickup" | "dot" | "badge";

function resolveMarkerShape(tone: MarkerTone, compact?: boolean): MarkerShape {
  if (compact) return "dot";
  switch (tone) {
    case "vehicle":
    case "lalamove":
    case "parked":
      return "beacon";
    case "cluster":
      return "pill";
    case "warehouse":
      return "depot";
    case "return":
      return "pickup";
    case "gps":
      return "badge";
    case "next":
    case "pending":
    case "delivered":
    case "failed":
    case "preview":
      return "teardrop";
  }
}

function PinSilhouette({
  shape,
  dashed,
  innerRing,
}: {
  shape: "teardrop" | "depot" | "pickup";
  dashed?: boolean;
  innerRing?: boolean;
}) {
  if (shape === "depot") {
    return (
      <svg
        className="fm-pin-svg"
        viewBox="0 0 40 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="fm-pin-body"
          d="M 13 3 H 27 C 31.42 3, 35 6.58, 35 11 V 23 C 35 27.42, 31.42 31, 27 31 H 24.4 L 20.8 39.8 C 20.48 40.55, 19.52 40.55, 19.2 39.8 L 15.6 31 H 13 C 8.58 31, 5 27.42, 5 23 V 11 C 5 6.58, 8.58 3, 13 3 Z"
        />
        <rect
          className="fm-pin-inner"
          x="7.5"
          y="5.5"
          width="25"
          height="23"
          rx="5.5"
        />
      </svg>
    );
  }

  if (shape === "pickup") {
    return (
      <svg
        className="fm-pin-svg"
        viewBox="0 0 36 44"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="fm-pin-body"
          d="M 18 3 C 24.5 3, 30.5 6.2, 31 11.2 V 19.5 C 31 27.2, 23.2 33.8, 18.75 39.7 C 18.38 40.2, 17.62 40.2, 17.25 39.7 C 12.8 33.8, 5 27.2, 5 19.5 V 11.2 C 5.5 6.2, 11.5 3, 18 3 Z"
        />
      </svg>
    );
  }

  return (
    <svg
      className="fm-pin-svg"
      viewBox="0 0 36 44"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="fm-pin-body"
        data-dashed={dashed || undefined}
        d="M 18 3 C 10.82 3, 5 8.82, 5 16 C 5 24.4, 15.1 35.6, 17.35 39.8 C 17.64 40.35, 18.36 40.35, 18.65 39.8 C 20.9 35.6, 31 24.4, 31 16 C 31 8.82, 25.18 3, 18 3 Z"
      />
      {innerRing ? (
        <circle className="fm-pin-ring" cx="18" cy="16" r="10.2" />
      ) : null}
    </svg>
  );
}

export function MarkerGlyph({
  tone,
  children,
  color,
  compact,
  estimated,
  heading,
  pulse,
}: {
  tone: MarkerTone;
  children?: ReactNode;
  color?: string;
  compact?: boolean;
  estimated?: boolean;
  heading?: number | null;
  pulse?: "live" | "selected" | boolean;
}) {
  const shape = resolveMarkerShape(tone, compact);
  const isPin = shape === "teardrop" || shape === "depot" || shape === "pickup";
  const pulseMode =
    pulse === true ? "live" : pulse === false ? undefined : pulse;
  const showHeading =
    shape === "beacon" && heading != null && Number.isFinite(heading);

  return (
    <span
      aria-hidden="true"
      className="fm-marker-face"
      data-tone={tone}
      data-shape={shape}
      data-compact={compact || undefined}
      data-estimated={estimated || undefined}
      data-pulse={pulseMode}
      style={
        color ? ({ "--fm-marker-accent": color } as CSSProperties) : undefined
      }
    >
      {pulseMode ? <span className="fm-marker-pulse" /> : null}
      {showHeading ? (
        <span
          className="fm-beacon-heading"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          <svg
            className="fm-beacon-pointer"
            viewBox="0 0 18 11"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 9 1.5 L 15.5 9.5 H 2.5 Z" />
          </svg>
        </span>
      ) : null}
      {isPin ? (
        <>
          <span className="fm-pin-anchor" />
          <PinSilhouette
            shape={shape}
            dashed={tone === "preview"}
            innerRing={tone === "pending"}
          />
          <span className="fm-pin-content">{children}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}

export function FleetMarker({
  name,
  children,
  title,
  details,
  label,
  accentColor,
  badge,
  warning,
  selected,
  expanded,
  interactive,
  pinned,
  priority,
}: {
  name: string;
  children: ReactNode;
  title: string;
  details?: ReactNode;
  label?: string;
  accentColor?: string;
  badge?: number;
  warning?: string;
  selected?: boolean;
  expanded?: boolean;
  interactive?: boolean;
  pinned?: boolean;
  priority?: "location" | "vehicle" | "selected";
}) {
  const accessibleName = warning ? `${name}, ${warning}` : name;
  const content = (
    <span className="fm-marker-visual">
      {children}
      {warning ? (
        <span className="fm-marker-badge">
          <MarkerGlyph tone="gps">
            <TriangleAlert />
          </MarkerGlyph>
        </span>
      ) : badge ? (
        <span className="fm-marker-badge fm-marker-count">{badge}</span>
      ) : null}
      {label ? (
        <span
          className="fm-marker-label"
          style={
            accentColor
              ? ({ "--fm-label-accent": accentColor } as CSSProperties)
              : undefined
          }
        >
          {accentColor ? <span className="fm-marker-label-dot" aria-hidden="true" /> : null}
          {label}
        </span>
      ) : null}
    </span>
  );

  return (
    <>
      <MarkerContent
        className={priority ? `fm-marker fm-marker-${priority}` : "fm-marker"}
      >
        {interactive ? (
          <button
            type="button"
            className="fm-marker-target"
            aria-label={accessibleName}
            aria-current={selected || undefined}
            aria-expanded={expanded}
            data-pinned={pinned || undefined}
            data-emphasized={selected || expanded || undefined}
          >
            {content}
          </button>
        ) : (
          <span
            role="img"
            tabIndex={0}
            className="fm-marker-target"
            aria-label={accessibleName}
            data-pinned={pinned || undefined}
          >
            {content}
          </span>
        )}
      </MarkerContent>
      <MarkerTooltip className="fm-marker-tooltip">
        <p className="font-semibold">{title}</p>
        {details ? <div className="fm-marker-details">{details}</div> : null}
      </MarkerTooltip>
    </>
  );
}
