import { z } from 'zod'
import { parsePriceInput } from '../formatPrice'

const authEmailField = z.string().trim().email('Adresse e-mail invalide')

/** Connexion par mot de passe (aligné client ; le projet Supabase peut imposer 6+ caractères). */
export const changeEmailSchema = z.object({
  email: authEmailField,
})

export const authPasswordLoginSchema = z.object({
  email: authEmailField,
  password: z.string().min(1, 'Saisissez le mot de passe'),
})

/** Inscription e-mail + mot de passe. */
export const authPasswordSignUpSchema = z
  .object({
    email: authEmailField,
    password: z.string().min(8, 'Au moins 8 caractères'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

/** Aligné sur Postgres : lettres ASCII, chiffres, `.`, `_`, `-` — pas d’espace ni d’accents. */
export const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9._-]+$/

export const displayNameRules =
  '3 à 30 caractères : lettres sans accent, chiffres, point, tiret et underscore. Unicité (insensible à la casse).'

export const displayNameSchema = z
  .string()
  .trim()
  .min(3, 'Au moins 3 caractères')
  .max(30, '30 caractères maximum')
  .regex(DISPLAY_NAME_REGEX, displayNameRules)

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000).optional().default(''),
  replacement_enabled: z.boolean().optional().default(false),
})

/** Mise à jour du nom et de la description d’un dossier (onglet Réglages). */
export const workspaceMetaUpdateSchema = workspaceCreateSchema.pick({
  name: true,
  description: true,
})

export const shareCodeSchema = z.string().trim().min(4, 'Code trop court').max(16)

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

const currentVehicleSpecsShape = candidateSpecsShape.extend({
  doorCount: z.number().int().min(2).max(9).optional(),
  /** Puissance fiscale (CV, France) */
  fiscalCv: z.number().int().min(1).max(99).optional(),
  gearbox: z.string().max(120).optional(),
  exteriorColor: z.string().max(120).optional(),
})

/** Données techniques du véhicule actuel ; champs supplémentaires autorisés. */
export const currentVehicleSpecsSchema = currentVehicleSpecsShape.partial().passthrough()

export const candidateSchema = z.object({
  brand: z.string().max(120).optional().default(''),
  model: z.string().max(120).optional().default(''),
  trim: z.string().max(120).optional().default(''),
  engine: z.string().max(200).optional().default(''),
  parent_candidate_id: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined || v === null ? null : v)),
  price: z.preprocess(
    (val) => {
      if (val === undefined) return undefined
      if (val === '' || val === null) return null
      if (typeof val === 'number' && !Number.isNaN(val)) return val
      return parsePriceInput(String(val))
    },
    z.union([z.number().min(0), z.null()]).optional()
  ),
  options: z.string().max(4000).optional().default(''),
  garage_location: z.string().max(200).optional().default(''),
  manufacturer_url: z
    .string()
    .max(2000)
    .optional()
    .default('')
    .refine((s) => s.trim() === '' || z.string().url().safeParse(s.trim()).success, 'URL invalide'),
  event_date: z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.union([z.string().max(200, 'Année / période : 200 caractères max'), z.null()]).optional()
  ),
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
  specs: currentVehicleSpecsSchema.optional().default({}),
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
