"use client";

export type MyBooking = { sessionId: string; token: string; course: string; startsAt: string; room: string };

const KEY = "biorythme:bookings";

export function readMyBookings(): MyBooking[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as MyBooking[]) : [];
    return list.filter((b) => new Date(b.startsAt).getTime() > Date.now() - 3 * 3600_000);
  } catch {
    return [];
  }
}

export function writeMyBookings(list: MyBooking[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* stockage indisponible : on ignore */
  }
}
