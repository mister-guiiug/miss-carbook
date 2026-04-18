import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { formatCandidateListLabel } from '../../../lib/candidateLabel'
import { signedUrlForPath } from '../../../lib/storageUpload'
import { EmptyState } from '../../ui/EmptyState'
import {
  IconActionButton,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconRotateCw,
} from '../../ui/IconActionButton'
import './PhotoComparisonGrid.css'

type Candidate = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
}

type Attachment = {
  id: string
  storage_path: string
  candidate_id: string | null
  mime_type: string
}

type CandidateWithPhotos = Candidate & {
  photos: Attachment[]
  currentPhotoIndex: number
}

const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

type ViewMode = 'grid-2x2' | 'grid-1x4' | 'grid-4x1'

export function PhotoComparisonGrid({
  workspaceId,
  selectedCandidates,
  onClose,
}: {
  workspaceId: string
  selectedCandidates: Candidate[]
  onClose: () => void
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [viewMode, setViewMode] = useState<ViewMode>('grid-2x2')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // État local pour les indices de photo de chaque candidat
  const [photoIndexes, setPhotoIndexes] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const c of selectedCandidates) {
      init[c.id] = 0
    }
    return init
  })

  // Charger les attachments
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const candidateIds = selectedCandidates.map((c) => c.id)
      if (candidateIds.length === 0) {
        setAttachments([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('attachments')
        .select('id, storage_path, candidate_id, mime_type')
        .eq('workspace_id', workspaceId)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (error) {
        console.error('Erreur chargement photos:', error)
        setAttachments([])
      } else {
        setAttachments((data ?? []) as Attachment[])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [workspaceId, selectedCandidates])

  // Organiser les photos par candidat
  const candidatesWithPhotos = useMemo(() => {
    const map = new Map<string, Attachment[]>()
    for (const att of attachments) {
      if (!att.candidate_id) continue
      if (!map.has(att.candidate_id)) map.set(att.candidate_id, [])
      map.get(att.candidate_id)!.push(att)
    }

    return selectedCandidates.map((c) => {
      const photos = map.get(c.id) ?? []
      return {
        ...c,
        photos,
        currentPhotoIndex: photoIndexes[c.id] ?? 0,
      } as CandidateWithPhotos
    })
  }, [attachments, selectedCandidates, photoIndexes])

  const hasAnyPhotos = candidatesWithPhotos.some((c) => c.photos.length > 0)

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom((z) => Math.min(Math.max(z + delta, MIN_ZOOM), MAX_ZOOM))
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0 && zoom > DEFAULT_ZOOM) {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    },
    [zoom, pan]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    },
    [isDragging, dragStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleNextPhoto = useCallback((candidateId: string, photosLength: number) => {
    setPhotoIndexes((prev) => {
      const current = prev[candidateId] ?? 0
      return { ...prev, [candidateId]: (current + 1) % photosLength }
    })
  }, [])

  const handlePrevPhoto = useCallback((candidateId: string, photosLength: number) => {
    setPhotoIndexes((prev) => {
      const current = prev[candidateId] ?? 0
      return { ...prev, [candidateId]: current === 0 ? photosLength - 1 : current - 1 }
    })
  }, [])

  // Gérer les raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-' || e.key === '_') handleZoomOut()
      if (e.key === '0') handleResetZoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, handleZoomIn, handleZoomOut, handleResetZoom])

  // Déterminer la classe de grille selon le mode
  const gridClassName = useMemo(() => {
    switch (viewMode) {
      case 'grid-1x4':
        return 'photo-comparison-grid photo-comparison-grid--1x4'
      case 'grid-4x1':
        return 'photo-comparison-grid photo-comparison-grid--4x1'
      case 'grid-2x2':
      default:
        return 'photo-comparison-grid photo-comparison-grid--2x2'
    }
  }, [viewMode])

  if (loading) {
    return (
      <div className="photo-comparison-backdrop" role="dialog" aria-modal="true">
        <div className="photo-comparison-container">
          <p className="muted">Chargement des photos...</p>
        </div>
      </div>
    )
  }

  if (!hasAnyPhotos) {
    return (
      <div className="photo-comparison-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="photo-comparison-container" onClick={(e) => e.stopPropagation()}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <IconActionButton variant="secondary" label="Fermer" onClick={onClose}>
              <IconX />
            </IconActionButton>
          </div>
          <EmptyState
            icon="comparison"
            title="Aucune photo à comparer"
            text="Les modèles sélectionnés n'ont pas de photos. Ajoutez des photos aux candidats pour utiliser cette fonctionnalité."
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="photo-comparison-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Comparaison photo côte-à-côte"
      onClick={onClose}
    >
      <div className="photo-comparison-container" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="photo-comparison-header">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Comparaison photo</h2>
            <div className="row icon-action-toolbar">
              <IconActionButton variant="secondary" label="Fermer" onClick={onClose}>
                <IconX />
              </IconActionButton>
            </div>
          </div>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            Utilisez la molette pour zoomer · Clic+glisser pour déplacer · <kbd>+</kbd>/<kbd>-</kbd>{' '}
            pour le zoom · <kbd>0</kbd> pour réinitialiser
          </p>
        </div>

        {/* Contrôles */}
        <div className="photo-comparison-controls card" style={{ boxShadow: 'none' }}>
          <div
            className="row"
            style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}
          >
            <div className="row icon-action-toolbar">
              <IconActionButton
                variant="secondary"
                label="Zoom arrière"
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
              >
                <IconZoomOut />
              </IconActionButton>
              <span
                className="muted"
                style={{ minWidth: '3rem', textAlign: 'center', fontSize: '0.9rem' }}
              >
                {Math.round(zoom * 100)}%
              </span>
              <IconActionButton
                variant="secondary"
                label="Zoom avant"
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
              >
                <IconZoomIn />
              </IconActionButton>
              <IconActionButton variant="secondary" label="Réinitialiser" onClick={handleResetZoom}>
                <IconRotateCw />
              </IconActionButton>
            </div>

            <div className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
              <span className="muted">Disposition :</span>
              <button
                type="button"
                className={viewMode === 'grid-2x2' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('grid-2x2')}
                title="Grille 2×2"
              >
                2×2
              </button>
              <button
                type="button"
                className={viewMode === 'grid-1x4' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('grid-1x4')}
                title="Grille 1×4"
              >
                1×4
              </button>
              <button
                type="button"
                className={viewMode === 'grid-4x1' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('grid-4x1')}
                title="Grille 4×1"
              >
                4×1
              </button>
            </div>
          </div>
        </div>

        {/* Grille de photos */}
        <div
          className={gridClassName}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isDragging ? 'grabbing' : zoom > DEFAULT_ZOOM ? 'grab' : 'default',
          }}
        >
          {candidatesWithPhotos.map((candidate) => {
            const photos = candidate.photos
            const hasPhotos = photos.length > 0
            const currentPhoto = hasPhotos ? photos[candidate.currentPhotoIndex] : null

            return (
              <div key={candidate.id} className="photo-comparison-cell">
                <div className="photo-comparison-cell-header">
                  <strong>{formatCandidateListLabel(candidate)}</strong>
                  {hasPhotos && photos.length > 1 ? (
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      {` ${candidate.currentPhotoIndex + 1} / ${photos.length}`}
                    </span>
                  ) : null}
                </div>

                {hasPhotos ? (
                  <div className="photo-comparison-image-wrapper">
                    <PhotoDisplay storagePath={currentPhoto!.storage_path} zoom={zoom} pan={pan} />

                    {photos.length > 1 ? (
                      <div className="photo-comparison-nav">
                        <button
                          type="button"
                          className="photo-comparison-nav-btn"
                          onClick={() => handlePrevPhoto(candidate.id, photos.length)}
                          title="Photo précédente"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="photo-comparison-nav-btn"
                          onClick={() => handleNextPhoto(candidate.id, photos.length)}
                          title="Photo suivante"
                        >
                          ›
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="photo-comparison-empty">
                    <span className="muted">Aucune photo</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type PhotoDisplayProps = {
  storagePath: string
  zoom: number
  pan: { x: number; y: number }
}

function PhotoDisplay({ storagePath, zoom, pan }: PhotoDisplayProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const signedUrl = await signedUrlForPath(storagePath, 7200)
        if (!cancelled) setUrl(signedUrl)
      } catch (err) {
        console.error('Erreur chargement photo:', err)
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storagePath])

  if (error) {
    return (
      <div className="photo-comparison-error">
        <span className="muted">Erreur de chargement</span>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="photo-comparison-loading">
        <span className="muted">Chargement...</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Photo du candidat"
      className="photo-comparison-image"
      style={{
        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
      }}
      draggable={false}
    />
  )
}
