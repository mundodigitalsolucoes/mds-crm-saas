import { z } from 'zod';
import { safeBrandAsset } from '../branding-values';
const asset = z.string().max(2048).refine(value => safeBrandAsset(value) !== null, 'Use HTTPS sem credenciais ou caminho local seguro').nullable().optional();
export const brandingUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  logo: asset, favicon: asset,
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).strict('Campo não permitido na configuração visual');
