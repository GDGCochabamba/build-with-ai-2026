import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "./firebase";

const TZ = "America/La_Paz";

export interface Venue {
  name: string;
  address: string;
  city: string;
  mapUrl?: string;
}

export interface EventInfo {
  name: string;
  edition: number;
  tagline: string;
  description: string;
  startDate: Date;
  endDate: Date;
  venue: Venue | null;
}

export interface Person {
  id: string;
  name: string;
  photoUrl?: string;
}

export interface Member {
  participantId: string;
  role?: string;
  person: Person;
}

export interface Session {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  track?: string;
  url?: string;
  coverImageUrl?: string;
  attendeeCount?: number;
  speakers: Member[];
}

/** Consecutive sessions on the same day and track form one stop on the route. */
export interface Stop {
  key: string;
  track: string;
  date: Date;
  sessions: Session[];
}

export interface EventPage {
  event: EventInfo;
  stops: Stop[];
  speakers: (Member & { sessionTitles: string[] })[];
  organizers: Member[];
  totalAttendees: number;
  sessionCount: number;
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

export async function loadEventPage(slug: string): Promise<EventPage> {
  const db = getDb();
  const eventRef = doc(db, "events", slug);
  const [eventSnap, sessionSnap, partSnap] = await Promise.all([
    getDoc(eventRef),
    getDocs(query(collection(eventRef, "sessions"), orderBy("startTime", "asc"))),
    getDocs(query(collection(eventRef, "participants"), orderBy("order", "asc"))),
  ]);
  if (!eventSnap.exists()) throw new Error(`Event "${slug}" not found in Firestore`);
  const e = eventSnap.data();

  const personIds = [...new Set(partSnap.docs.map((d) => d.data().personId as string))];
  const personSnaps = await Promise.all(personIds.map((id) => getDoc(doc(db, "people", id))));
  const people = new Map<string, Person>();
  for (const s of personSnaps) {
    if (s.exists()) people.set(s.id, { id: s.id, name: s.data().name, photoUrl: s.data().photoUrl });
  }

  const members = new Map<string, Member & { type: string }>();
  for (const d of partSnap.docs) {
    const person = people.get(d.data().personId);
    if (person) members.set(d.id, { participantId: d.id, role: d.data().role, type: d.data().type, person });
  }

  const sessions: Session[] = sessionSnap.docs.map((d) => {
    const s = d.data();
    return {
      id: d.id,
      title: s.title,
      description: s.description,
      start: (s.startTime as Timestamp).toDate(),
      end: (s.endTime as Timestamp).toDate(),
      track: s.track,
      url: s.url,
      coverImageUrl: s.coverImageUrl,
      attendeeCount: s.attendeeCount,
      speakers: ((s.speakerIds as string[]) ?? []).flatMap((id) => members.get(id) ?? []),
    };
  });

  const stops: Stop[] = [];
  for (const s of sessions) {
    const last = stops.at(-1);
    const track = s.track ?? "";
    if (last && last.track === track && dayKey.format(last.date) === dayKey.format(s.start)) {
      last.sessions.push(s);
    } else {
      stops.push({ key: s.id, track, date: s.start, sessions: [s] });
    }
  }

  const speakerSessions = new Map<string, string[]>();
  for (const s of sessions) {
    for (const sp of s.speakers) {
      speakerSessions.set(sp.participantId, [...(speakerSessions.get(sp.participantId) ?? []), s.title]);
    }
  }
  const all = [...members.values()];

  return {
    event: {
      name: e.name,
      edition: e.edition,
      tagline: e.tagline ?? "",
      description: e.description ?? "",
      startDate: (e.startDate as Timestamp).toDate(),
      endDate: (e.endDate as Timestamp).toDate(),
      venue: e.primaryVenue ?? null,
    },
    stops,
    speakers: all
      .filter((m) => m.type === "speaker")
      .map((m) => ({ ...m, sessionTitles: speakerSessions.get(m.participantId) ?? [] })),
    organizers: all.filter((m) => m.type === "organizer"),
    totalAttendees: sessions.reduce((sum, s) => sum + (s.attendeeCount ?? 0), 0),
    sessionCount: sessions.length,
  };
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-BO", { timeZone: TZ, ...opts });
const dayFmt = fmt({ day: "numeric" });
const monthFmt = fmt({ month: "short" });
const weekdayFmt = fmt({ weekday: "long" });
const longFmt = fmt({ day: "numeric", month: "long" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const day = (d: Date) => dayFmt.format(d);
export const month = (d: Date) => monthFmt.format(d).replace(".", "");
export const weekday = (d: Date) => weekdayFmt.format(d);
export const longDate = (d: Date) => longFmt.format(d);
export const timeRange = (s: Session) => `${timeFmt.format(s.start)}–${timeFmt.format(s.end)}`;
export const isoDate = (d: Date) => dayKey.format(d);
