export interface Guest {
  id: string;
  name: string;
  invite_token: string;
  attending: boolean | null;
  people: number | null;
  created_at?: string | null;
  responded_at?: string | null;
  answered_at?: string | null;
  updated_at?: string | null;
}

export interface VisitEvent {
  event_type: string;
  created_at: string;
  token?: string | null;
}

export type TrackEvent = 'view' | 'open' | 'rsvp_yes' | 'rsvp_no';

export interface RsvpPayload {
  token: string | null;
  name: string;
  attending: boolean;
  people: number;
}

export const MAX_PEOPLE = 20;
export const MAX_NAME = 120;
