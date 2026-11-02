import type { CalendarEventResponse } from "@/schema/calendar";

type PositionedCalendarEvent = {
  event: CalendarEventResponse;
  /** Zero-based visual column in this event's overlap group. */
  column: number;
  /** Number of columns required by this overlap group. */
  columnCount: number;
  /** Number of adjacent columns this event can safely occupy. */
  columnSpan: number;
};

/**
 * Layout overlapping events into side-by-side columns.
 * Events whose end time equals another event's start time do not overlap.
 * It also lets an event use extra columns to its right when those columns
 * contain no event that overlaps its time range.
 */
export function layoutOverlappingEvents(
  events: CalendarEventResponse[],
): PositionedCalendarEvent[] {
  const sorted = [...events].sort(
    (a, b) =>
      a.start_time.getTime() - b.start_time.getTime() ||
      a.end_time.getTime() - b.end_time.getTime(),
  );
  const positioned: PositionedCalendarEvent[] = [];
  let groupStart = 0;

  while (groupStart < sorted.length) {
    let groupEnd = sorted[groupStart].end_time.getTime();
    let groupStop = groupStart + 1;

    // Events connected by any overlap belong to the same visual group.
    while (
      groupStop < sorted.length &&
      sorted[groupStop].start_time.getTime() < groupEnd
    ) {
      groupEnd = Math.max(groupEnd, sorted[groupStop].end_time.getTime());
      groupStop += 1;
    }

    const group = sorted.slice(groupStart, groupStop);
    const columnEndTimes: number[] = [];
    const allocated = group.map((event) => {
      const start = event.start_time.getTime();
      const end = event.end_time.getTime();
      let column = columnEndTimes.findIndex((columnEnd) => columnEnd <= start);

      if (column === -1) {
        column = columnEndTimes.length;
        columnEndTimes.push(end);
      } else {
        columnEndTimes[column] = end;
      }

      return { event, column };
    });

    const columnCount = Math.max(1, columnEndTimes.length);

    for (const current of allocated) {
      let columnSpan = 1;

      while (current.column + columnSpan < columnCount) {
        const nextColumn = current.column + columnSpan;
        const hasConflict = allocated.some(({ event: other, column }) => {
          if (column !== nextColumn) return false;
          return (
            other.start_time.getTime() < current.event.end_time.getTime() &&
            other.end_time.getTime() > current.event.start_time.getTime()
          );
        });

        if (hasConflict) break;
        columnSpan += 1;
      }

      positioned.push({
        event: current.event,
        column: current.column,
        columnCount,
        columnSpan,
      });
    }

    groupStart = groupStop;
  }

  return positioned;
}

