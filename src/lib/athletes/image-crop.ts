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
  maxOutputWidth: number;
  maxOutputHeight: number;
  mimeType: AthleteImageOutputMimeType;
  quality: number;
  frameClassName: string;
}

export interface CroppedAthleteImage {
  file: File;
  hasTransparency: boolean;
  previewUrl: string;
}

export interface CropFrameImagePlacement {
  height: number;
  width: number;
  x: number;
  y: number;
}

export type AthleteImageOutputMimeType = "image/jpeg" | "image/png" | "image/webp";

const OUTPUT_MIME_EXTENSIONS: Record<AthleteImageOutputMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ATHLETE_IMAGE_CROP_ZOOM_LIMITS = {
  max: 3,
  min: 0.2,
} as const;

export const ATHLETE_IMAGE_CROP_PRESETS: Record<AthleteImageKind, AthleteImageCropPreset> = {
  profile: {
    kind: "profile",
    label: "Profile Photo",
    bucket: "athlete-profile",
    aspectRatio: 1,
    outputWidth: 512,
    outputHeight: 512,
    maxOutputWidth: 1024,
    maxOutputHeight: 1024,
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
    maxOutputWidth: 1600,
    maxOutputHeight: 2560,
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

export function cropFrameOffsetLimits(sourceSize: number, frameSize: number): { max: number; min: number } {
  const safeSourceSize = Math.max(1, Math.round(sourceSize));
  const safeFrameSize = Math.max(1, Math.round(frameSize));

  if (safeFrameSize > safeSourceSize) {
    return {
      max: 0,
      min: safeSourceSize - safeFrameSize,
    };
  }

  return {
    max: safeSourceSize - safeFrameSize,
    min: 0,
  };
}

export function clampZoomableCropFrame(frame: CropFrame, source: ImageDimensions): CropFrame {
  const sourceWidth = Math.max(1, Math.round(source.width));
  const sourceHeight = Math.max(1, Math.round(source.height));
  const width = Math.max(1, Math.round(frame.width));
  const height = Math.max(1, Math.round(frame.height));
  const xLimits = cropFrameOffsetLimits(sourceWidth, width);
  const yLimits = cropFrameOffsetLimits(sourceHeight, height);

  return {
    x: Math.min(xLimits.max, Math.max(xLimits.min, Math.round(frame.x))),
    y: Math.min(yLimits.max, Math.max(yLimits.min, Math.round(frame.y))),
    width,
    height,
  };
}

export function cropFrameForZoom({
  aspectRatio,
  currentFrame,
  source,
  zoom,
}: {
  aspectRatio: number;
  currentFrame: CropFrame;
  source: ImageDimensions;
  zoom: number;
}): CropFrame {
  const safeAspectRatio = Math.max(0.01, aspectRatio);
  const safeZoom = Math.max(ATHLETE_IMAGE_CROP_ZOOM_LIMITS.min, Math.min(ATHLETE_IMAGE_CROP_ZOOM_LIMITS.max, Number.isFinite(zoom) ? zoom : 1));
  const baseFrame = centeredCropFrame(source, safeAspectRatio);
  const centerX = currentFrame.x + currentFrame.width / 2;
  const centerY = currentFrame.y + currentFrame.height / 2;
  const nextWidth = Math.max(64, Math.round(baseFrame.width / safeZoom));
  const nextHeight = Math.max(64, Math.round(nextWidth / safeAspectRatio));

  return clampZoomableCropFrame(
    {
      x: Math.round(centerX - nextWidth / 2),
      y: Math.round(centerY - nextHeight / 2),
      width: nextWidth,
      height: nextHeight,
    },
    source,
  );
}

export function outputFilename(
  inputName: string,
  kind: AthleteImageKind,
  options: { hasTransparency?: boolean; mimeType?: AthleteImageOutputMimeType } = {},
): string {
  const withoutExtension = inputName.replace(/\.[^.]+$/, "");
  const slug =
    withoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "athlete-image";
  const transparencySuffix = options.hasTransparency && kind === "podium" ? "-cutout" : "";
  const extension = OUTPUT_MIME_EXTENSIONS[options.mimeType ?? "image/webp"];

  return `${slug}-${kind}${transparencySuffix}.${extension}`;
}

export function cropOutputDimensionsForFrame(preset: AthleteImageCropPreset, frame: Pick<CropFrame, "width" | "height">): ImageDimensions {
  const frameWidth = Math.max(1, Math.round(frame.width));
  const frameHeight = Math.max(1, Math.round(frame.height));
  const frameAspect = frameWidth / frameHeight;
  const sourceWidth =
    frameAspect >= preset.aspectRatio
      ? Math.max(preset.outputWidth, frameWidth)
      : Math.max(preset.outputWidth, Math.round(frameHeight * preset.aspectRatio));
  const sourceHeight = Math.round(sourceWidth / preset.aspectRatio);
  const capScale = Math.min(1, preset.maxOutputWidth / sourceWidth, preset.maxOutputHeight / sourceHeight);
  const width = Math.max(preset.outputWidth, Math.round(sourceWidth * capScale));

  return {
    width,
    height: Math.max(preset.outputHeight, Math.round(width / preset.aspectRatio)),
  };
}

export function cropFrameImagePlacement(source: ImageDimensions, frame: CropFrame, output: ImageDimensions): CropFrameImagePlacement {
  const sourceWidth = Math.max(1, source.width);
  const sourceHeight = Math.max(1, source.height);
  const frameWidth = Math.max(1, frame.width);
  const frameHeight = Math.max(1, frame.height);
  const outputWidth = Math.max(1, output.width);
  const outputHeight = Math.max(1, output.height);

  return {
    x: ((0 - frame.x) / frameWidth) * outputWidth,
    y: ((0 - frame.y) / frameHeight) * outputHeight,
    width: (sourceWidth / frameWidth) * outputWidth,
    height: (sourceHeight / frameHeight) * outputHeight,
  };
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
    const outputDimensions = cropOutputDimensionsForFrame(preset, frame);
    canvas.width = outputDimensions.width;
    canvas.height = outputDimensions.height;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Could not process image file."));
      return;
    }

    const sourceDimensions = {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
    const placement = cropFrameImagePlacement(sourceDimensions, frame, outputDimensions);
    context.clearRect(0, 0, outputDimensions.width, outputDimensions.height);
    context.drawImage(image, placement.x, placement.y, placement.width, placement.height);
    const hasTransparency = canvasHasTransparency(context, outputDimensions.width, outputDimensions.height);

    void encodeCanvasForAthleteImage(canvas, preset, hasTransparency)
      .then(({ blob, mimeType }) => {
        const croppedFile = new File([blob], outputFilename(file.name, preset.kind, { hasTransparency, mimeType }), {
          type: mimeType,
        });
        resolve({
          file: croppedFile,
          hasTransparency,
          previewUrl: URL.createObjectURL(blob),
        });
      })
      .catch(reject);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: AthleteImageOutputMimeType, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not export cropped image."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function normalizeOutputMimeType(value: string): AthleteImageOutputMimeType | undefined {
  if (value === "image/jpeg" || value === "image/png" || value === "image/webp") {
    return value;
  }

  return undefined;
}

async function encodeCanvasForAthleteImage(
  canvas: HTMLCanvasElement,
  preset: AthleteImageCropPreset,
  hasTransparency: boolean,
): Promise<{ blob: Blob; mimeType: AthleteImageOutputMimeType }> {
  const preferredBlob = await canvasToBlob(canvas, preset.mimeType, preset.quality);
  const preferredMimeType = normalizeOutputMimeType(preferredBlob.type);

  if (preferredMimeType === preset.mimeType) {
    return { blob: preferredBlob, mimeType: preferredMimeType };
  }

  if (hasTransparency) {
    if (preferredMimeType === "image/png") {
      return { blob: preferredBlob, mimeType: preferredMimeType };
    }

    const pngBlob = await canvasToBlob(canvas, "image/png", preset.quality);
    return {
      blob: pngBlob,
      mimeType: normalizeOutputMimeType(pngBlob.type) ?? "image/png",
    };
  }

  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", Math.min(0.92, preset.quality));
  return {
    blob: jpegBlob,
    mimeType: normalizeOutputMimeType(jpegBlob.type) ?? preferredMimeType ?? "image/png",
  };
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
