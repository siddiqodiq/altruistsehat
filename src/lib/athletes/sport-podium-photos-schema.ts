import { z } from "zod";

const OptionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().url().optional(),
);

export const SportPodiumPhotoUrlsSchema = z
  .object({
    cycling: OptionalUrlSchema,
    running: OptionalUrlSchema,
    swimming: OptionalUrlSchema,
    weight_training: OptionalUrlSchema,
  })
  .partial();
