import { expect, test } from "@playwright/test";
import {
  ATHLETE_IMAGE_CROP_PRESETS,
  ATHLETE_IMAGE_CROP_ZOOM_LIMITS,
  centeredCropFrame,
  clampCropFrame,
  cropFrameForZoom,
  cropFrameImagePlacement,
  cropOutputDimensionsForFrame,
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

test("outputFilename follows the browser encoder fallback mime type", () => {
  expect(outputFilename("Runner.JPG", "podium", { mimeType: "image/jpeg" })).toBe("runner-podium.jpg");
  expect(outputFilename("Cutout.png", "podium", { hasTransparency: true, mimeType: "image/png" })).toBe("cutout-podium-cutout.png");
});

test("podium crop zoom can shrink a wide source into the portrait canvas", () => {
  const source = { width: 1600, height: 900 };
  const frame = cropFrameForZoom({
    aspectRatio: ATHLETE_IMAGE_CROP_PRESETS.podium.aspectRatio,
    currentFrame: centeredCropFrame(source, ATHLETE_IMAGE_CROP_PRESETS.podium.aspectRatio),
    source,
    zoom: ATHLETE_IMAGE_CROP_ZOOM_LIMITS.min,
  });

  expect(frame.width).toBeGreaterThan(source.width);
  expect(frame.height).toBeGreaterThan(source.height);
  expect(frame.x).toBeLessThanOrEqual(0);
  expect(frame.y).toBeLessThanOrEqual(0);
  expect(frame.x + frame.width).toBeGreaterThanOrEqual(source.width);
  expect(frame.y + frame.height).toBeGreaterThanOrEqual(source.height);
});

test("crop image placement preserves padding when the crop frame is larger than the source", () => {
  const placement = cropFrameImagePlacement(
    { width: 1600, height: 900 },
    { x: -326, y: -1352, width: 2252, height: 3603 },
    { width: 800, height: 1280 },
  );

  expect(placement.x).toBeGreaterThan(0);
  expect(placement.y).toBeGreaterThan(0);
  expect(placement.width).toBeLessThan(800);
  expect(placement.height).toBeLessThan(1280);
  expect(placement.x + placement.width).toBeLessThan(800);
  expect(placement.y + placement.height).toBeLessThan(1280);
});

test("cropOutputDimensionsForFrame scales upload output up for large sources without exceeding safe caps", () => {
  expect(cropOutputDimensionsForFrame(ATHLETE_IMAGE_CROP_PRESETS.profile, { x: 0, y: 0, width: 1800, height: 1800 })).toEqual({
    width: 1024,
    height: 1024,
  });
  expect(cropOutputDimensionsForFrame(ATHLETE_IMAGE_CROP_PRESETS.podium, { x: 0, y: 0, width: 2500, height: 4000 })).toEqual({
    width: 1600,
    height: 2560,
  });
});
