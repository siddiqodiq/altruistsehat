import { expect, test } from "@playwright/test";
import {
  ATHLETE_IMAGE_CROP_PRESETS,
  centeredCropFrame,
  clampCropFrame,
  outputFilename,
} from "../../src/lib/athletes/image-crop";

test("profile crop preset is a square avatar with circular framing metadata", () => {
  const preset = ATHLETE_IMAGE_CROP_PRESETS.profile;

  expect(preset.aspectRatio).toBe(1);
  expect(preset.outputWidth).toBe(512);
  expect(preset.outputHeight).toBe(512);
  expect(preset.bucket).toBe("athlete-profile");
  expect(preset.frameClassName).toContain("rounded-full");
});

test("podium crop preset matches the story export portrait composition", () => {
  const preset = ATHLETE_IMAGE_CROP_PRESETS.podium;

  expect(preset.aspectRatio).toBe(5 / 8);
  expect(preset.outputWidth).toBe(800);
  expect(preset.outputHeight).toBe(1280);
  expect(preset.bucket).toBe("athlete-podium");
  expect(preset.frameClassName).not.toContain("rounded-full");
});

test("centeredCropFrame fits the largest requested aspect ratio inside source bounds", () => {
  expect(centeredCropFrame({ width: 1600, height: 900 }, 1)).toEqual({
    x: 350,
    y: 0,
    width: 900,
    height: 900,
  });

  expect(centeredCropFrame({ width: 900, height: 1600 }, 5 / 8)).toEqual({
    x: 0,
    y: 80,
    width: 900,
    height: 1440,
  });
});

test("clampCropFrame keeps crop area inside the source image", () => {
  expect(
    clampCropFrame(
      { x: -100, y: 1200, width: 700, height: 700 },
      { width: 1200, height: 1600 },
    ),
  ).toEqual({
    x: 0,
    y: 900,
    width: 700,
    height: 700,
  });
});

test("outputFilename preserves the athlete image intent with webp extension", () => {
  expect(outputFilename("Utha Profile.JPG", "profile")).toBe("utha-profile-profile.webp");
  expect(outputFilename("Podium Hero.png", "podium")).toBe("podium-hero-podium.webp");
  expect(outputFilename("Podium Hero.png", "podium", { hasTransparency: true })).toBe("podium-hero-podium-cutout.webp");
});
