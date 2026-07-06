import { expect, test } from "@playwright/test";
import { clearAthleteLookupCache, lookupAthletesByName } from "../../src/lib/athletes/client-cache";

test("athlete lookup can force-refresh cached records before export", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  globalThis.fetch = (async () => {
    requestCount += 1;

    return {
      ok: true,
      json: async () => ({
        athletes: [
          {
            id: "athlete-rakha",
            name: "Rakha Maulana",
            normalizedName: "rakha maulana",
            podiumPhotoUrl: requestCount === 1 ? "https://cdn.example.com/old.webp" : "https://cdn.example.com/new.webp",
          },
        ],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    clearAthleteLookupCache();

    const cached = await lookupAthletesByName(["Rakha Maulana"]);
    const stale = await lookupAthletesByName(["Rakha Maulana"]);
    const refreshed = await lookupAthletesByName(["Rakha Maulana"], { forceRefresh: true });

    expect(cached.get("rakha maulana")?.podiumPhotoUrl).toBe("https://cdn.example.com/old.webp");
    expect(stale.get("rakha maulana")?.podiumPhotoUrl).toBe("https://cdn.example.com/old.webp");
    expect(refreshed.get("rakha maulana")?.podiumPhotoUrl).toBe("https://cdn.example.com/new.webp");
    expect(requestCount).toBe(2);
  } finally {
    clearAthleteLookupCache();
    globalThis.fetch = originalFetch;
  }
});
