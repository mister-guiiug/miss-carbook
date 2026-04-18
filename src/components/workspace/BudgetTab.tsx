import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { formatPriceEur } from '../../lib/formatPrice'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import type { CandidateStatus } from '../../types/database'
import { EmptyState } from '../ui/EmptyState'
import {
  IconActionButton,
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
  IconCalculator,
} from '../ui/IconActionButton'

type Cand = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
  status: CandidateStatus
  price: number | null
}

type BudgetCategory = {
  id: string
  workspace_id: string
  name: string
  description: string
  color: string
  sort_order: number
}

type BudgetItem = {
  id: string
  workspace_id: string
  category_id: string | null
  candidate_id: string | null
  name: string
  amount: number
  frequency: 'one_time' | 'monthly' | 'annual' | 'per_km'
  is_recurring: boolean
  is_planned: boolean
  notes: string
  sort_order: number
}

type TCOParams = {
  id: string
  workspace_id: string
  candidate_id: string | null
  annual_km: number
  ownership_years: number
  insurance_cost: number | null
  fuel_price: number | null
  electricity_price: number | null
  residual_value_percent: number | null
  loan_interest_rate: number | null
  loan_months: number | null
}

type TCOResult = {
  candidate_id: string
  total_tco: number
  breakdown: {
    purchase_price: number
    one_time_costs: number
    annual_costs: number
    per_km_costs: number
    fuel_cost: number
    insurance_cost: number
    depreciation: number
    financing_cost: number
  }
  parameters: {
    annual_km: number
    ownership_years: number
    total_km: number
  }
}

const FREQUENCY_LABELS = {
  one_time: 'Unique',
  monthly: 'Mensuel',
  annual: 'Annuel',
  per_km: 'Par km',
}

const CATEGORY_COLORS = {
  default: 'var(--badge-bg)',
  primary: 'var(--primary-light)',
  secondary: 'var(--secondary-light)',
  success: 'var(--success-light)',
  warning: 'var(--warning-light)',
  danger: 'var(--danger-light)',
  info: 'var(--info-light)',
}

export function BudgetTab({
  workspaceId,
  canWrite,
}: {
  workspaceId: string
  canWrite: boolean
}) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [candidates, setCandidates] = useState<Cand[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])
  const [tcoParams, setTcoParams] = useState<TCOParams[]>([])
  const [tcoResults, setTcoResults] = useState<Record<string, TCOResult>>({})
  const [view, setView] = useState<'items' | 'tco'>('items')

  // Form states
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemAmount, setItemAmount] = useState('')
  const [itemFrequency, setItemFrequency] = useState<'one_time' | 'monthly' | 'annual' | 'per_km'>('one_time')
  const [itemCategory, setItemCategory] = useState<string | null>(null)
  const [itemCandidate, setItemCandidate] = useState<string | null>(null)
  const [itemNotes, setItemNotes] = useState('')

  // TCO form states
  const [editingTcoCandidate, setEditingTcoCandidate] = useState<string | null>(null)
  const [tcoAnnualKm, setTcoAnnualKm] = useState('15000')
  const [tcoOwnershipYears, setTcoOwnershipYears] = useState('5')
  const [tcoInsuranceCost, setTcoInsuranceCost] = useState('')
  const [tcoFuelPrice, setTcoFuelPrice] = useState('')
  const [tcoResidualValue, setTcoResidualValue] = useState('')
  const [tcoLoanRate, setTcoLoanRate] = useState('')
  const [tcoLoanMonths, setTcoLoanMonths] = useState('')

  const load = useCallback(async () => {
    const [c, cat, i, t] = await Promise.all([
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id, status, price')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true }),
      supabase
        .from('budget_categories')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('budget_items')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('tco_parameters')
        .select('*'),
    ])

    const firstErr = c.error ?? cat.error ?? i.error ?? t.error
    if (firstErr) reportException(firstErr, 'Chargement du budget')

    const candidatesData = (c.data ?? []) as Cand[]
    setCandidates(candidatesData)
    setCategories((cat.data ?? []) as BudgetCategory[])
    setItems((i.data ?? []) as BudgetItem[])
    setTcoParams((t.data ?? []) as TCOParams[])

    // Calculate TCO for each candidate
    for (const cand of candidatesData) {
      try {
        const { data } = await supabase.rpc('calculate_candidate_tco', {
          p_candidate_id: cand.id,
        })
        if (data) {
          setTcoResults((prev) => ({ ...prev, [cand.id]: data as TCOResult }))
        }
      } catch (e) {
        console.error('TCO calc error', e)
      }
    }
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  const categoryById = useMemo(() => {
    const m = new Map<string, BudgetCategory>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const candidateById = useMemo(() => {
    const m = new Map<string, Cand>()
    for (const c of candidates) m.set(c.id, c)
    return m
  }, [candidates])

  const globalItems = useMemo(() => {
    return items.filter((i) => !i.candidate_id)
  }, [items])

  const candidateItems = useMemo(() => {
    const m = new Map<string, BudgetItem[]>()
    for (const item of items) {
      if (!item.candidate_id) continue
      if (!m.has(item.candidate_id)) m.set(item.candidate_id, [])
      m.get(item.candidate_id)!.push(item)
    }
    return m
  }, [items])

  const saveItem = async () => {
    if (!canWrite || !itemName.trim() || !itemAmount) return
    const amount = parseFloat(itemAmount)
    if (Number.isNaN(amount) || amount < 0) return

    const { error } = await supabase.from('budget_items').upsert({
      id: editItemId ?? undefined,
      workspace_id: workspaceId,
      category_id: itemCategory,
      candidate_id: itemCandidate,
      name: itemName.trim(),
      amount,
      frequency: itemFrequency,
      is_recurring: itemFrequency !== 'one_time',
      is_planned: false,
      notes: itemNotes.trim(),
      sort_order: editItemId ? undefined : items.length,
    })

    if (error) reportException(error, 'Enregistrement de l\'élément')
    else {
      setItemName('')
      setItemAmount('')
      setItemFrequency('one_time')
      setItemCategory(null)
      setItemCandidate(null)
      setItemNotes('')
      setEditItemId(null)
      setShowAddItem(false)
      await load()
      showToast('Élément enregistré')
    }
  }

  const deleteItem = async (id: string) => {
    if (!canWrite) return
    const { error } = await supabase.from('budget_items').delete().eq('id', id)
    if (error) reportException(error, 'Suppression de l\'élément')
    else {
      await load()
      showToast('Élément supprimé')
    }
  }

  const editItem = (item: BudgetItem) => {
    setEditItemId(item.id)
    setItemName(item.name)
    setItemAmount(String(item.amount))
    setItemFrequency(item.frequency)
    setItemCategory(item.category_id)
    setItemCandidate(item.candidate_id)
    setItemNotes(item.notes)
    setShowAddItem(true)
  }

  const saveTcoParams = async (candidateId: string) => {
    if (!canWrite) return
    const existing = tcoParams.find((t) => t.candidate_id === candidateId)
    const { error } = await supabase
      .from('tco_parameters')
      .upsert({
        id: existing?.id,
        workspace_id: workspaceId,
        candidate_id: candidateId,
        annual_km: parseInt(tcoAnnualKm) || 15000,
        ownership_years: parseInt(tcoOwnershipYears) || 5,
        insurance_cost: tcoInsuranceCost ? parseFloat(tcoInsuranceCost) || null : null,
        fuel_price: tcoFuelPrice ? parseFloat(tcoFuelPrice) || null : null,
        electricity_price: null,
        residual_value_percent: tcoResidualValue ? parseFloat(tcoResidualValue) || null : null,
        loan_interest_rate: tcoLoanRate ? parseFloat(tcoLoanRate) || null : null,
        loan_months: tcoLoanMonths ? parseInt(tcoLoanMonths) || null : null,
      })

    if (error) reportException(error, 'Enregistrement des paramètres TCO')
    else {
      await load()
      showToast('Paramètres TCO enregistrés')
      setEditingTcoCandidate(null)
    }
  }

  const resetTcoForm = (candidateId: string) => {
    const existing = tcoParams.find((t) => t.candidate_id === candidateId)
    setTcoAnnualKm(String(existing?.annual_km ?? 15000))
    setTcoOwnershipYears(String(existing?.ownership_years ?? 5))
    setTcoInsuranceCost(existing?.insurance_cost ? String(existing.insurance_cost) : '')
    setTcoFuelPrice(existing?.fuel_price ? String(existing.fuel_price) : '')
    setTcoResidualValue(existing?.residual_value_percent ? String(existing.residual_value_percent) : '')
    setTcoLoanRate(existing?.loan_interest_rate ? String(existing.loan_interest_rate) : '')
    setTcoLoanMonths(existing?.loan_months ? String(existing.loan_months) : '')
  }

  useEffect(() => {
    if (editingTcoCandidate) {
      resetTcoForm(editingTcoCandidate)
    }
  }, [editingTcoCandidate, tcoParams])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (candidates.length === 0 && categories.length === 0) {
    return (
      <EmptyState
        icon="requirements"
        title="Budget et TCO non disponibles"
        text="Ajoutez des candidats (onglet Modèles) pour commencer à suivre votre budget et calculer les coûts totaux."
      />
    )
  }

  return (
    <div className="stack budget-tab">
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'items'}
            className={view === 'items' ? 'active' : ''}
            onClick={() => setView('items')}
          >
            Éléments de budget
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'tco'}
            className={view === 'tco' ? 'active' : ''}
            onClick={() => setView('tco')}
          >
            Calculateur TCO
          </button>
        </div>
      </div>

      {view === 'items' ? (
        <div className="stack">
          <div className="card stack" style={{ boxShadow: 'none' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Budget</h3>
              {canWrite && (
                <IconActionButton
                  variant="secondary"
                  label={showAddItem ? 'Fermer le formulaire' : 'Ajouter un élément'}
                  onClick={() => {
                    if (!showAddItem) {
                      setEditItemId(null)
                      setItemName('')
                      setItemAmount('')
                      setItemFrequency('one_time')
                      setItemCategory(null)
                      setItemCandidate(null)
                      setItemNotes('')
                    }
                    setShowAddItem(!showAddItem)
                  }}
                >
                  {showAddItem ? <IconX /> : <IconPlus />}
                </IconActionButton>
              )}
            </div>

            {showAddItem && canWrite && (
              <form onSubmit={(e) => { e.preventDefault(); void saveItem() }} className="card stack" style={{ boxShadow: 'none', padding: '1rem' }}>
                <h4 style={{ margin: 0 }}>{editItemId ? 'Modifier' : 'Nouvel'} élément</h4>
                <div>
                  <label>Nom</label>
                  <input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="ex. Assurance annuelle"
                    required
                    maxLength={200}
                  />
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 150px' }}>
                    <label>Montant (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemAmount}
                      onChange={(e) => setItemAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label>Fréquence</label>
                    <select
                      value={itemFrequency}
                      onChange={(e) => setItemFrequency(e.target.value as any)}
                    >
                      {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label>Catégorie (optionnel)</label>
                    <select
                      value={itemCategory ?? ''}
                      onChange={(e) => setItemCategory(e.target.value || null)}
                    >
                      <option value="">Sans catégorie</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label>Lié à un modèle (optionnel)</label>
                    <select
                      value={itemCandidate ?? ''}
                      onChange={(e) => setItemCandidate(e.target.value || null)}
                    >
                      <option value="">Tous les modèles</option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCandidateListLabel(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label>Notes (optionnel)</label>
                  <textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    rows={2}
                    maxLength={2000}
                  />
                </div>
                <div className="row icon-action-toolbar">
                  <button type="submit">{editItemId ? 'Modifier' : 'Ajouter'}</button>
                  <IconActionButton
                    variant="secondary"
                    label="Annuler"
                    onClick={() => {
                      setShowAddItem(false)
                      setEditItemId(null)
                    }}
                  >
                    <IconX />
                  </IconActionButton>
                </div>
              </form>
            )}
          </div>

          <div className="stack">
            <h4 style={{ margin: 0 }}>Éléments globaux</h4>
            {globalItems.length === 0 ? (
              <p className="muted">Aucun élément global.</p>
            ) : (
              <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {globalItems.map((item) => {
                  const cat = item.category_id ? categoryById.get(item.category_id) : null
                  return (
                    <li key={item.id} className="card" style={{ boxShadow: 'none' }}>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                          {cat && (
                            <span
                              className="badge"
                              style={{ background: CATEGORY_COLORS[cat.color as keyof typeof CATEGORY_COLORS] }}
                            >
                              {cat.name}
                            </span>
                          )}
                          <strong>{item.name}</strong>
                          <span className="muted" style={{ fontSize: '0.9rem' }}>
                            {formatCurrency(item.amount)} {FREQUENCY_LABELS[item.frequency]}
                          </span>
                          {item.notes && (
                            <span className="muted" style={{ fontSize: '0.85rem' }}>
                              - {item.notes}
                            </span>
                          )}
                        </div>
                        {canWrite && (
                          <div className="row icon-action-toolbar">
                            <IconActionButton
                              variant="primary"
                              label="Modifier"
                              onClick={() => editItem(item)}
                            >
                              <IconPencil />
                            </IconActionButton>
                            <IconActionButton
                              variant="danger"
                              label="Supprimer"
                              onClick={() => void deleteItem(item.id)}
                            >
                              <IconTrash />
                            </IconActionButton>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {candidates.map((cand) => {
            const candItems = candidateItems.get(cand.id) ?? []
            if (candItems.length === 0) return null
            return (
              <div key={cand.id} className="stack">
                <h4 style={{ margin: 0 }}>{formatCandidateListLabel(cand)}</h4>
                <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {candItems.map((item) => {
                    const cat = item.category_id ? categoryById.get(item.category_id) : null
                    return (
                      <li key={item.id} className="card" style={{ boxShadow: 'none' }}>
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                            {cat && (
                              <span
                                className="badge"
                                style={{ background: CATEGORY_COLORS[cat.color as keyof typeof CATEGORY_COLORS] }}
                              >
                                {cat.name}
                              </span>
                            )}
                            <strong>{item.name}</strong>
                            <span className="muted" style={{ fontSize: '0.9rem' }}>
                              {formatCurrency(item.amount)} {FREQUENCY_LABELS[item.frequency]}
                            </span>
                          </div>
                          {canWrite && (
                            <div className="row icon-action-toolbar">
                              <IconActionButton
                                variant="primary"
                                label="Modifier"
                                onClick={() => editItem(item)}
                              >
                                <IconPencil />
                              </IconActionButton>
                              <IconActionButton
                                variant="danger"
                                label="Supprimer"
                                onClick={() => void deleteItem(item.id)}
                              >
                                <IconTrash />
                              </IconActionButton>
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="stack">
          <div className="card stack" style={{ boxShadow: 'none' }}>
            <h3 style={{ margin: 0 }}>Coût Total de Possession (TCO)</h3>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              Comparez les coûts totaux sur la durée de possession pour chaque modèle.
            </p>
          </div>

          {candidates.length === 0 ? (
            <EmptyState
              icon="requirements"
              title="Aucun modèle"
              text="Ajoutez des modèles pour calculer leur TCO."
            />
          ) : (
            <div className="stack">
              {candidates.map((cand) => {
                const tco = tcoResults[cand.id]
                const editing = editingTcoCandidate === cand.id

                return (
                  <div key={cand.id} className="card stack" style={{ boxShadow: 'none' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{formatCandidateListLabel(cand)}</h4>
                        {cand.price != null && (
                          <span className="muted" style={{ fontSize: '0.9rem' }}>
                            Prix d'achat : {formatPriceEur(cand.price)}
                          </span>
                        )}
                      </div>
                      <div className="row icon-action-toolbar">
                        {tco && (
                          <div className="stack" style={{ alignItems: 'flex-end' }}>
                            <span className="muted" style={{ fontSize: '0.85rem' }}>TCO total</span>
                            <span className="badge primary" style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
                              {formatCurrency(tco.total_tco)}
                            </span>
                            <span className="muted" style={{ fontSize: '0.8rem' }}>
                              sur {tco.parameters.ownership_years} ans / {tco.parameters.total_km.toLocaleString('fr-FR')} km
                            </span>
                          </div>
                        )}
                        <IconActionButton
                          variant="secondary"
                          label={editing ? 'Fermer' : 'Paramètres'}
                          onClick={() => setEditingTcoCandidate(editing ? null : cand.id)}
                        >
                          {editing ? <IconX /> : <IconCalculator />}
                        </IconActionButton>
                      </div>
                    </div>

                    {editing && canWrite && (
                      <div className="card stack" style={{ boxShadow: 'none', padding: '1rem', background: 'var(--bg-secondary)' }}>
                        <h5 style={{ margin: 0 }}>Paramètres TCO</h5>
                        <div className="row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                          <div style={{ flex: '1 1 150px' }}>
                            <label>Km annuel</label>
                            <input
                              type="number"
                              min="0"
                              max="100000"
                              value={tcoAnnualKm}
                              onChange={(e) => setTcoAnnualKm(e.target.value)}
                            />
                          </div>
                          <div style={{ flex: '1 1 150px' }}>
                            <label>Durée (années)</label>
                            <input
                              type="number"
                              min="1"
                              max="15"
                              value={tcoOwnershipYears}
                              onChange={(e) => setTcoOwnershipYears(e.target.value)}
                            />
                          </div>
                          <div style={{ flex: '1 1 150px' }}>
                            <label>Assurance (€/an)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tcoInsuranceCost}
                              onChange={(e) => setTcoInsuranceCost(e.target.value)}
                              placeholder="Optionnel"
                            />
                          </div>
                          <div style={{ flex: '1 1 150px' }}>
                            <label>Prix carburant (€/L)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={tcoFuelPrice}
                              onChange={(e) => setTcoFuelPrice(e.target.value)}
                              placeholder="Optionnel"
                            />
                          </div>
                          <div style={{ flex: '1 1 150px' }}>
                            <label>Valeur résiduelle (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={tcoResidualValue}
                              onChange={(e) => setTcoResidualValue(e.target.value)}
                              placeholder="Optionnel"
                            />
                          </div>
                          <div style={{ flex: '1 1 150px' }}>
                            <label>Taux crédit (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.01"
                              value={tcoLoanRate}
                              onChange={(e) => setTcoLoanRate(e.target.value)}
                              placeholder="Optionnel"
                            />
                          </div>
                        </div>
                        <div className="row icon-action-toolbar">
                          <button type="button" onClick={() => void saveTcoParams(cand.id)}>
                            Calculer le TCO
                          </button>
                          <IconActionButton
                            variant="secondary"
                            label="Annuler"
                            onClick={() => setEditingTcoCandidate(null)}
                          >
                            <IconX />
                          </IconActionButton>
                        </div>
                      </div>
                    )}

                    {tco && (
                      <div className="stack" style={{ marginTop: '1rem' }}>
                        <h5 style={{ margin: 0 }}>Détail du TCO</h5>
                        <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Prix d'achat</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.purchase_price)}
                            </div>
                          </div>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Coûts uniques</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.one_time_costs)}
                            </div>
                          </div>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Coûts annuels</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.annual_costs)}
                            </div>
                            <div className="muted" style={{ fontSize: '0.8rem' }}>
                              soit {formatCurrency(tco.breakdown.annual_costs / tco.parameters.ownership_years)} / an
                            </div>
                          </div>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Carburant</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.fuel_cost)}
                            </div>
                            <div className="muted" style={{ fontSize: '0.8rem' }}>
                              soit {formatCurrency(tco.breakdown.fuel_cost / tco.parameters.total_km)} / km
                            </div>
                          </div>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Assurance</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.insurance_cost)}
                            </div>
                          </div>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Dépréciation</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.depreciation)}
                            </div>
                          </div>
                          <div className="card" style={{ boxShadow: 'none', padding: '0.75rem', flex: '1 1 200px' }}>
                            <div className="muted" style={{ fontSize: '0.85rem' }}>Coût financement</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                              {formatCurrency(tco.breakdown.financing_cost)}
                            </div>
                          </div>
                        </div>

                        <div className="card" style={{ boxShadow: 'none', padding: '1rem', marginTop: '0.5rem' }}>
                          <h5 style={{ margin: '0 0 0.5rem 0' }}>Répartition visuelle</h5>
                          <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                            {Object.entries(tco.breakdown).map(([key, value]) => {
                              if (value === 0) return null
                              const percent = (value / tco.total_tco) * 100
                              const colors: Record<string, string> = {
                                purchase_price: '#3b82f6',
                                one_time_costs: '#8b5cf6',
                                annual_costs: '#10b981',
                                per_km_costs: '#f59e0b',
                                fuel_cost: '#ef4444',
                                insurance_cost: '#06b6d4',
                                depreciation: '#6366f1',
                                financing_cost: '#ec4899',
                              }
                              return (
                                <div
                                  key={key}
                                  style={{
                                    width: `${percent}%`,
                                    background: colors[key],
                                    position: 'relative',
                                  }}
                                  title={`${key}: ${formatCurrency(value)} (${percent.toFixed(1)}%)`}
                                />
                              )
                            })}
                          </div>
                          <div className="row" style={{ flexWrap: 'wrap', gap: '1rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                            {Object.entries(tco.breakdown).map(([key, value]) => {
                              if (value === 0) return null
                              const colors: Record<string, string> = {
                                purchase_price: '#3b82f6',
                                one_time_costs: '#8b5cf6',
                                annual_costs: '#10b981',
                                per_km_costs: '#f59e0b',
                                fuel_cost: '#ef4444',
                                insurance_cost: '#06b6d4',
                                depreciation: '#6366f1',
                                financing_cost: '#ec4899',
                              }
                              return (
                                <div key={key} className="row" style={{ alignItems: 'center', gap: '0.35rem' }}>
                                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: colors[key] }} />
                                  <span className="muted">{key.replace(/_/g, ' ')}:</span>
                                  <span>{formatCurrency(value)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
