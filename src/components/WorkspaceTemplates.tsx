import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useErrorDialog } from '../contexts/ErrorDialogContext'
import { useToast } from '../contexts/ToastContext'
import { EmptyState } from './ui/EmptyState'
import { IconActionButton, IconPlus, IconX, IconDuplicate } from './ui/IconActionButton'

type Workspace = {
  id: string
  name: string
  description: string
}

type Template = {
  id: string
  name: string
  description: string
  category: string
  is_public: boolean
  created_by: string
  usage_count: number
  created_at: string
}

type Profile = {
  id: string
  display_name: string
}

const CATEGORIES = [
  { value: 'general', label: 'Général' },
  { value: 'suv', label: 'SUV' },
  { value: 'berline', label: 'Berline' },
  { value: 'citadine', label: 'Citadine' },
  { value: 'utilitaire', label: 'Utilitaire' },
  { value: 'sportive', label: 'Sportive' },
  { value: 'electrique', label: 'Électrique' },
  { value: 'hybride', label: 'Hybride' },
  { value: 'familiale', label: 'Familiale' },
] as const

interface WorkspaceTemplatesProps {
  onClose?: () => void
  onCreateWorkspace?: (workspaceId: string) => void
}

export function WorkspaceTemplates({ onClose, onCreateWorkspace }: WorkspaceTemplatesProps) {
  const navigate = useNavigate()
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCreateFromTemplate, setShowCreateFromTemplate] = useState(false)

  // Form states
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [templateCategory, setTemplateCategory] = useState('general')
  const [templateIsPublic, setTemplateIsPublic] = useState(false)
  const [sourceWorkspace, setSourceWorkspace] = useState<string | null>(null)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [t, w, p, userResp] = await Promise.all([
      supabase.from('workspace_templates').select('*').order('usage_count', { ascending: false }),
      supabase
        .from('workspaces')
        .select('id, name, description')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name'),
      supabase.auth.getUser(),
    ])

    const firstErr = t.error ?? w.error ?? p.error
    if (firstErr) reportException(firstErr, 'Chargement des modèles')

    setTemplates((t.data ?? []) as Template[])
    setWorkspaces((w.data ?? []) as Workspace[])
    setProfiles((p.data ?? []) as Profile[])
    setCurrentUserId(userResp.data.user?.id ?? null)
  }, [reportException])

  useEffect(() => {
    void load()
  }, [load])

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>()
    for (const p of profiles) m.set(p.id, p)
    return m
  }, [profiles])

  const myTemplates = useMemo(() => {
    if (!currentUserId) return []
    return templates.filter((t) => t.created_by === currentUserId)
  }, [templates, currentUserId])

  const publicTemplates = useMemo(() => {
    return templates.filter((t) => t.is_public)
  }, [templates])

  const createTemplate = async () => {
    if (!templateName.trim() || !sourceWorkspace) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('create_template_from_workspace', {
      p_workspace_id: sourceWorkspace,
      p_name: templateName.trim(),
      p_description: templateDesc.trim(),
      p_category: templateCategory,
      p_is_public: templateIsPublic,
    })

    if (error) reportException(error, 'Création du modèle')
    else {
      setTemplateName('')
      setTemplateDesc('')
      setTemplateCategory('general')
      setTemplateIsPublic(false)
      setSourceWorkspace(null)
      setShowCreateForm(false)
      await load()
      showToast('Modèle créé avec succès')
    }
  }

  const createWorkspaceFromTemplate = async () => {
    if (!selectedTemplate || !newWorkspaceName.trim()) return

    const { data, error } = await supabase.rpc('create_workspace_from_template', {
      p_template_id: selectedTemplate,
      p_name: newWorkspaceName.trim(),
      p_description: newWorkspaceDesc.trim(),
    })

    if (error) reportException(error, 'Création du dossier')
    else {
      setShowCreateFromTemplate(false)
      setNewWorkspaceName('')
      setNewWorkspaceDesc('')
      setSelectedTemplate(null)
      showToast('Dossier créé avec succès')
      if (onCreateWorkspace && data) {
        onCreateWorkspace(data as string)
      } else {
        navigate(`/w/${data}`)
      }
    }
  }

  return (
    <div className="stack workspace-templates">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Modèles de dossiers</h2>
        {onClose && (
          <IconActionButton variant="secondary" label="Fermer" onClick={onClose}>
            <IconX />
          </IconActionButton>
        )}
      </div>

      <p className="muted" style={{ margin: 0 }}>
        Créez des modèles à partir de vos dossiers existants pour gagner du temps sur vos futurs
        projets.
      </p>

      <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={() => setShowCreateForm(true)}>
          <IconPlus /> Créer un modèle
        </button>
        <button type="button" className="secondary" onClick={() => setShowCreateFromTemplate(true)}>
          <IconDuplicate /> Nouveau dossier à partir d'un modèle
        </button>
      </div>

      {showCreateForm && (
        <div className="card stack" style={{ boxShadow: 'none', padding: '1rem' }}>
          <h4 style={{ margin: 0 }}>Créer un modèle</h4>
          <div>
            <label>Nom du modèle</label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="ex. SUV familial électrique"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label>Description (optionnel)</label>
            <textarea
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              placeholder="Ce modèle inclut les critères typiques pour..."
              rows={2}
              maxLength={2000}
            />
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label>Catégorie</label>
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label>Dossier source</label>
              <select
                value={sourceWorkspace ?? ''}
                onChange={(e) => setSourceWorkspace(e.target.value || null)}
                required
              >
                <option value="">Sélectionner...</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={templateIsPublic}
              onChange={(e) => setTemplateIsPublic(e.target.checked)}
            />
            Rendre ce modèle public (visible par tous les utilisateurs)
          </label>
          <div className="row icon-action-toolbar">
            <button
              type="button"
              disabled={!templateName.trim() || !sourceWorkspace}
              onClick={() => void createTemplate()}
            >
              Créer le modèle
            </button>
            <IconActionButton
              variant="secondary"
              label="Annuler"
              onClick={() => setShowCreateForm(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </div>
      )}

      {showCreateFromTemplate && (
        <div className="card stack" style={{ boxShadow: 'none', padding: '1rem' }}>
          <h4 style={{ margin: 0 }}>Nouveau dossier à partir d'un modèle</h4>
          <div>
            <label>Nom du dossier</label>
            <input
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="ex. Projet véhicule familial"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label>Description (optionnel)</label>
            <textarea
              value={newWorkspaceDesc}
              onChange={(e) => setNewWorkspaceDesc(e.target.value)}
              placeholder="Description de votre projet..."
              rows={2}
              maxLength={2000}
            />
          </div>
          <div>
            <label>Modèle à utiliser</label>
            <select
              value={selectedTemplate ?? ''}
              onChange={(e) => setSelectedTemplate(e.target.value || null)}
              required
            >
              <option value="">Sélectionner...</option>
              <optgroup label="Mes modèles">
                {myTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_public && '(public)'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Modèles publics">
                {publicTemplates
                  .filter((t) => !myTemplates.some((mt) => mt.id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
          <div className="row icon-action-toolbar">
            <button
              type="button"
              disabled={!newWorkspaceName.trim() || !selectedTemplate}
              onClick={() => void createWorkspaceFromTemplate()}
            >
              Créer le dossier
            </button>
            <IconActionButton
              variant="secondary"
              label="Annuler"
              onClick={() => setShowCreateFromTemplate(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </div>
      )}

      <div className="stack">
        <h3 style={{ margin: 0 }}>Mes modèles</h3>
        {myTemplates.length === 0 ? (
          <EmptyState
            icon="requirements"
            title="Aucun modèle personnel"
            text="Créez votre premier modèle à partir d'un dossier existant."
          />
        ) : (
          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            {myTemplates.map((t) => {
              const createdBy = profileById.get(t.created_by)
              return (
                <div
                  key={t.id}
                  className="card"
                  style={{ boxShadow: 'none', flex: '1 1 300px', maxWidth: '400px' }}
                >
                  <div className="stack" style={{ gap: '0.5rem' }}>
                    <div
                      className="row"
                      style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
                    >
                      <strong>{t.name}</strong>
                      <span className="badge">Utilisé {t.usage_count}x</span>
                    </div>
                    {t.description && (
                      <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                        {t.description}
                      </p>
                    )}
                    <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        Par {createdBy?.display_name || 'Vous'}
                      </span>
                      {t.is_public && <span className="badge success">Public</span>}
                      <span className="badge">
                        {CATEGORIES.find((c) => c.value === t.category)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="stack">
        <h3 style={{ margin: 0 }}>Modèles publics</h3>
        {publicTemplates.length === 0 ? (
          <p className="muted">Aucun modèle public disponible.</p>
        ) : (
          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            {publicTemplates
              .filter((t) => !myTemplates.some((mt) => mt.id === t.id))
              .map((t) => {
                const createdBy = profileById.get(t.created_by)
                return (
                  <div
                    key={t.id}
                    className="card"
                    style={{ boxShadow: 'none', flex: '1 1 300px', maxWidth: '400px' }}
                  >
                    <div className="stack" style={{ gap: '0.5rem' }}>
                      <div
                        className="row"
                        style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
                      >
                        <strong>{t.name}</strong>
                        <span className="badge">Utilisé {t.usage_count}x</span>
                      </div>
                      {t.description && (
                        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                          {t.description}
                        </p>
                      )}
                      <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          Par {createdBy?.display_name || 'Inconnu'}
                        </span>
                        <span className="badge">
                          {CATEGORIES.find((c) => c.value === t.category)?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
