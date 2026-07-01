export type AthleteImageKind = "profile" | "podium";

export type AthleteImageBucket = "athlete-profile" | "athlete-podium";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface CropFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AthleteImageCropPreset {
  kind: AthleteImageKind;
  label: string;
  bucket: AthleteImageBucket;
  aspectRatio: number;
  outputWidth: number;
  outputHeight: number;
  mimeType: "image/webp";
  quality: number;
  frameClassName: string;
}

export interface CroppedAthleteImage {
  file: File;
  hasTransparency: boolean;
  previewUrl: string;
}

export const ATHLETE_IMAGE_CROP_PRESETS: Record<AthleteImageKind, AthleteImageCropPreset> = {
  profile: {
    kind: "profile",
    label: "Profile Photo",
    bucket: "athlete-profile",
    aspectRatio: 1,
    outputWidth: 512,
    outputHeight: 512,
    mimeType: "image/webp",
    quality: 0.9,
    frameClassName: "rounded-full",
  },
  podium: {
    kind: "podium",
    label: "Story Podium",
    bucket: "athlete-podium",
    aspectRatio: 5 / 8,
    outputWidth: 800,
    outputHeight: 1280,
    mimeType: "image/webp",
    quality: 0.92,
    frameClassName: "rounded-[8px]",
  },
};

export function centeredCropFrame(source: ImageDimensions, aspectRatio: number): CropFrame {
  const safeWidth = Math.max(1, Math.round(source.width));
  const safeHeight = Math.max(1, Math.round(source.height));
  const sourceAspect = safeWidth / safeHeight;

  if (sourceAspect > aspectRatio) {
    const height = safeHeight;
    const width = Math.round(height * aspectRatio);
    return {
      x: Math.round((safeWidth - width) / 2),
      y: 0,
      width,
      height,
    };
  }

  const width = safeWidth;
  const height = Math.round(width / aspectRatio);
  return {
    x: 0,
    y: Math.round((safeHeight - height) / 2),
    width,
    height,
  };
}

export function clampCropFrame(frame: CropFrame, source: ImageDimensions): CropFrame {
  const sourceWidth = Math.max(1, Math.round(source.width));
  const sourceHeight = Math.max(1, Math.round(source.height));
  const width = Math.min(sourceWidth, Math.max(1, Math.round(frame.width)));
  const height = Math.min(sourceHeight, Math.max(1, Math.round(frame.height)));

  return {
    x: Math.min(Math.max(0, Math.round(frame.x)), sourceWidth - width),
    y: Math.min(Math.max(0, Math.round(frame.y)), sourceHeight - height),
    width,
    height,
  };
}

export function outputFilename(inputName: string, kind: AthleteImageKind, options: { hasTransparency?: boolean } = {}): string {
  const withoutExtension = inputName.replace(/\.[^.]+$/, "");
  const slug =
    withoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "athlete-image";
  const transparencySuffix = options.hasTransparency && kind === "podium" ? "-cutout" : "";

  return `${slug}-${kind}${transparencySuffix}.webp`;
}

export function readImageFile(file: File): Promise<{ image: HTMLImageElement; dataUrl: string; dimensions: ImageDimensions }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image file."));
      image.onload = () => {
        resolve({
          image,
          dataUrl,
          dimensions: {
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height,
          },
        });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function cropImageFile(
  file: File,
  image: HTMLImageElement,
  frame: CropFrame,
  preset: AthleteImageCropPreset,
): Promise<CroppedAthleteImage> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = preset.outputWidth;
    canvas.height = preset.outputHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Could not process image file."));
      return;
    }

    context.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      preset.outputWidth,
      preset.outputHeight,
    );
    const hasTransparency = canvasHasTransparency(context, preset.outputWidth, preset.outputHeight);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not export cropped image."));
          return;
        }

        const croppedFile = new File([blob], outputFilename(file.name, preset.kind, { hasTransparency }), {
          type: preset.mimeType,
        });
        resolve({
          file: croppedFile,
          hasTransparency,
          previewUrl: URL.createObjectURL(blob),
        });
      },
      preset.mimeType,
      preset.quality,
    );
  });
}

function canvasHasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const data = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 250) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
