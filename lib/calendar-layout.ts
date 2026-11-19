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
 *
 * Pass `getVisualEndTime` when point-in-time markers (such as delivery
 * departures) occupy a minimum visual height on the grid so nearby departures
 * are placed side-by-side instead of visually colliding.
 */
export function layoutOverlappingEvents(
  events: CalendarEventResponse[],
  getVisualEndTime: (event: CalendarEventResponse) => Date = (event) =>
    event.end_time,
): PositionedCalendarEvent[] {
  const endMsOf = (event: CalendarEventResponse) =>
    Math.max(event.end_time.getTime(), getVisualEndTime(event).getTime());

  const sorted = [...events].sort(
    (a, b) =>
      a.start_time.getTime() - b.start_time.getTime() ||
      endMsOf(a) - endMsOf(b),
  );
  const positioned: PositionedCalendarEvent[] = [];
  let groupStart = 0;

  while (groupStart < sorted.length) {
    let groupEnd = endMsOf(sorted[groupStart]);
    let groupStop = groupStart + 1;

    // Events connected by any overlap belong to the same visual group.
    while (
      groupStop < sorted.length &&
      sorted[groupStop].start_time.getTime() < groupEnd
    ) {
      groupEnd = Math.max(groupEnd, endMsOf(sorted[groupStop]));
      groupStop += 1;
    }

    const group = sorted.slice(groupStart, groupStop);
    const columnEndTimes: number[] = [];
    const allocated = group.map((event) => {
      const start = event.start_time.getTime();
      const end = endMsOf(event);
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
      const currentStart = current.event.start_time.getTime();
      const currentEnd = endMsOf(current.event);

      while (current.column + columnSpan < columnCount) {
        const nextColumn = current.column + columnSpan;
        const hasConflict = allocated.some(({ event: other, column }) => {
          if (column !== nextColumn) return false;
          return (
            other.start_time.getTime() < currentEnd &&
            endMsOf(other) > currentStart
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
