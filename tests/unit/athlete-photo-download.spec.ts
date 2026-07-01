import { expect, test } from "@playwright/test";
import {
  athletePhotoFilename,
  athletePhotoUrlForKind,
  extensionForAthletePhoto,
} from "../../src/lib/athletes/photo-download";

test("athlete photo download helper resolves the requested stored photo URL", () => {
  const row = {
    name: "Utha",
    profile_photo_url: "https://cdn.example.com/profile.jpg",
    podium_photo_url: "https://cdn.example.com/podium-cutout.webp",
  };

  expect(athletePhotoUrlForKind(row, "profile")).toBe("https://cdn.example.com/profile.jpg");
  expect(athletePhotoUrlForKind(row, "podium")).toBe("https://cdn.example.com/podium-cutout.webp");
});

test("athlete photo download filenames are readable and preserve image extension intent", () => {
  expect(athletePhotoFilename("Utha Pramana", "profile", "image/jpeg", "https://cdn.example.com/a")).toBe("utha-pramana-profile.jpg");
  expect(athletePhotoFilename("Stefanus Zen", "podium", "image/webp", "https://cdn.example.com/podium-cutout")).toBe("stefanus-zen-podium.webp");
  expect(athletePhotoFilename("Budi", "podium", "", "https://cdn.example.com/budi-podium.png?token=abc")).toBe("budi-podium.png");
});

test("athlete photo extension falls back safely for unknown image metadata", () => {
  expect(extensionForAthletePhoto("image/png", "")).toBe("png");
  expect(extensionForAthletePhoto("application/octet-stream", "https://cdn.example.com/photo.webp")).toBe("webp");
  expect(extensionForAthletePhoto("", "https://cdn.example.com/photo")).toBe("jpg");
});
