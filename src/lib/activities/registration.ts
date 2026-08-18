import type { ActivityRegistrationClosedReason, ActivityVisibility } from "./types";

export interface ActivityRegistrationSource {
  registrationClosed?: boolean;
  registrationEnabled?: boolean;
  startsAt?: string;
  visibility?: ActivityVisibility;
}

export interface ActivityRegistrationState {
  closedReason?: ActivityRegistrationClosedReason;
  isOpen: boolean;
}

export function activityRegistrationState(
  activity: ActivityRegistrationSource,
  now: Date = new Date(),
): ActivityRegistrationState {
  if (activity.visibility !== "public") {
    return { closedReason: "private", isOpen: false };
  }

  if (!activity.registrationEnabled) {
    return { closedReason: "disabled", isOpen: false };
  }

  if (activity.registrationClosed) {
    return { closedReason: "manual", isOpen: false };
  }

  if (activity.startsAt) {
    const startsAt = Date.parse(activity.startsAt);
    if (Number.isFinite(startsAt) && startsAt <= now.getTime()) {
      return { closedReason: "past", isOpen: false };
    }
  }

  return { closedReason: undefined, isOpen: true };
}
