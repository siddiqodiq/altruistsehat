export type AthletePhotoKind = "profile" | "podium";

export interface AthletePhotoSource {
  name: string;
  profile_photo_url?: string | null;
  podium_photo_url?: string | null;
}

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function athletePhotoUrlForKind(source: AthletePhotoSource, kind: AthletePhotoKind): string | undefined {
  return (kind === "profile" ? source.profile_photo_url : source.podium_photo_url) ?? undefined;
}

export function extensionForAthletePhoto(contentType: string, sourceUrl: string): string {
  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase();
  const contentExtension = normalizedContentType ? CONTENT_TYPE_EXTENSIONS[normalizedContentType] : undefined;
  if (contentExtension) {
    return contentExtension;
  }

  try {
    const pathname = new URL(sourceUrl).pathname;
    const urlExtension = pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (urlExtension && ["jpg", "jpeg", "png", "webp"].includes(urlExtension)) {
      return urlExtension === "jpeg" ? "jpg" : urlExtension;
    }
  } catch {
    const urlExtension = sourceUrl.split("?")[0]?.split("#")[0]?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (urlExtension && ["jpg", "jpeg", "png", "webp"].includes(urlExtension)) {
      return urlExtension === "jpeg" ? "jpg" : urlExtension;
    }
  }

  return "jpg";
}

function slugForFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "athlete"
  );
}

export function athletePhotoFilename(name: string, kind: AthletePhotoKind, contentType: string, sourceUrl: string): string {
  return `${slugForFilename(name)}-${kind}.${extensionForAthletePhoto(contentType, sourceUrl)}`;
}
