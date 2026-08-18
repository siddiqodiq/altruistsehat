import type { ActivityListItem } from "./api";
import { activityHasDate, coverImageForActivity } from "./schedule";
import { SPORT_TYPES } from "./schema";

export interface HomeGalleryItem {
  id: string;
  activityId: string;
  activityName: string;
  imageUrl: string;
  altText: string;
  isCover: boolean;
  sortOrder: number;
  activityStartsAt?: string;
}

export interface HomeDocumentationCover {
  id: string;
  imageUrl: string;
  altText: string;
}

export interface HomeSportVisual {
  sportType: string;
  imageUrl?: string;
  altText: string;
}

function activityTimestamp(activity: ActivityListItem): number {
  if (!activity.startsAt) {
    return 0;
  }

  const timestamp = Date.parse(activity.startsAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function byHomeActivityOrder(left: ActivityListItem, right: ActivityListItem): number {
  const timeDiff = activityTimestamp(right) - activityTimestamp(left);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return left.name.localeCompare(right.name);
}

function orderedHomeActivities(activities: ActivityListItem[]): ActivityListItem[] {
  return [...activities].sort(byHomeActivityOrder);
}

function sportOrder(sportType: string): number {
  const index = SPORT_TYPES.findIndex((item) => item === sportType);
  return index >= 0 ? index : SPORT_TYPES.length;
}

export function homeFeaturedActivities(activities: ActivityListItem[], limit = 4): ActivityListItem[] {
  return orderedHomeActivities(activities).slice(0, limit);
}

export function homeTimelineActivities(activities: ActivityListItem[]): ActivityListItem[] {
  return orderedHomeActivities(activities.filter(activityHasDate));
}

export function homeSportTypes(activities: ActivityListItem[], limit = 6): string[] {
  const sportTypes = new Set<string>();

  for (const activity of activities) {
    const sportType = activity.sportType?.trim();
    if (sportType) {
      sportTypes.add(sportType);
    }
  }

  return [...sportTypes]
    .sort((left, right) => {
      const orderDiff = sportOrder(left) - sportOrder(right);
      return orderDiff || left.localeCompare(right);
    })
    .slice(0, limit);
}

export function homeSportVisuals(activities: ActivityListItem[], limit = 6): HomeSportVisual[] {
  const visuals = new Map<string, HomeSportVisual>();

  for (const activity of orderedHomeActivities(activities)) {
    const sportType = activity.sportType?.trim();
    if (!sportType) {
      continue;
    }

    const current = visuals.get(sportType) ?? {
      altText: `Olahraga ${sportType}`,
      sportType,
    };
    const coverImage = coverImageForActivity(activity);
    if (!current.imageUrl && coverImage) {
      current.imageUrl = coverImage.imageUrl;
    }
    visuals.set(sportType, current);
  }

  return [...visuals.values()]
    .sort((left, right) => {
      const orderDiff = sportOrder(left.sportType) - sportOrder(right.sportType);
      return orderDiff || left.sportType.localeCompare(right.sportType);
    })
    .slice(0, limit);
}

export function homeDocumentationCovers(activities: ActivityListItem[], limit = 15): HomeDocumentationCover[] {
  return [...activities]
    .sort((left, right) => {
      if (left.visibility !== right.visibility) {
        return left.visibility === "public" ? -1 : 1;
      }
      return byHomeActivityOrder(left, right);
    })
    .flatMap((activity) => {
      const coverImage = coverImageForActivity(activity);
      if (!coverImage) {
        return [];
      }

      return [{
        altText: "Dokumentasi kegiatan",
        id: coverImage.id,
        imageUrl: coverImage.imageUrl,
      }];
    })
    .slice(0, limit);
}

export function homeGalleryItems(activities: ActivityListItem[], limit = 15): HomeGalleryItem[] {
  const items = orderedHomeActivities(activities).flatMap((activity) => {
    const sortedImages = [...activity.images].sort((left, right) => {
      const leftCover = left.isCover || left.imageUrl === activity.coverImageUrl;
      const rightCover = right.isCover || right.imageUrl === activity.coverImageUrl;
      if (leftCover !== rightCover) {
        return leftCover ? -1 : 1;
      }

      return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
    });

    if (!sortedImages.length && activity.coverImageUrl) {
      return [
        {
          activityId: activity.id,
          activityName: activity.name,
          activityStartsAt: activity.startsAt,
          altText: `Dokumentasi ${activity.name}`,
          id: `${activity.id}-cover`,
          imageUrl: activity.coverImageUrl,
          isCover: true,
          sortOrder: 0,
        },
      ];
    }

    return sortedImages.map((image) => ({
      activityId: activity.id,
      activityName: activity.name,
      activityStartsAt: activity.startsAt,
      altText: image.altText?.trim() || `Dokumentasi ${activity.name}`,
      id: image.id,
      imageUrl: image.imageUrl,
      isCover: image.isCover || image.imageUrl === activity.coverImageUrl,
      sortOrder: image.sortOrder,
    }));
  });

  return items.slice(0, limit);
}
