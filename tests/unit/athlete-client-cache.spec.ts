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

test("athlete lookup batches uncached names to respect public API limits", async () => {
  const originalFetch = globalThis.fetch;
  const requestSizes: number[] = [];

  globalThis.fetch = (async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? "{}")) as { names: string[] };
    requestSizes.push(payload.names.length);

    return {
      ok: true,
      json: async () => ({
        athletes: payload.names.map((normalizedName) => ({
          id: `athlete-${normalizedName}`,
          name: normalizedName,
          normalizedName,
          username: normalizedName.replace(/\s+/g, "-"),
        })),
      }),
    } as Response;
  }) as typeof fetch;

  try {
    clearAthleteLookupCache();

    const names = Array.from({ length: 105 }, (_, index) => `Athlete ${index + 1}`);
    const result = await lookupAthletesByName(names);

    expect(requestSizes).toEqual([100, 5]);
    expect(result.size).toBe(105);
    expect(result.get("athlete 105")).toMatchObject({
      id: "athlete-athlete 105",
      username: "athlete-105",
    });
  } finally {
    clearAthleteLookupCache();
    globalThis.fetch = originalFetch;
  }
});
