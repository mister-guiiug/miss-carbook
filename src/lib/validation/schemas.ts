import { z } from 'zod'

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Pseudo requis')
  .max(80, '80 caractères max')

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000).optional().default(''),
  replacement_enabled: z.boolean().optional().default(false),
})

export const shareCodeSchema = z
  .string()
  .trim()
  .min(4, 'Code trop court')
  .max(16)

export const requirementSchema = z.object({
  label: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional().default(''),
  level: z.enum(['mandatory', 'discuss']),
  weight: z
    .union([z.coerce.number().min(0).max(1000), z.nan()])
    .optional()
    .transform((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined)),
  tags: z
    .string()
    .optional()
    .transform((s) =>
      (s ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30)
    ),
})

const candidateSpecsShape = z.object({
  lengthMm: z.number().optional(),
  widthMm: z.number().optional(),
  heightMm: z.number().optional(),
  wheelbaseMm: z.number().optional(),
  trunkLiters: z.number().optional(),
  trunkSeatsFoldedLiters: z.number().optional(),
  consumptionL100: z.number().optional(),
  consumptionKwh100: z.number().optional(),
  powerKw: z.number().optional(),
  powerHp: z.number().optional(),
  co2Gkm: z.number().optional(),
  warrantyMonths: z.number().optional(),
  notes: z.string().max(2000).optional(),
})

/** Schéma documenté côté app ; champs supplémentaires autorisés (constructeurs variés). */
export const candidateSpecsSchema = candidateSpecsShape.partial().passthrough()

export const candidateSchema = z.object({
  brand: z.string().max(120).optional().default(''),
  model: z.string().max(120).optional().default(''),
  trim: z.string().max(120).optional().default(''),
  engine: z.string().max(200).optional().default(''),
  price: z
    .union([z.coerce.number().min(0), z.nan()])
    .optional()
    .transform((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)),
  options: z.string().max(4000).optional().default(''),
  garage_location: z.string().max(200).optional().default(''),
  manufacturer_url: z
    .string()
    .max(2000)
    .optional()
    .default('')
    .refine(
      (s) => s.trim() === '' || z.string().url().safeParse(s.trim()).success,
      'URL invalide'
    ),
  event_date: z.string().optional().nullable(),
  status: z
    .enum(['to_see', 'tried', 'shortlist', 'selected', 'rejected'])
    .optional()
    .default('to_see'),
  reject_reason: z.string().max(2000).optional().default(''),
})

export const reviewSchema = z.object({
  score: z.coerce.number().min(0).max(10),
  free_text: z.string().max(4000).optional().default(''),
  pros: z.string().max(2000).optional().default(''),
  cons: z.string().max(2000).optional().default(''),
})

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

export const currentVehicleSchema = z.object({
  brand: z.string().max(120).optional().default(''),
  model: z.string().max(120).optional().default(''),
  engine: z.string().max(200).optional().default(''),
  year: z
    .union([z.coerce.number().int().min(1950).max(2100), z.nan()])
    .optional()
    .transform((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)),
  options: z.string().max(4000).optional().default(''),
})

/** Limite client alignée sur le bucket (5 Mo) */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const allowedImageMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export function assertImageFile(file: File) {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_IMAGE_BYTES / 1024 / 1024} Mo)`)
  }
  if (!allowedImageMime.includes(file.type as (typeof allowedImageMime)[number])) {
    throw new Error('Type non autorisé (JPEG, PNG, WebP, GIF)')
  }
}
