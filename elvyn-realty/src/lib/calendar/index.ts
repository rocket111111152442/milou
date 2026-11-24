import "server-only";
import { env } from "@/config/env";

/**
 * Calendar connection point. No external calendar is connected today (CALENDAR_PROVIDER=none):
 * visit requests stay "pending confirmation" and Elvyn confirms a time in the CRM, which
 * prevents double bookings between confirmed visits.
 *
 * To connect Google Calendar later, implement `isFree` (FreeBusy API) and `createEvent`
 * for provider "google" and set CALENDAR_PROVIDER=google with its credentials.
 */
export interface CalendarProvider {
  connected: boolean;
  name: string;
  isFree(start: Date, end: Date): Promise<boolean>;
}

const none: CalendarProvider = { connected: false, name: "none", isFree: async () => true };

export function getCalendar(): CalendarProvider {
  switch (env.calendar.provider) {
    case "none":
    default:
      return none;
  }
}
