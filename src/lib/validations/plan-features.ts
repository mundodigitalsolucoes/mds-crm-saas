import { z } from 'zod';
import { FEATURE_CATALOG } from '../entitlements/catalog';
import { parseCommercialFeatures } from '../entitlements/features';

/** Validate the existing serialized format without rewriting legacy identifiers. */
export const serializedPlanFeaturesSchema = z.string().max(5000).superRefine((raw, ctx) => {
  const parsed = parseCommercialFeatures(raw);
  if (parsed.status !== 'valid' && parsed.status !== 'empty') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Features devem ser um array JSON de strings.' });
  }
});

/** New identifiers must be available; valid legacy identifiers may round-trip unchanged. */
export function planFeaturesWriteSchema(previousFeatures?: unknown) {
  const previous = parseCommercialFeatures(previousFeatures);
  const retained = new Set<string>([...previous.features, ...previous.unknown]);

  return serializedPlanFeaturesSchema.superRefine((raw, ctx) => {
    const parsed = parseCommercialFeatures(raw);
    const unknown = parsed.unknown.filter((id) => !retained.has(id));
    const unavailable = parsed.features.filter((id) =>
      FEATURE_CATALOG[id].availability !== 'available' && !retained.has(id));
    if (unknown.length || unavailable.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Não é permitido adicionar features desconhecidas ou indisponíveis. Identificadores legados existentes podem ser preservados.',
      });
    }
  });
}

export const planFeatureChangeSchema = (previousFeatures: unknown) => z.object({
  features: planFeaturesWriteSchema(previousFeatures),
});
