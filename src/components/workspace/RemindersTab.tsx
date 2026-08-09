import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  WORKSPACE_QUICK_ADD_EVENT,
  type WorkspaceQuickAddDetail,
} from '../../lib/workspaceHeaderEvents';
import { formatCandidateListLabel } from '../../lib/candidateLabel';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activity';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { useToast } from '../../contexts/ToastContext';
import {
  IconActionButton,
  IconCheck,
  IconPencil,
  IconRotateCcw,
  IconTrash,
  IconX,
  IconClipboard,
} from '../ui/IconActionButton';
import { EmptyState } from '../ui/EmptyState';
import { TrialChecklist } from './TrialChecklist';
import { useI18n } from '../../i18n';

type Translate = ReturnType<typeof useI18n>['t'];

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ReminderKind = 'contact' | 'visit' | 'appointment' | 'other';

type Row = {
  id: string;
  title: string;
  body: string;
  due_at: string | null;
  done: boolean;
  candidate_id: string | null;
  place?: string | null;
  kind?: ReminderKind | null;
  created_at?: string | null;
};

type VisitRow = {
  id: string;
  visit_at: string;
  location: string;
  notes: string;
  candidate_id: string | null;
};

type View = 'open' | 'done' | 'visits' | 'timeline';

type TimelineEvent =
  | { kind: 'visit'; sortIso: string; visit: VisitRow }
  | { kind: 'reminder'; sortIso: string; reminder: Row };

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

function formatTimelineDayHeading(iso: string, t: Translate): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const k = dayKeyFromIso(iso);
  if (k === localDayKey(today)) return t('reminders.timeline.today');
  if (k === localDayKey(yesterday)) return t('reminders.timeline.yesterday');
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function reminderTimelineSortIso(r: Row): string {
  if (r.due_at) return r.due_at;
  if (r.created_at) return r.created_at;
  return new Date(0).toISOString();
}

type ConfirmState = null | {
  kind: 'reminder' | 'visit';
  id: string;
  title: string;
  subtitle?: string;
};

function fmtShortDateTimeFr(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function RemindersTab({
  workspaceId,
  canWrite,
  userId,
}: {
  workspaceId: string;
  canWrite: boolean;
  userId: string;
}) {
  const { reportException } = useErrorDialog();
  const { showToast } = useToast();
  const { t } = useI18n();
  const reminderKindLabel: Record<ReminderKind, string> = {
    contact: t('reminders.kind.contact'),
    visit: t('reminders.kind.visit'),
    appointment: t('reminders.kind.appointment'),
    other: t('reminders.kind.other'),
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [candidates, setCandidates] = useState<
    {
      id: string;
      brand: string;
      model: string;
      trim: string;
      parent_candidate_id: string | null;
    }[]
  >([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [due, setDue] = useState('');
  const [candId, setCandId] = useState('');
  const [place, setPlace] = useState('');
  const [kind, setKind] = useState<ReminderKind>('contact');

  const [visitAt, setVisitAt] = useState(() =>
    isoToDatetimeLocal(new Date().toISOString())
  );
  const [visitLocation, setVisitLocation] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitCandId, setVisitCandId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editCandId, setEditCandId] = useState('');
  const [editPlace, setEditPlace] = useState('');
  const [editKind, setEditKind] = useState<ReminderKind>('contact');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirming, setConfirming] = useState<ConfirmState>(null);
  const [deleting, setDeleting] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const [view, setView] = useState<View>('open');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ReminderKind | 'all'>('all');
  const [candidateFilter, setCandidateFilter] = useState('all');
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [checklistVisit, setChecklistVisit] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rem, vs, cand] = await Promise.all([
      supabase
        .from('reminders')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('due_at', { ascending: true, nullsFirst: false }),
      supabase
        .from('visits')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('visit_at', { ascending: false }),
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (rem.error) reportException(rem.error, t('reminders.err.loadReminders'));
    else setRows((rem.data ?? []) as Row[]);

    if (vs.error) reportException(vs.error, t('reminders.err.loadVisits'));
    else setVisits((vs.data ?? []) as VisitRow[]);

    setCandidates(
      (cand.data ?? []).map(c => ({
        id: (c as { id: string }).id,
        brand: (c as { brand: string }).brand,
        model: (c as { model: string }).model,
        trim: ((c as { trim: string | null }).trim ?? '') as string,
        parent_candidate_id: ((c as { parent_candidate_id: string | null })
          .parent_candidate_id ?? null) as string | null,
      }))
    );
  }, [workspaceId, reportException, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onQuick = (ev: Event) => {
      const d = (ev as CustomEvent<WorkspaceQuickAddDetail>).detail;
      if (d?.tab !== 'reminders') return;
      setView('open');
      setShowAddReminder(true);
      requestAnimationFrame(() => {
        document.getElementById('reminder-title')?.focus();
      });
    };
    window.addEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick);
    return () => window.removeEventListener(WORKSPACE_QUICK_ADD_EVENT, onQuick);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingId, cancelEdit]);

  const dismissConfirm = useCallback(() => {
    if (deleting) return;
    setConfirming(null);
  }, [deleting]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissConfirm();
    };
    window.addEventListener('keydown', onKey);
    // Focus par défaut sur “Annuler” (évite la suppression accidentelle au clavier).
    window.setTimeout(() => cancelBtnRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, dismissConfirm]);

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditBody(r.body);
    setEditDue(isoToDatetimeLocal(r.due_at));
    setEditCandId(r.candidate_id ?? '');
    setEditPlace((r.place ?? '').trim());
    setEditKind(((r.kind as ReminderKind | null) ?? 'contact') as ReminderKind);
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !title.trim()) return;
    const { error } = await supabase.from('reminders').insert({
      workspace_id: workspaceId,
      title: title.trim(),
      body: body.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      candidate_id: candId || null,
      place: place.trim(),
      kind,
    });
    if (error) reportException(error, t('reminders.err.createReminder'));
    else {
      setTitle('');
      setBody('');
      setDue('');
      setCandId('');
      setPlace('');
      setKind('contact');
      await load();
      await logActivity(workspaceId, 'reminder.create', 'reminder', null, {});
      showToast(t('reminders.toast.reminderAdded'));
    }
  };

  const addVisit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !visitAt) return;
    const { error } = await supabase.from('visits').insert({
      workspace_id: workspaceId,
      candidate_id: visitCandId || null,
      visit_at: new Date(visitAt).toISOString(),
      location: visitLocation.trim(),
      notes: visitNotes.trim(),
    });
    if (error) reportException(error, t('reminders.err.createVisit'));
    else {
      setVisitAt(isoToDatetimeLocal(new Date().toISOString()));
      setVisitLocation('');
      setVisitNotes('');
      setVisitCandId('');
      await load();
      await logActivity(workspaceId, 'visit.create', 'visit', null, {});
      showToast(t('reminders.toast.visitAdded'));
    }
  };

  const saveEdit = async (e: FormEvent, id: string) => {
    e.preventDefault();
    if (!canWrite || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          title: editTitle.trim(),
          body: editBody.trim(),
          due_at: editDue ? new Date(editDue).toISOString() : null,
          candidate_id: editCandId || null,
          place: editPlace.trim(),
          kind: editKind,
        })
        .eq('id', id);
      if (error) reportException(error, t('reminders.err.updateReminder'));
      else {
        cancelEdit();
        await load();
        await logActivity(workspaceId, 'reminder.update', 'reminder', id, {});
        showToast(t('reminders.toast.reminderUpdated'));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const toggle = async (r: Row) => {
    if (!canWrite) return;
    const { error } = await supabase
      .from('reminders')
      .update({ done: !r.done })
      .eq('id', r.id);
    if (error) reportException(error, t('reminders.err.toggleReminder'));
    else {
      await load();
      showToast(
        r.done
          ? t('reminders.toast.reminderReopened')
          : t('reminders.toast.reminderDone')
      );
    }
  };

  const remove = async (id: string) => {
    if (!canWrite) return;
    const r = rows.find(x => x.id === id);
    setConfirming({
      kind: 'reminder',
      id,
      title: r?.title?.trim()
        ? r.title.trim()
        : t('reminders.confirm.thisReminder'),
      subtitle: r?.due_at
        ? t('reminders.confirm.dueSubtitle', {
            date: fmtShortDateTimeFr(r.due_at),
          })
        : undefined,
    });
  };

  const removeVisit = async (id: string) => {
    if (!canWrite) return;
    const v = visits.find(x => x.id === id);
    const when = v?.visit_at ? fmtShortDateTimeFr(v.visit_at) : '';
    const where = (v?.location ?? '').trim();
    const title =
      [when, where].filter(Boolean).join(' · ') ||
      t('reminders.confirm.thisVisit');
    setConfirming({
      kind: 'visit',
      id,
      title,
      subtitle: v?.candidate_id
        ? t('reminders.confirm.modelSubtitle', {
            model: candidateLabelById.get(v.candidate_id) ?? '—',
          })
        : undefined,
    });
  };

  const confirmDelete = useCallback(async () => {
    if (!confirming || !canWrite || deleting) return;
    setDeleting(true);
    try {
      if (confirming.kind === 'reminder') {
        const { error } = await supabase
          .from('reminders')
          .delete()
          .eq('id', confirming.id);
        if (error) throw error;
        if (editingId === confirming.id) cancelEdit();
        await load();
        showToast(t('reminders.toast.reminderDeleted'));
      } else {
        const { error } = await supabase
          .from('visits')
          .delete()
          .eq('id', confirming.id);
        if (error) throw error;
        await load();
        showToast(t('reminders.toast.visitDeleted'));
      }
      setConfirming(null);
    } catch (e: unknown) {
      reportException(
        e,
        confirming.kind === 'reminder'
          ? t('reminders.err.deleteReminder')
          : t('reminders.err.deleteVisit')
      );
    } finally {
      setDeleting(false);
    }
  }, [
    confirming,
    canWrite,
    deleting,
    reportException,
    load,
    showToast,
    editingId,
    cancelEdit,
    t,
  ]);

  const openReminders = rows.filter(r => !r.done);
  const doneReminders = rows.filter(r => r.done);

  const counts = useMemo(
    () => ({
      open: openReminders.length,
      done: doneReminders.length,
      visits: visits.length,
      timeline: rows.length + visits.length,
    }),
    [openReminders.length, doneReminders.length, visits.length, rows.length]
  );

  const candidateLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of candidates) m.set(c.id, formatCandidateListLabel(c));
    return m;
  }, [candidates]);

  const filteredOpen = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = openReminders.filter(r => {
      if (
        kindFilter !== 'all' &&
        ((r.kind as ReminderKind | null) ?? 'other') !== kindFilter
      )
        return false;
      if (
        candidateFilter !== 'all' &&
        (r.candidate_id ?? '') !== candidateFilter
      )
        return false;
      if (!q) return true;
      const linked = r.candidate_id
        ? (candidateLabelById.get(r.candidate_id) ?? '')
        : '';
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.body ?? '').toLowerCase().includes(q) ||
        (r.place ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const ad = a.due_at
        ? new Date(a.due_at).getTime()
        : Number.POSITIVE_INFINITY;
      const bd = b.due_at
        ? new Date(b.due_at).getTime()
        : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return String(a.title ?? '').localeCompare(
        String(b.title ?? ''),
        'fr-FR'
      );
    });
  }, [openReminders, query, kindFilter, candidateFilter, candidateLabelById]);

  const filteredDone = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = doneReminders.filter(r => {
      if (
        kindFilter !== 'all' &&
        ((r.kind as ReminderKind | null) ?? 'other') !== kindFilter
      )
        return false;
      if (
        candidateFilter !== 'all' &&
        (r.candidate_id ?? '') !== candidateFilter
      )
        return false;
      if (!q) return true;
      const linked = r.candidate_id
        ? (candidateLabelById.get(r.candidate_id) ?? '')
        : '';
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.body ?? '').toLowerCase().includes(q) ||
        (r.place ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      );
    });
    // On garde un ordre stable : par échéance (si existe) puis par titre.
    return [...list].sort((a, b) => {
      const ad = a.due_at
        ? new Date(a.due_at).getTime()
        : Number.POSITIVE_INFINITY;
      const bd = b.due_at
        ? new Date(b.due_at).getTime()
        : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return String(a.title ?? '').localeCompare(
        String(b.title ?? ''),
        'fr-FR'
      );
    });
  }, [doneReminders, query, kindFilter, candidateFilter, candidateLabelById]);

  const filteredVisits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = visits.filter(v => {
      if (
        candidateFilter !== 'all' &&
        (v.candidate_id ?? '') !== candidateFilter
      )
        return false;
      if (!q) return true;
      const linked = v.candidate_id
        ? (candidateLabelById.get(v.candidate_id) ?? '')
        : '';
      return (
        (v.location ?? '').toLowerCase().includes(q) ||
        (v.notes ?? '').toLowerCase().includes(q) ||
        linked.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const ad = new Date(a.visit_at).getTime();
      const bd = new Date(b.visit_at).getTime();
      return bd - ad;
    });
  }, [visits, query, candidateFilter, candidateLabelById]);

  const filteredTimelineGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const events: TimelineEvent[] = [];
    const includeVisits = kindFilter === 'all' || kindFilter === 'visit';

    if (includeVisits) {
      for (const v of visits) {
        if (
          candidateFilter !== 'all' &&
          (v.candidate_id ?? '') !== candidateFilter
        )
          continue;
        if (q) {
          const linked = v.candidate_id
            ? (candidateLabelById.get(v.candidate_id) ?? '')
            : '';
          const ok =
            (v.location ?? '').toLowerCase().includes(q) ||
            (v.notes ?? '').toLowerCase().includes(q) ||
            linked.toLowerCase().includes(q);
          if (!ok) continue;
        }
        events.push({ kind: 'visit', sortIso: v.visit_at, visit: v });
      }
    }

    for (const r of rows) {
      if (
        kindFilter !== 'all' &&
        ((r.kind as ReminderKind | null) ?? 'other') !== kindFilter
      )
        continue;
      if (
        candidateFilter !== 'all' &&
        (r.candidate_id ?? '') !== candidateFilter
      )
        continue;
      if (q) {
        const linked = r.candidate_id
          ? (candidateLabelById.get(r.candidate_id) ?? '')
          : '';
        const ok =
          (r.title ?? '').toLowerCase().includes(q) ||
          (r.body ?? '').toLowerCase().includes(q) ||
          (r.place ?? '').toLowerCase().includes(q) ||
          linked.toLowerCase().includes(q);
        if (!ok) continue;
      }
      events.push({
        kind: 'reminder',
        sortIso: reminderTimelineSortIso(r),
        reminder: r,
      });
    }

    events.sort(
      (a, b) => new Date(b.sortIso).getTime() - new Date(a.sortIso).getTime()
    );

    const dayMap = new Map<
      string,
      { heading: string; items: TimelineEvent[] }
    >();
    for (const ev of events) {
      const key = dayKeyFromIso(ev.sortIso);
      const cur = dayMap.get(key);
      if (cur) cur.items.push(ev);
      else
        dayMap.set(key, {
          heading: formatTimelineDayHeading(ev.sortIso, t),
          items: [ev],
        });
    }
    return [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visits, rows, query, kindFilter, candidateFilter, candidateLabelById, t]);

  return (
    <div className="stack reminders-tab">
      <p className="muted" style={{ margin: 0 }}>
        {t('reminders.intro.lead1')}
        <strong>{t('reminders.tabs.timeline')}</strong>{' '}
        {t('reminders.intro.lead2')}
      </p>

      <div
        className="card stack reminders-toolbar"
        style={{ boxShadow: 'none' }}
      >
        <div
          className="row"
          style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <div
            className="tabs"
            role="tablist"
            aria-label={t('reminders.tabs.aria')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'open'}
              className={view === 'open' ? 'active' : ''}
              onClick={() => setView('open')}
            >
              {t('reminders.tabs.open')}{' '}
              <span className="muted">({counts.open})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'done'}
              className={view === 'done' ? 'active' : ''}
              onClick={() => setView('done')}
            >
              {t('reminders.tabs.done')}{' '}
              <span className="muted">({counts.done})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'visits'}
              className={view === 'visits' ? 'active' : ''}
              onClick={() => setView('visits')}
            >
              {t('reminders.tabs.visits')}{' '}
              <span className="muted">({counts.visits})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'timeline'}
              className={view === 'timeline' ? 'active' : ''}
              onClick={() => setView('timeline')}
              title={t('reminders.tabs.timelineTitle')}
            >
              {t('reminders.tabs.timeline')}{' '}
              <span className="muted">({counts.timeline})</span>
            </button>
          </div>

          {canWrite ? (
            <div className="row icon-action-toolbar" style={{ gap: '0.35rem' }}>
              {view !== 'visits' && view !== 'timeline' ? (
                <IconActionButton
                  variant="secondary"
                  label={
                    showAddReminder
                      ? t('reminders.actions.closeReminderForm')
                      : t('reminders.actions.addReminder')
                  }
                  onClick={() => setShowAddReminder(v => !v)}
                >
                  {showAddReminder ? <IconX /> : <IconPencil />}
                </IconActionButton>
              ) : (
                <IconActionButton
                  variant="secondary"
                  label={
                    showAddVisit
                      ? t('reminders.actions.closeVisitForm')
                      : t('reminders.actions.addVisit')
                  }
                  onClick={() => setShowAddVisit(v => !v)}
                >
                  {showAddVisit ? <IconX /> : <IconPencil />}
                </IconActionButton>
              )}
            </div>
          ) : null}
        </div>

        <div className="row reminders-filters" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 220px' }}>
            <label htmlFor="rem-q">{t('reminders.filters.searchLabel')}</label>
            <input
              id="rem-q"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('reminders.filters.searchPlaceholder')}
              maxLength={200}
            />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="rem-kind">{t('reminders.field.type')}</label>
            <select
              id="rem-kind"
              value={kindFilter}
              onChange={e =>
                setKindFilter(e.target.value as ReminderKind | 'all')
              }
              disabled={view === 'visits'}
              title={
                view === 'timeline'
                  ? t('reminders.filters.typeTitleTimeline')
                  : undefined
              }
            >
              <option value="all">{t('reminders.filters.all')}</option>
              <option value="contact">{reminderKindLabel.contact}</option>
              <option value="visit">{reminderKindLabel.visit}</option>
              <option value="appointment">
                {reminderKindLabel.appointment}
              </option>
              <option value="other">{reminderKindLabel.other}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="rem-cand">{t('reminders.field.model')}</label>
            <select
              id="rem-cand"
              value={candidateFilter}
              onChange={e => setCandidateFilter(e.target.value)}
            >
              <option value="all">{t('reminders.filters.all')}</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>
                  {formatCandidateListLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {canWrite &&
      showAddReminder &&
      view !== 'visits' &&
      view !== 'timeline' ? (
        <form
          onSubmit={add}
          className="card stack"
          style={{ boxShadow: 'none' }}
        >
          <h3 style={{ margin: 0 }}>{t('reminders.form.newReminderTitle')}</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label>{t('reminders.field.type')}</label>
              <select
                value={kind}
                onChange={e => setKind(e.target.value as ReminderKind)}
              >
                <option value="contact">{reminderKindLabel.contact}</option>
                <option value="visit">{reminderKindLabel.visit}</option>
                <option value="appointment">
                  {reminderKindLabel.appointment}
                </option>
                <option value="other">{reminderKindLabel.other}</option>
              </select>
            </div>
          </div>
          <input
            id="reminder-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('reminders.field.title')}
            required
            maxLength={200}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={t('reminders.form.bodyPlaceholder')}
            maxLength={2000}
            rows={3}
          />
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label>{t('reminders.field.due')}</label>
              <input
                type="datetime-local"
                value={due}
                onChange={e => setDue(e.target.value)}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>{t('reminders.form.placeLabelOptional')}</label>
              <input
                value={place}
                onChange={e => setPlace(e.target.value)}
                placeholder={t('reminders.form.placePlaceholder')}
                maxLength={200}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>{t('reminders.form.linkModelOptional')}</label>
              <select value={candId} onChange={e => setCandId(e.target.value)}>
                <option value="">—</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {formatCandidateListLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row icon-action-toolbar" style={{ flexWrap: 'wrap' }}>
            <button type="submit">{t('reminders.form.submitReminder')}</button>
            <IconActionButton
              variant="secondary"
              label={t('reminders.actions.closeForm')}
              onClick={() => setShowAddReminder(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </form>
      ) : null}

      {canWrite && showAddVisit && view === 'visits' ? (
        <form
          onSubmit={addVisit}
          className="card stack"
          style={{ boxShadow: 'none' }}
        >
          <h3 style={{ margin: 0 }}>{t('reminders.form.newVisitTitle')}</h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label>{t('reminders.form.visitDateTime')}</label>
              <input
                type="datetime-local"
                value={visitAt}
                onChange={e => setVisitAt(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>{t('reminders.field.place')}</label>
              <input
                value={visitLocation}
                onChange={e => setVisitLocation(e.target.value)}
                placeholder={t('reminders.form.placePlaceholder')}
                maxLength={500}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>{t('reminders.form.modelOptional')}</label>
              <select
                value={visitCandId}
                onChange={e => setVisitCandId(e.target.value)}
              >
                <option value="">—</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {formatCandidateListLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label>{t('reminders.field.notes')}</label>
            <textarea
              value={visitNotes}
              onChange={e => setVisitNotes(e.target.value)}
              placeholder={t('reminders.form.notesPlaceholder')}
              maxLength={4000}
              rows={3}
            />
          </div>
          <div className="row icon-action-toolbar" style={{ flexWrap: 'wrap' }}>
            <button type="submit">{t('reminders.form.submitVisit')}</button>
            <IconActionButton
              variant="secondary"
              label={t('reminders.actions.closeForm')}
              onClick={() => setShowAddVisit(false)}
            >
              <IconX />
            </IconActionButton>
          </div>
        </form>
      ) : null}

      {view === 'timeline' ? (
        filteredTimelineGroups.length === 0 ? (
          <EmptyState
            icon="reminders"
            title={t('reminders.empty.timelineTitle')}
            text={t('reminders.empty.timelineText')}
          />
        ) : (
          <div className="stack reminders-timeline-wrap">
            <p
              className="muted reminders-timeline-hint"
              style={{ margin: 0, fontSize: '0.88rem' }}
            >
              {t('reminders.timeline.hintPrefix')}{' '}
              <strong>{t('reminders.timeline.hintStrong')}</strong>
              {t('reminders.timeline.hintSuffix')}
            </p>
            <ul className="reminders-timeline">
              {filteredTimelineGroups.map(([dayKey, { heading, items }]) => (
                <li key={dayKey} className="reminders-timeline-day stack">
                  <h3 className="reminders-timeline-day-heading">{heading}</h3>
                  <ul className="reminders-timeline-day-list">
                    {items.map(ev => {
                      const evDate = new Date(ev.sortIso);
                      const timeStr = evDate.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      if (ev.kind === 'visit') {
                        const v = ev.visit;
                        const linkedLabel = v.candidate_id
                          ? candidateLabelById.get(v.candidate_id)
                          : null;
                        const loc = (v.location ?? '').trim();
                        const main =
                          [loc, linkedLabel].filter(Boolean).join(' · ') ||
                          t('reminders.timeline.visitBadge');
                        const note = (v.notes ?? '').trim();
                        return (
                          <li
                            key={`v-${v.id}`}
                            className="reminders-timeline-row"
                            title={`${t('reminders.timeline.visitTitle', { time: timeStr, main })}${note ? ` — ${note}` : ''}`}
                          >
                            <time
                              className="reminders-timeline-time"
                              dateTime={ev.sortIso}
                            >
                              {timeStr}
                            </time>
                            <span className="reminders-timeline-main">
                              <span className="badge reminders-timeline-badge">
                                {t('reminders.timeline.visitBadge')}
                              </span>
                              <span className="reminders-timeline-text">
                                <strong>{main}</strong>
                                {note ? (
                                  <span className="muted reminders-timeline-note">
                                    {' '}
                                    · {note}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <div className="reminders-timeline-actions">
                              {canWrite ? (
                                <IconActionButton
                                  variant="danger"
                                  label={t('reminders.actions.deleteVisit')}
                                  onClick={() => void removeVisit(v.id)}
                                >
                                  <IconTrash />
                                </IconActionButton>
                              ) : null}
                            </div>
                          </li>
                        );
                      }
                      const r = ev.reminder;
                      const k = ((r.kind as ReminderKind | null) ??
                        'other') as ReminderKind;
                      const linkedLabel = r.candidate_id
                        ? candidateLabelById.get(r.candidate_id)
                        : null;
                      const overdue = !r.done && isOverdue(r.due_at);
                      const status = r.done
                        ? t('reminders.status.done')
                        : t('reminders.status.todo');
                      const sub = [
                        status,
                        linkedLabel ? linkedLabel : null,
                        (r.place ?? '').trim() || null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <li
                          key={`r-${r.id}`}
                          className={`reminders-timeline-row${overdue ? ' reminders-timeline-row--overdue' : ''}`}
                          title={`${r.title}${r.due_at ? ` — ${fmtShortDateTimeFr(r.due_at)}` : ''}`}
                        >
                          <time
                            className="reminders-timeline-time"
                            dateTime={ev.sortIso}
                          >
                            {timeStr}
                          </time>
                          <span className="reminders-timeline-main">
                            <span className="badge reminders-timeline-badge">
                              {reminderKindLabel[k]}
                            </span>
                            {r.done ? (
                              <span className="badge reminders-timeline-badge reminders-timeline-badge--done">
                                {t('reminders.status.done')}
                              </span>
                            ) : overdue ? (
                              <span className="badge danger">
                                {t('reminders.badge.overdueShort')}
                              </span>
                            ) : null}
                            <span className="reminders-timeline-text">
                              <strong>{r.title}</strong>
                              {sub ? (
                                <span className="muted reminders-timeline-note">
                                  {' '}
                                  · {sub}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <div className="reminders-timeline-actions">
                            {canWrite ? (
                              <>
                                <IconActionButton
                                  variant="primary"
                                  label={t(
                                    'reminders.actions.editReminderNamed',
                                    {
                                      title: r.title,
                                    }
                                  )}
                                  onClick={() => {
                                    setView(r.done ? 'done' : 'open');
                                    startEdit(r);
                                  }}
                                >
                                  <IconPencil />
                                </IconActionButton>
                                <IconActionButton
                                  variant="secondary"
                                  label={
                                    r.done
                                      ? t('reminders.actions.reopenReminder')
                                      : t('reminders.actions.markDone')
                                  }
                                  onClick={() => void toggle(r)}
                                >
                                  {r.done ? <IconRotateCcw /> : <IconCheck />}
                                </IconActionButton>
                                <IconActionButton
                                  variant="danger"
                                  label={t('reminders.actions.deleteReminder')}
                                  onClick={() => void remove(r.id)}
                                >
                                  <IconTrash />
                                </IconActionButton>
                              </>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : view === 'visits' ? (
        filteredVisits.length === 0 ? (
          <EmptyState
            icon="reminders"
            title={t('reminders.empty.visitsTitle')}
            text={t('reminders.empty.visitsText')}
          />
        ) : (
          <ul
            className="stack"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            {filteredVisits.map(v => {
              const linkedLabel = v.candidate_id
                ? candidateLabelById.get(v.candidate_id)
                : null;
              return (
                <li key={v.id} className="card" style={{ boxShadow: 'none' }}>
                  <div
                    className="row"
                    style={{ justifyContent: 'space-between', gap: '0.75rem' }}
                  >
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <strong>{fmtShortDateTimeFr(v.visit_at)}</strong>
                      {(v.location ?? '').trim() ? (
                        <div className="muted" style={{ fontSize: '0.9rem' }}>
                          {t('reminders.field.placeDisplay', {
                            place: (v.location ?? '').trim(),
                          })}
                        </div>
                      ) : null}
                      {linkedLabel ? (
                        <div
                          className="muted"
                          style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}
                        >
                          {t('reminders.field.modelDisplay', {
                            model: linkedLabel,
                          })}
                        </div>
                      ) : null}
                      {(v.notes ?? '').trim() ? (
                        <p style={{ margin: '0.35rem 0 0' }}>{v.notes}</p>
                      ) : null}
                    </div>
                    <div className="row icon-action-toolbar">
                      <IconActionButton
                        variant="secondary"
                        label={t('reminders.checklist.title')}
                        onClick={() => setChecklistVisit(v.id)}
                      >
                        <IconClipboard />
                      </IconActionButton>
                      {canWrite ? (
                        <IconActionButton
                          variant="danger"
                          label={t('reminders.actions.deleteVisit')}
                          onClick={() => void removeVisit(v.id)}
                        >
                          <IconTrash />
                        </IconActionButton>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : rows.length === 0 ? (
        <EmptyState
          icon="reminders"
          title={t('reminders.empty.remindersTitle')}
          text={t('reminders.empty.remindersText')}
        />
      ) : (
        <div className="card stack" style={{ boxShadow: 'none' }}>
          <h4 style={{ margin: 0 }}>
            {view === 'open'
              ? t('reminders.tabs.open')
              : t('reminders.tabs.done')}
          </h4>
          {(view === 'open' ? filteredOpen : filteredDone).length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t('reminders.empty.noResults')}
            </p>
          ) : (
            <ul
              className="stack"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
              {(view === 'open' ? filteredOpen : filteredDone).map(r => {
                const isEditing = editingId === r.id;
                const linkedLabel = r.candidate_id
                  ? candidateLabelById.get(r.candidate_id)
                  : null;
                const k = ((r.kind as ReminderKind | null) ??
                  'other') as ReminderKind;
                const overdue = !r.done && isOverdue(r.due_at);
                return (
                  <li
                    key={r.id}
                    className="card"
                    style={{
                      boxShadow: 'none',
                      opacity: r.done && !isEditing ? 0.65 : 1,
                      borderColor: overdue ? 'var(--danger)' : undefined,
                    }}
                  >
                    {isEditing ? (
                      <form
                        className="stack"
                        onSubmit={e => void saveEdit(e, r.id)}
                        aria-label={t('reminders.actions.editReminderNamed', {
                          title: r.title,
                        })}
                      >
                        <span className="muted" style={{ fontSize: '0.85rem' }}>
                          {t('reminders.edit.editingPrefix')}
                          <kbd>{t('reminders.edit.escKey')}</kbd>
                          {t('reminders.edit.editingSuffix')}
                        </span>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 180px' }}>
                            <label htmlFor={`rem-edit-kind-${r.id}`}>
                              {t('reminders.field.type')}
                            </label>
                            <select
                              id={`rem-edit-kind-${r.id}`}
                              value={editKind}
                              onChange={e =>
                                setEditKind(e.target.value as ReminderKind)
                              }
                            >
                              <option value="contact">
                                {reminderKindLabel.contact}
                              </option>
                              <option value="visit">
                                {reminderKindLabel.visit}
                              </option>
                              <option value="appointment">
                                {reminderKindLabel.appointment}
                              </option>
                              <option value="other">
                                {reminderKindLabel.other}
                              </option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`rem-edit-title-${r.id}`}>
                            {t('reminders.field.title')}
                          </label>
                          <input
                            id={`rem-edit-title-${r.id}`}
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            required
                            maxLength={200}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label htmlFor={`rem-edit-body-${r.id}`}>
                            {t('reminders.field.detail')}
                          </label>
                          <textarea
                            id={`rem-edit-body-${r.id}`}
                            value={editBody}
                            onChange={e => setEditBody(e.target.value)}
                            maxLength={2000}
                            rows={3}
                          />
                        </div>
                        <div className="row" style={{ flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 160px' }}>
                            <label htmlFor={`rem-edit-due-${r.id}`}>
                              {t('reminders.field.due')}
                            </label>
                            <input
                              id={`rem-edit-due-${r.id}`}
                              type="datetime-local"
                              value={editDue}
                              onChange={e => setEditDue(e.target.value)}
                            />
                          </div>
                          <div style={{ flex: '1 1 220px' }}>
                            <label htmlFor={`rem-edit-place-${r.id}`}>
                              {t('reminders.field.place')}
                            </label>
                            <input
                              id={`rem-edit-place-${r.id}`}
                              value={editPlace}
                              onChange={e => setEditPlace(e.target.value)}
                              placeholder={t('reminders.form.placePlaceholder')}
                              maxLength={200}
                            />
                          </div>
                          <div style={{ flex: '1 1 220px' }}>
                            <label htmlFor={`rem-edit-cand-${r.id}`}>
                              {t('reminders.form.linkModel')}
                            </label>
                            <select
                              id={`rem-edit-cand-${r.id}`}
                              value={editCandId}
                              onChange={e => setEditCandId(e.target.value)}
                            >
                              <option value="">—</option>
                              {candidates.map(c => (
                                <option key={c.id} value={c.id}>
                                  {formatCandidateListLabel(c)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div
                          className="row icon-action-toolbar"
                          style={{ flexWrap: 'wrap' }}
                        >
                          <button type="submit" disabled={savingEdit}>
                            {savingEdit ? t('common.saving') : t('common.save')}
                          </button>
                          <IconActionButton
                            variant="secondary"
                            label={t('reminders.actions.cancelEdit')}
                            onClick={cancelEdit}
                            disabled={savingEdit}
                          >
                            <IconX />
                          </IconActionButton>
                        </div>
                      </form>
                    ) : (
                      <div
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                          <div
                            className="row"
                            style={{ gap: '0.35rem', flexWrap: 'wrap' }}
                          >
                            <span className="badge">
                              {reminderKindLabel[k] ??
                                t('reminders.kind.fallback')}
                            </span>
                            {overdue ? (
                              <span className="badge danger">
                                {t('reminders.badge.overdueLong')}
                              </span>
                            ) : null}
                          </div>
                          <strong>{r.title}</strong>
                          {r.due_at ? (
                            <div className="muted">
                              {fmtShortDateTimeFr(r.due_at)}
                            </div>
                          ) : null}
                          {(r.place ?? '').trim() ? (
                            <div
                              className="muted"
                              style={{ fontSize: '0.9rem' }}
                            >
                              {t('reminders.field.placeDisplay', {
                                place: (r.place ?? '').trim(),
                              })}
                            </div>
                          ) : null}
                          {linkedLabel ? (
                            <div
                              className="muted"
                              style={{
                                fontSize: '0.9rem',
                                marginTop: '0.25rem',
                              }}
                            >
                              {t('reminders.field.modelDisplay', {
                                model: linkedLabel,
                              })}
                            </div>
                          ) : null}
                          {r.body ? (
                            <p style={{ margin: '0.35rem 0 0' }}>{r.body}</p>
                          ) : null}
                        </div>
                        <div className="row icon-action-toolbar">
                          {canWrite ? (
                            <>
                              <IconActionButton
                                variant="primary"
                                label={t(
                                  'reminders.actions.editReminderNamed',
                                  {
                                    title: r.title,
                                  }
                                )}
                                onClick={() => startEdit(r)}
                              >
                                <IconPencil />
                              </IconActionButton>
                              <IconActionButton
                                variant="secondary"
                                label={
                                  r.done
                                    ? t('reminders.actions.reopenReminder')
                                    : t('reminders.actions.markDone')
                                }
                                onClick={() => void toggle(r)}
                              >
                                {r.done ? <IconRotateCcw /> : <IconCheck />}
                              </IconActionButton>
                              <IconActionButton
                                variant="danger"
                                label={t('reminders.actions.deleteReminder')}
                                onClick={() => void remove(r.id)}
                              >
                                <IconTrash />
                              </IconActionButton>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {confirming ? (
        <div
          className="error-dialog-backdrop"
          role="presentation"
          onClick={e => {
            if (e.target === e.currentTarget) dismissConfirm();
          }}
        >
          <div
            className="error-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
          >
            <h2 id="confirm-dialog-title" className="error-dialog-title">
              {t('reminders.confirm.title')}
            </h2>
            <p id="confirm-dialog-desc" className="error-dialog-message">
              {t('reminders.confirm.deletePrefix')}
              <strong>{confirming.title}</strong>
              {t('reminders.confirm.deleteSuffix')}
            </p>
            {confirming.subtitle ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {confirming.subtitle}
              </p>
            ) : null}
            <div className="error-dialog-actions">
              <IconActionButton
                variant="secondary"
                label={t('common.cancel')}
                onClick={dismissConfirm}
                disabled={deleting}
                ref={cancelBtnRef}
              >
                <IconX />
              </IconActionButton>
              <IconActionButton
                variant="danger"
                label={
                  deleting
                    ? t('reminders.confirm.deleting')
                    : t('common.delete')
                }
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                <IconTrash />
              </IconActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {checklistVisit && (
        <div
          className="error-dialog-backdrop"
          role="presentation"
          onClick={() => setChecklistVisit(null)}
        >
          <div
            className="error-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checklist-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h2
                id="checklist-dialog-title"
                className="error-dialog-title"
                style={{ margin: 0 }}
              >
                {t('reminders.checklist.title')}
              </h2>
              <IconActionButton
                variant="secondary"
                label={t('common.close')}
                onClick={() => setChecklistVisit(null)}
              >
                <IconX />
              </IconActionButton>
            </div>
            <TrialChecklist
              workspaceId={workspaceId}
              visitId={checklistVisit}
              canWrite={canWrite}
              userId={userId}
              onClose={() => setChecklistVisit(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
