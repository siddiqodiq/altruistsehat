import { z } from "zod";

const PhotoAdjustmentSchema = z.object({
  zoom: z.number().finite().min(0.8).max(2.2),
  x: z.number().finite().min(-40).max(40),
  y: z.number().finite().min(-40).max(40),
});

export const PodiumPhotoAdjustmentsSchema = z.object({
  podiumTop10: PhotoAdjustmentSchema.optional(),
  top5: PhotoAdjustmentSchema.optional(),
  top4: PhotoAdjustmentSchema.optional(),
  top3: PhotoAdjustmentSchema.optional(),
  top2: PhotoAdjustmentSchema.optional(),
  top1: PhotoAdjustmentSchema.optional(),
});
