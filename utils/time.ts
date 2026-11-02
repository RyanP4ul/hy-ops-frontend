export function formatElapsedTime(
  timestamp: number | null | undefined,
  now = Date.now(),
): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "Date unavailable";
  }

  // Notification.created_at is an epoch-seconds integer, not milliseconds.
  const timestampMs = timestamp * 1000;
  if (!Number.isFinite(timestampMs) || !Number.isFinite(new Date(timestampMs).getTime())) {
    return "Date unavailable";
  }

  const deltaSeconds = (timestampMs - now) / 1000;
  if (Math.abs(deltaSeconds) < 60) {
    return deltaSeconds > 0 ? "in a few seconds" : "just now";
  }

  const elapsedSeconds = Math.abs(deltaSeconds);
  const unit =
    elapsedSeconds < 60 * 60
      ? "minute"
      : elapsedSeconds < 24 * 60 * 60
        ? "hour"
        : elapsedSeconds < 30 * 24 * 60 * 60
          ? "day"
          : elapsedSeconds < 365 * 24 * 60 * 60
            ? "month"
            : "year";
  const secondsPerUnit = {
    minute: 60,
    hour: 60 * 60,
    day: 24 * 60 * 60,
    month: 30 * 24 * 60 * 60,
    year: 365 * 24 * 60 * 60,
  }[unit];
  const value = Math.round(deltaSeconds / secondsPerUnit);

  return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(
    value,
    unit,
  );
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");

  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
