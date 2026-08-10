import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../ui/EmptyState';
import {
  IconActionButton,
  IconCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconX,
} from '../ui/IconActionButton';
import { useI18n } from '../../i18n';

type ChecklistTemplate = {
  id: string;
  name: string;
  description: string;
  created_by: string;
};

type ChecklistItem = {
  id: string;
  template_id: string;
  label: string;
  category: string;
  sort_order: number;
};

type ChecklistCompletion = {
  id: string;
  visit_id: string;
  template_id: string;
  completed_by: string;
  completed_at: string;
  notes: string;
};

type ItemResponse = {
  id: string;
  completion_id: string;
  item_id: string;
  status: 'pending' | 'pass' | 'fail' | 'na';
  notes: string;
};

const CATEGORIES = [
  { value: 'general', label: 'Général', color: 'muted' },
  { value: 'exterior', label: 'Extérieur', color: 'info' },
  { value: 'interior', label: 'Intérieur', color: 'warning' },
  { value: 'driving', label: 'Conduite', color: 'primary' },
  { value: 'comfort', label: 'Confort', color: 'success' },
  { value: 'technology', label: 'Technologie', color: 'premium' },
  { value: 'safety', label: 'Sécurité', color: 'danger' },
  { value: 'performance', label: 'Performances', color: 'accent' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'muted',
  pass: 'success',
  fail: 'danger',
  na: 'muted',
};

interface TrialChecklistProps {
  workspaceId: string;
  visitId: string;
  canWrite: boolean;
  userId: string;
  onClose?: () => void;
}

export function TrialChecklist({
  workspaceId,
  visitId,
  canWrite,
  userId,
  onClose,
}: TrialChecklistProps) {
  const { reportException } = useErrorDialog();
  const { showToast } = useToast();
  const { t: tr } = useI18n();
  const categoryLabels: Record<string, string> = {
    general: tr('checklist.categories.general'),
    exterior: tr('checklist.categories.exterior'),
    interior: tr('checklist.categories.interior'),
    driving: tr('checklist.categories.driving'),
    comfort: tr('checklist.categories.comfort'),
    technology: tr('checklist.categories.technology'),
    safety: tr('checklist.categories.safety'),
    performance: tr('checklist.categories.performance'),
  };
  const statusLabels: Record<string, string> = {
    pending: tr('checklist.status.pending'),
    pass: tr('checklist.status.pass'),
    fail: tr('checklist.status.fail'),
    na: tr('checklist.status.na'),
  };
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [completions, setCompletions] = useState<ChecklistCompletion[]>([]);
  const [responses, setResponses] = useState<ItemResponse[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('general');
  const [completionNotes, setCompletionNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = useCallback(async () => {
    const [t, i, c, r] = await Promise.all([
      getSupabase()
        .from('trial_checklist_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      getSupabase()
        .from('trial_checklist_items')
        .select('*')
        .order('sort_order', { ascending: true }),
      getSupabase()
        .from('trial_checklist_completions')
        .select('*')
        .eq('visit_id', visitId),
      getSupabase().from('trial_checklist_item_responses').select('*'),
    ]);

    const firstErr = t.error ?? i.error ?? c.error ?? r.error;
    if (firstErr) reportException(firstErr, tr('checklist.ctxLoad'));

    setTemplates((t.data ?? []) as ChecklistTemplate[]);
    setItems((i.data ?? []) as ChecklistItem[]);
    setCompletions((c.data ?? []) as ChecklistCompletion[]);
    setResponses((r.data ?? []) as ItemResponse[]);

    // Auto-select first template if available and no completion yet
    if ((t.data ?? []).length > 0 && (c.data ?? []).length === 0) {
      setSelectedTemplate((t.data ?? [])[0].id);
    } else if ((c.data ?? []).length > 0) {
      setSelectedTemplate((c.data ?? [])[0].template_id);
      setCompletionNotes((c.data ?? [])[0].notes ?? '');
    }
  }, [workspaceId, visitId, reportException, tr]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateItems = useMemo(() => {
    if (!selectedTemplate) return [];
    return items.filter(i => i.template_id === selectedTemplate);
  }, [items, selectedTemplate]);

  const myCompletion = useMemo(() => {
    return completions.find(
      c => c.completed_by === userId && c.template_id === selectedTemplate
    );
  }, [completions, userId, selectedTemplate]);

  const myResponses = useMemo(() => {
    if (!myCompletion) return new Map<string, ItemResponse>();
    const map = new Map<string, ItemResponse>();
    for (const r of responses.filter(
      r => r.completion_id === myCompletion.id
    )) {
      map.set(r.item_id, r);
    }
    return map;
  }, [responses, myCompletion]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return templateItems;
    return templateItems.filter(i => i.category === categoryFilter);
  }, [templateItems, categoryFilter]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    for (const item of filteredItems) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }, [filteredItems]);

  const createTemplate = async () => {
    if (!canWrite || !newTemplateName.trim()) return;
    const { error } = await getSupabase()
      .from('trial_checklist_templates')
      .insert({
        workspace_id: workspaceId,
        name: newTemplateName.trim(),
        description: newTemplateDesc.trim(),
        created_by: userId,
      })
      .select('id')
      .single();
    if (error) reportException(error, tr('checklist.ctxCreateTemplate'));
    else {
      setNewTemplateName('');
      setNewTemplateDesc('');
      await load();
      showToast(tr('checklist.toastTemplateCreated'));
    }
  };

  const addItem = async () => {
    if (!canWrite || !selectedTemplate || !newItemLabel.trim()) return;
    const { error } = await getSupabase().from('trial_checklist_items').insert({
      template_id: selectedTemplate,
      label: newItemLabel.trim(),
      category: newItemCategory,
      sort_order: templateItems.length,
    });
    if (error) reportException(error, tr('checklist.ctxAddItem'));
    else {
      setNewItemLabel('');
      await load();
      showToast(tr('checklist.toastItemAdded'));
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!canWrite) return;
    const { error } = await getSupabase()
      .from('trial_checklist_items')
      .delete()
      .eq('id', itemId);
    if (error) reportException(error, tr('checklist.ctxDeleteItem'));
    else await load();
  };

  const startCompletion = async () => {
    if (!canWrite || !selectedTemplate || myCompletion) return;
    const { error } = await getSupabase()
      .from('trial_checklist_completions')
      .insert({
        visit_id: visitId,
        template_id: selectedTemplate,
        completed_by: userId,
      })
      .select('id')
      .single();
    if (error) reportException(error, tr('checklist.ctxStartCompletion'));
    else await load();
  };

  const setItemStatus = async (itemId: string, status: string) => {
    if (!canWrite || !myCompletion) return;
    const existing = myResponses.get(itemId);
    if (existing) {
      const { error } = await getSupabase()
        .from('trial_checklist_item_responses')
        .update({ status })
        .eq('id', existing.id);
      if (error) reportException(error, tr('checklist.ctxUpdateStatus'));
      else await load();
    } else {
      const { error } = await getSupabase()
        .from('trial_checklist_item_responses')
        .insert({
          completion_id: myCompletion.id,
          item_id: itemId,
          status,
        });
      if (error) reportException(error, tr('checklist.ctxSaveStatus'));
      else await load();
    }
  };

  const setItemNotes = async (itemId: string, notes: string) => {
    if (!canWrite || !myCompletion) return;
    const existing = myResponses.get(itemId);
    if (existing) {
      const { error } = await getSupabase()
        .from('trial_checklist_item_responses')
        .update({ notes: notes.slice(0, 1000) })
        .eq('id', existing.id);
      if (error) reportException(error, tr('checklist.ctxUpdateNotes'));
    }
  };

  const saveCompletionNotes = async () => {
    if (!canWrite || !myCompletion) return;
    const { error } = await getSupabase()
      .from('trial_checklist_completions')
      .update({ notes: completionNotes.slice(0, 5000) })
      .eq('id', myCompletion.id);
    if (error) reportException(error, tr('checklist.ctxUpdateNotes'));
    else {
      showToast(tr('checklist.toastNotesSaved'));
      await load();
    }
  };

  const completionProgress = useMemo(() => {
    if (!myCompletion || templateItems.length === 0) return 0;
    const responded = templateItems.filter(i => myResponses.has(i.id)).length;
    return (responded / templateItems.length) * 100;
  }, [myCompletion, templateItems, myResponses]);

  if (templates.length === 0 && !showTemplateEditor) {
    return (
      <div className="stack trial-checklist">
        <EmptyState
          icon="requirements"
          title={tr('checklist.emptyNoTemplateTitle')}
          text={tr('checklist.emptyNoTemplateText')}
          action={
            canWrite ? (
              <IconActionButton
                variant="primary"
                label={tr('checklist.createTemplateBtn')}
                onClick={() => setShowTemplateEditor(true)}
              >
                <IconPlus />
              </IconActionButton>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="stack trial-checklist">
      <div className="card stack" style={{ boxShadow: 'none' }}>
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h3 style={{ margin: 0 }}>{tr('checklist.title')}</h3>
          {canWrite && (
            <div className="row icon-action-toolbar">
              <IconActionButton
                variant="secondary"
                label={
                  showTemplateEditor
                    ? tr('checklist.closeEditor')
                    : tr('checklist.editTemplates')
                }
                onClick={() => setShowTemplateEditor(v => !v)}
              >
                {showTemplateEditor ? <IconX /> : <IconPencil />}
              </IconActionButton>
              {!showTemplateEditor && onClose && (
                <IconActionButton
                  variant="secondary"
                  label={tr('common.close')}
                  onClick={onClose}
                >
                  <IconX />
                </IconActionButton>
              )}
            </div>
          )}
        </div>

        {showTemplateEditor ? (
          <div className="stack" style={{ gap: '1rem' }}>
            <div
              className="card stack"
              style={{ boxShadow: 'none', padding: '1rem' }}
            >
              <h4 style={{ margin: 0 }}>
                {tr('checklist.newTemplateHeading')}
              </h4>
              <div>
                <label>{tr('checklist.templateNameLabel')}</label>
                <input
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder={tr('checklist.templateNamePlaceholder')}
                  maxLength={200}
                />
              </div>
              <div>
                <label>{tr('checklist.descriptionOptional')}</label>
                <textarea
                  value={newTemplateDesc}
                  onChange={e => setNewTemplateDesc(e.target.value)}
                  placeholder={tr('checklist.templateDescPlaceholder')}
                  rows={2}
                  maxLength={2000}
                />
              </div>
              <button
                type="button"
                disabled={!canWrite || !newTemplateName.trim()}
                onClick={() => void createTemplate()}
              >
                {tr('checklist.submitCreateTemplate')}
              </button>
            </div>

            <div
              className="card stack"
              style={{ boxShadow: 'none', padding: '1rem' }}
            >
              <h4 style={{ margin: 0 }}>{tr('checklist.addItemHeading')}</h4>
              <select
                value={selectedTemplate ?? ''}
                onChange={e => setSelectedTemplate(e.target.value || null)}
              >
                <option value="">
                  {tr('checklist.selectTemplatePlaceholder')}
                </option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <input
                  value={newItemLabel}
                  onChange={e => setNewItemLabel(e.target.value)}
                  placeholder={tr('checklist.newItemPlaceholder')}
                  style={{ flex: 1 }}
                  disabled={!selectedTemplate}
                />
                <select
                  value={newItemCategory}
                  onChange={e => setNewItemCategory(e.target.value)}
                  style={{ flex: '0 0 150px' }}
                  disabled={!selectedTemplate}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>
                      {categoryLabels[c.value]}
                    </option>
                  ))}
                </select>
                <IconActionButton
                  variant="primary"
                  label={tr('common.add')}
                  disabled={
                    !canWrite || !selectedTemplate || !newItemLabel.trim()
                  }
                  onClick={() => void addItem()}
                >
                  <IconPlus />
                </IconActionButton>
              </div>
            </div>

            <div className="stack" style={{ gap: '0.5rem' }}>
              <h4 style={{ margin: 0 }}>
                {tr('checklist.existingItemsHeading')}
              </h4>
              {templates.length === 0 ? (
                <p className="muted">{tr('checklist.noTemplateCreated')}</p>
              ) : (
                templates.map(template => (
                  <details
                    key={template.id}
                    className="card"
                    style={{ boxShadow: 'none' }}
                  >
                    <summary style={{ cursor: 'pointer', padding: '0.5rem 0' }}>
                      <strong>{template.name}</strong>
                    </summary>
                    <div
                      className="stack"
                      style={{ marginTop: '1rem', gap: '0.25rem' }}
                    >
                      {items
                        .filter(i => i.template_id === template.id)
                        .map(item => {
                          const cat = CATEGORIES.find(
                            c => c.value === item.category
                          );
                          return (
                            <div
                              key={item.id}
                              className="row"
                              style={{
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.25rem 0.5rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '4px',
                              }}
                            >
                              <span
                                className="muted"
                                style={{ fontSize: '0.85rem' }}
                              >
                                <span
                                  className={`badge ${cat?.color ?? 'muted'}`}
                                  style={{
                                    fontSize: '0.7rem',
                                    marginRight: '0.5rem',
                                  }}
                                >
                                  {categoryLabels[item.category] ??
                                    item.category}
                                </span>
                                {item.label}
                              </span>
                              {canWrite ? (
                                <IconActionButton
                                  variant="danger"
                                  label={tr('common.delete')}
                                  onClick={() => void deleteItem(item.id)}
                                >
                                  <IconTrash />
                                </IconActionButton>
                              ) : null}
                            </div>
                          );
                        })}
                      {items.filter(i => i.template_id === template.id)
                        .length === 0 && (
                        <p className="muted" style={{ fontSize: '0.85rem' }}>
                          {tr('checklist.noItemInTemplate')}
                        </p>
                      )}
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="stack">
            <div
              className="row"
              style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <label>{tr('checklist.checklistTemplateLabel')}</label>
                <select
                  value={selectedTemplate ?? ''}
                  onChange={e => setSelectedTemplate(e.target.value || null)}
                >
                  <option value="">{tr('checklist.selectPlaceholder')}</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTemplate && !myCompletion && canWrite && (
                <button
                  type="button"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() => void startCompletion()}
                >
                  {tr('checklist.startChecklist')}
                </button>
              )}
            </div>

            {selectedTemplate &&
              templates.find(t => t.id === selectedTemplate)?.description && (
                <p
                  className="muted"
                  style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}
                >
                  {templates.find(t => t.id === selectedTemplate)?.description}
                </p>
              )}
          </div>
        )}
      </div>

      {selectedTemplate && !showTemplateEditor && myCompletion && (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <div
            className="row"
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>{tr('checklist.progress')}</h4>
              <div
                className="muted"
                style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
              >
                {tr('checklist.checkedCount', {
                  done: templateItems.filter(i => myResponses.has(i.id)).length,
                  total: templateItems.length,
                })}
              </div>
            </div>
            <div
              className="stack"
              style={{ alignItems: 'flex-end', gap: '0.25rem', width: '150px' }}
            >
              <div
                style={{
                  height: '8px',
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${completionProgress}%`,
                    background: 'var(--primary)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {completionProgress.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                className={`secondary ${categoryFilter === cat.value ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat.value)}
              >
                {categoryLabels[cat.value]}
              </button>
            ))}
            <button
              type="button"
              className={
                categoryFilter === 'all' ? 'secondary active' : 'secondary'
              }
              onClick={() => setCategoryFilter('all')}
            >
              {tr('checklist.allFilter')}
            </button>
          </div>
        </div>
      )}

      {selectedTemplate &&
      !showTemplateEditor &&
      myCompletion &&
      Object.keys(groupedItems).length > 0 ? (
        <div className="stack">
          {Object.entries(groupedItems).map(([category, items]) => {
            const catInfo = CATEGORIES.find(c => c.value === category);
            return (
              <div
                key={category}
                className="card stack"
                style={{ boxShadow: 'none' }}
              >
                <h4 style={{ margin: 0 }}>
                  <span className={`badge ${catInfo?.color ?? 'muted'}`}>
                    {categoryLabels[category] ?? category}
                  </span>
                </h4>
                <div
                  className="stack"
                  style={{ gap: '0.5rem', marginTop: '0.5rem' }}
                >
                  {items.map(item => {
                    const response = myResponses.get(item.id);
                    const status = response?.status ?? 'pending';
                    return (
                      <div
                        key={item.id}
                        className="card"
                        style={{
                          boxShadow: 'none',
                          borderLeft: `4px solid var(--${STATUS_COLORS[status]})`,
                          padding: '0.75rem',
                        }}
                      >
                        <div
                          className="row"
                          style={{
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <strong>{item.label}</strong>
                            <div
                              className="row"
                              style={{ gap: '0.5rem', marginTop: '0.5rem' }}
                            >
                              {(['pending', 'pass', 'fail', 'na'] as const).map(
                                s => (
                                  <button
                                    key={s}
                                    type="button"
                                    className={`status-btn ${status === s ? 'active' : ''}`}
                                    onClick={() =>
                                      void setItemStatus(item.id, s)
                                    }
                                    disabled={!canWrite}
                                    style={{
                                      padding: '0.25rem 0.75rem',
                                      fontSize: '0.85rem',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border)',
                                      background:
                                        status === s
                                          ? `var(--${STATUS_COLORS[s]})`
                                          : 'var(--surface)',
                                      color:
                                        status === s ? '#fff' : 'var(--text)',
                                      cursor: canWrite
                                        ? 'pointer'
                                        : 'not-allowed',
                                      opacity: status === s ? 1 : 0.7,
                                    }}
                                  >
                                    {statusLabels[s]}
                                  </button>
                                )
                              )}
                            </div>
                            <input
                              placeholder={tr('checklist.notesOptional')}
                              defaultValue={response?.notes ?? ''}
                              disabled={!canWrite}
                              onBlur={e =>
                                void setItemNotes(item.id, e.target.value)
                              }
                              style={{
                                marginTop: '0.5rem',
                                fontSize: '0.85rem',
                              }}
                            />
                          </div>
                          {status !== 'pending' && (
                            <span className={`badge ${STATUS_COLORS[status]}`}>
                              <span
                                style={{
                                  width: 14,
                                  height: 14,
                                  marginRight: '0.25rem',
                                  display: 'inline-block',
                                }}
                              >
                                <IconCheck />
                              </span>
                              {statusLabels[status]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedTemplate && !showTemplateEditor && myCompletion ? (
        <EmptyState
          icon="search"
          title={tr('checklist.emptyNoItemTitle')}
          text={tr('checklist.emptyNoItemText')}
        />
      ) : null}

      {selectedTemplate && !showTemplateEditor && myCompletion && (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>{tr('checklist.globalNotesHeading')}</h4>
          <textarea
            value={completionNotes}
            onChange={e => setCompletionNotes(e.target.value)}
            placeholder={tr('checklist.globalNotesPlaceholder')}
            rows={4}
            maxLength={5000}
            disabled={!canWrite}
          />
          {canWrite && (
            <div className="row icon-action-toolbar">
              <button type="button" onClick={() => void saveCompletionNotes()}>
                {tr('checklist.saveNotes')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
