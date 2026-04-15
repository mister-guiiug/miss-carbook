import { useCallback, useEffect } from 'react'
import { IconActionButton, IconChevronRight, IconX } from './IconActionButton'

export type ImageViewerItem = { id: string; url: string }

/**
 * Visionneuse plein écran avec navigation (précédent / suivant, flèches clavier, Échap).
 */
export function ImageViewerCarousel({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: ImageViewerItem[]
  /** Index courant ; `null` = fermé. */
  index: number | null
  onClose: () => void
  onNavigate: (i: number) => void
}) {
  const open = index !== null && items.length > 0
  const safeIndex = open ? Math.min(Math.max(0, index!), items.length - 1) : 0

  const goPrev = useCallback(() => {
    if (index === null || items.length === 0) return
    onNavigate(index <= 0 ? items.length - 1 : index - 1)
  }, [index, items.length, onNavigate])

  const goNext = useCallback(() => {
    if (index === null || items.length === 0) return
    onNavigate(index >= items.length - 1 ? 0 : index + 1)
  }, [index, items.length, onNavigate])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, goPrev, goNext])

  if (!open) return null

  const item = items[safeIndex]
  const several = items.length > 1

  return (
    <div
      className="image-viewer-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Visionneuse photo ${safeIndex + 1} sur ${items.length}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: 'min(96vw, 1400px)',
          maxHeight: 'min(92vh, 900px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconActionButton
          variant="secondary"
          label="Fermer la visionneuse"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            zIndex: 3,
          }}
        >
          <IconX />
        </IconActionButton>

        {several ? (
          <IconActionButton
            variant="secondary"
            label="Photo précédente"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            style={{
              position: 'absolute',
              left: -8,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
            }}
          >
            <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
              <IconChevronRight />
            </span>
          </IconActionButton>
        ) : null}

        {several ? (
          <IconActionButton
            variant="secondary"
            label="Photo suivante"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            style={{
              position: 'absolute',
              right: -8,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
            }}
          >
            <IconChevronRight />
          </IconActionButton>
        ) : null}

        <img
          src={item.url}
          alt={`Photo ${safeIndex + 1} sur ${items.length}`}
          style={{
            maxWidth: 'min(92vw, 1200px)',
            maxHeight: 'min(88vh, 860px)',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 8,
            display: 'block',
          }}
        />

        <div
          className="muted"
          style={{
            position: 'absolute',
            bottom: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.85)',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {several ? (
            <>
              {safeIndex + 1} / {items.length} — flèches du clavier pour défiler · Échap pour fermer
            </>
          ) : (
            <>Échap pour fermer</>
          )}
        </div>
      </div>
    </div>
  )
}
