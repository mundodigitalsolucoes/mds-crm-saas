import { isFeatureId, type FeatureId } from './catalog';

export type ParsedFeatures = Readonly<{
  status: 'valid' | 'empty' | 'missing' | 'invalid';
  features: readonly FeatureId[];
  unknown: readonly string[];
  duplicates: readonly string[];
  error?: 'invalid_json' | 'expected_json_string' | 'expected_string_array';
}>;

/** Reads the existing Plan.features / Organization.features JSON string format. */
export function parseCommercialFeatures(raw: unknown): ParsedFeatures {
  const invalid = (error: ParsedFeatures['error']): ParsedFeatures => ({
    status: 'invalid', features: [], unknown: [], duplicates: [], error,
  });
  if (raw === null || raw === undefined || raw === '') {
    return { status: 'missing', features: [], unknown: [], duplicates: [] };
  }
  if (typeof raw !== 'string') return invalid('expected_json_string');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return invalid('invalid_json'); }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    // Reject the entire malformed payload, including otherwise valid entries.
    return invalid('expected_string_array');
  }
  const seen = new Set<string>();
  const features: FeatureId[] = [], unknown: string[] = [], duplicates: string[] = [];
  for (const id of parsed as string[]) {
    if (seen.has(id)) {
      if (!duplicates.includes(id)) duplicates.push(id);
      continue;
    }
    seen.add(id);
    if (isFeatureId(id)) features.push(id);
    else unknown.push(id);
  }
  return { status: parsed.length ? 'valid' : 'empty', features, unknown, duplicates };
}
