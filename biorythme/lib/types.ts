import type { ClubId } from "./site";

export type Room = { id: string; club: ClubId; name: string; capacity: number; color: string; position: number };
export type Coach = { id: string; name: string; specialty: string };
export type Course = {
  id: string;
  name: string;
  description: string;
  intensity: number;
  duration_min: number;
  color: string;
};
export type Session = {
  id: string;
  course_id: string;
  room_id: string;
  coach_id: string | null;
  starts_at: string;
  duration_min: number;
  capacity: number;
  booked_count: number;
  published: boolean;
  cancelled: boolean;
};
export type SessionFull = Session & { course: Course; room: Room; coach: Coach | null };
export type Booking = {
  id: string;
  session_id: string;
  name: string;
  email: string;
  phone: string;
  status: "confirmed" | "cancelled";
  created_at: string;
};

export const SESSION_SELECT = "*, course:bio_courses(*), room:bio_rooms(*), coach:bio_coaches(*)";
