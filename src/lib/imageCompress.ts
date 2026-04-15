import { MAX_IMAGE_BYTES } from './validation/schemas'

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })
}

function fileBaseName(name: string): string {
  const base = name.replace(/[^\w.-]+/g, '_').replace(/\.[^.]+$/, '')
  return base.slice(0, 80) || 'photo'
}

/**
 * Redimensionne et réencode en JPEG jusqu’à ce que la taille soit ≤ maxBytes.
 * Les GIF animés deviennent une image fixe (première frame).
 */
export async function compressImageToMaxBytes(
  file: File,
  maxBytes = MAX_IMAGE_BYTES
): Promise<File> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(
      'Impossible de lire cette image. Essayez un autre fichier (JPEG, PNG, WebP ou GIF).'
    )
  }

  const w = bitmap.width
  const h = bitmap.height
  if (!w || !h) {
    bitmap.close()
    throw new Error('Image invalide (dimensions nulles).')
  }

  const stem = fileBaseName(file.name)
  const qualities = [0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.4, 0.32, 0.25]
  let maxDim = Math.min(2560, Math.max(w, h))

  try {
    for (let round = 0; round < 14; round++) {
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))

      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas non disponible pour la compression.')
      }
      ctx.drawImage(bitmap, 0, 0, cw, ch)

      for (const q of qualities) {
        const blob = await canvasToJpegBlob(canvas, q)
        if (blob && blob.size > 0 && blob.size <= maxBytes) {
          return new File([blob], `${stem}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        }
      }

      if (maxDim <= 320) break
      maxDim = Math.floor(maxDim * 0.72)
    }
  } finally {
    bitmap.close()
  }

  throw new Error(
    `Impossible d’obtenir une image sous ${Math.round(maxBytes / 1024 / 1024)} Mo tout en gardant un détail acceptable. Choisissez une photo plus petite ou recadrez-la.`
  )
}
