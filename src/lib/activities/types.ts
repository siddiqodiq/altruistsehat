export type ActivityScheduleMode = "single" | "weekly" | "monthly" | "flexible" | "coming_soon";
export type ActivityVisibility = "internal" | "public";
export type ActivityRegistrationClosedReason = "disabled" | "manual" | "past" | "private";

export interface ActivityImage {
  id: string;
  activityId: string;
  imageUrl: string;
  sortOrder: number;
  altText?: string;
  isCover: boolean;
}

export interface ActivityParticipant {
  athleteId: string;
  athleteName: string;
  profilePhotoUrl?: string;
}

export interface ActivityDetails {
  id: string;
  name: string;
  activityType: string;
  sportType: string;
  description: string;
  location: string;
  startsAt?: string;
  scheduleMode: ActivityScheduleMode;
  scheduleLabel?: string;
  recurrenceInterval?: number;
  recurrenceWeekday?: number;
  recurrenceMonthWeek?: number;
  recurrenceTime?: string;
  displaySchedule: string;
  documentationUrl?: string;
  logoHasWhiteOutline: boolean;
  logoUrl?: string;
  registrationClosed: boolean;
  registrationClosedReason?: ActivityRegistrationClosedReason;
  registrationEnabled: boolean;
  registrationOpen: boolean;
  visibility: ActivityVisibility;
  createdBy?: string;
  images: ActivityImage[];
  coverImageUrl?: string;
  participants: ActivityParticipant[];
  currentAthleteParticipant: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicActivityPayload = Pick<
  ActivityDetails,
  | "activityType"
  | "coverImageUrl"
  | "description"
  | "displaySchedule"
  | "id"
  | "images"
  | "location"
  | "logoHasWhiteOutline"
  | "logoUrl"
  | "name"
  | "registrationClosedReason"
  | "registrationOpen"
  | "recurrenceInterval"
  | "recurrenceMonthWeek"
  | "recurrenceTime"
  | "recurrenceWeekday"
  | "scheduleLabel"
  | "scheduleMode"
  | "sportType"
  | "startsAt"
>;

export type FullActivityPayload = ActivityDetails;
