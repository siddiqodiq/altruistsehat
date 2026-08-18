export interface ActivityTypeGroup<TActivity> {
  activityType: string;
  activities: TActivity[];
}

const ACTIVITY_TYPE_GROUP_ORDER = ["Sosial", "Workout", "Competition"] as const;

function activityTypeRank(activityType: string): number {
  const index = ACTIVITY_TYPE_GROUP_ORDER.findIndex((type) => type === activityType);
  return index >= 0 ? index : ACTIVITY_TYPE_GROUP_ORDER.length;
}

export function groupActivitiesByActivityType<TActivity extends { activityType: string }>(
  activities: TActivity[],
): ActivityTypeGroup<TActivity>[] {
  const groupsByType = new Map<string, TActivity[]>();

  activities.forEach((activity) => {
    groupsByType.set(activity.activityType, [
      ...(groupsByType.get(activity.activityType) ?? []),
      activity,
    ]);
  });

  return Array.from(groupsByType, ([activityType, groupedActivities]) => ({
    activities: groupedActivities,
    activityType,
  })).sort((left, right) => {
    const rankDelta = activityTypeRank(left.activityType) - activityTypeRank(right.activityType);
    return rankDelta || left.activityType.localeCompare(right.activityType, "id-ID");
  });
}
