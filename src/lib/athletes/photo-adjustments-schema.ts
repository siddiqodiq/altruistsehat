import { z } from "zod";
import { EXPORT_PHOTO_ADJUSTMENT_LIMITS } from "../leaderboard/photo-adjustments";

const PhotoAdjustmentSchema = z.object({
  zoom: z.number().finite().min(EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMin).max(EXPORT_PHOTO_ADJUSTMENT_LIMITS.zoomMax),
  x: z.number().finite().min(EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMin).max(EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMax),
  y: z.number().finite().min(EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMin).max(EXPORT_PHOTO_ADJUSTMENT_LIMITS.offsetMax),
});

export const PodiumPhotoAdjustmentsSchema = z.object({
  podiumTop10: PhotoAdjustmentSchema.optional(),
  top5: PhotoAdjustmentSchema.optional(),
  top4: PhotoAdjustmentSchema.optional(),
  top3: PhotoAdjustmentSchema.optional(),
  top2: PhotoAdjustmentSchema.optional(),
  top1: PhotoAdjustmentSchema.optional(),
});
