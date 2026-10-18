export function formatElapsedTime(timestamp: number) {
  const start = new Date(timestamp);
  const now = new Date();

  if (timestamp > now.getTime()) {
    return "0 seconds";
  }

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;

    const previousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    days += previousMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  // Calculate the remaining time after years/months/days
  const baseDate = new Date(start);
  baseDate.setFullYear(baseDate.getFullYear() + years);
  baseDate.setMonth(baseDate.getMonth() + months);
  baseDate.setDate(baseDate.getDate() + days);

  let remainingSeconds = Math.floor(
    (now.getTime() - baseDate.getTime()) / 1000,
  );

  const hours = Math.floor(remainingSeconds / 3600);
  remainingSeconds %= 3600;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  }

  if (months > 0) {
    parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  }

  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  }

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
  }

  return parts.join(", ");
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
