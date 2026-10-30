/**
 * Whole Foods writes a date-only range as two instants that share one
 * whole-hour clock time and one offset (both `05:00:00Z` on the 2026-10-29
 * flyer). That end is the start of the last calendar day, so shoppers can
 * use the price through that day: the stored end is one calendar day later,
 * with the same clock time and the same written offset.
 *
 * A missing start, a null end, a non-hour clock (`03:59:59`), a different
 * hour, or a different offset is returned unchanged. This does not convert
 * zones and does not guess a store time zone.
 */

const WHOLE_HOUR_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00:00(?:\.0+)?(Z|[+-]\d{2}:\d{2})$/;

type WholeHourInstant = {
  year: number;
  month: number;
  day: number;
  hour: number;
  offset: string;
};

export function extendDateOnlySaleEnd(input: {
  start: string | null | undefined;
  end: string | null | undefined;
}): string | null | undefined {
  if (input.end == null) {
    return input.end;
  }

  const start = parseWholeHourInstant(input.start);
  const end = parseWholeHourInstant(input.end);
  if (!start || !end || start.hour !== end.hour || start.offset !== end.offset) {
    return input.end;
  }

  return formatWholeHourInstant(addCalendarDay(end));
}

function parseWholeHourInstant(
  value: string | null | undefined,
): WholeHourInstant | null {
  if (value == null) {
    return null;
  }
  const match = WHOLE_HOUR_INSTANT.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const offset = match[5];
  if (
    !offset ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23
  ) {
    return null;
  }
  return { year, month, day, hour, offset };
}

function addCalendarDay(instant: WholeHourInstant): WholeHourInstant {
  const next = new Date(Date.UTC(instant.year, instant.month - 1, instant.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: instant.hour,
    offset: instant.offset,
  };
}

function formatWholeHourInstant(instant: WholeHourInstant): string {
  const month = String(instant.month).padStart(2, "0");
  const day = String(instant.day).padStart(2, "0");
  const hour = String(instant.hour).padStart(2, "0");
  return `${instant.year}-${month}-${day}T${hour}:00:00${instant.offset}`;
}
