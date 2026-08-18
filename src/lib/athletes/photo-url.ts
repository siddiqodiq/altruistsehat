const STRAVA_ATHLETE_CDN_HOSTS = new Set(["dgalywyr863hv.cloudfront.net"]);

function isStravaAthleteCdnUrl(url: URL): boolean {
  return STRAVA_ATHLETE_CDN_HOSTS.has(url.hostname.toLowerCase()) && url.pathname.startsWith("/pictures/athletes/");
}

export function normalizedAthletePhotoUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^(data|blob):/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return isStravaAthleteCdnUrl(url) ? undefined : trimmed;
  } catch {
    return trimmed;
  }
}

export function resolveUsableAthletePhotoUrl(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const normalized = normalizedAthletePhotoUrl(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}
