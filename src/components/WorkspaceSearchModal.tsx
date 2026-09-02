import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCandidateListLabel } from '../lib/candidateLabel';
import { getSupabase } from '../lib/supabase';
import { useFocusTrap } from '@mister-guiiug/dev-wpa-config/react/a11y';
import { useI18n } from '../i18n';
import { IconActionButton, IconX } from './ui/IconActionButton';
import { getDefaultLocale } from '@mister-guiiug/dev-wpa-config/format';

type Item = { type: string; label: string; tab: string; hint?: string };

export function WorkspaceSearchModal({
  workspaceId,
  open,
  onClose,
  onPick,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onPick: (tab: string) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // `initialFocusRef` remplace l'`autoFocus` de l'input, et corrige au passage
  // où le focus atterrissait : la copie locale focalisait le PREMIER élément
  // focusable du panneau, c'est-à-dire le bouton « fermer » qui le précède
  // dans le DOM. On ouvrait une recherche pour tomber sur sa croix.
  useFocusTrap(panelRef, { active: open, initialFocusRef: searchRef });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [req, cand, rem, visits] = await Promise.all([
        getSupabase()
          .from('requirements')
          .select('id, label')
          .eq('workspace_id', workspaceId)
          .order('sort_order', { ascending: true }),
        getSupabase()
          .from('candidates')
          .select('id, brand, model, trim, parent_candidate_id')
          .eq('workspace_id', workspaceId)
          .order('parent_candidate_id', { ascending: true, nullsFirst: true })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        getSupabase()
          .from('reminders')
          .select('id, title')
          .eq('workspace_id', workspaceId)
          .eq('done', false),
        getSupabase()
          .from('visits')
          .select('id, location, visit_at')
          .eq('workspace_id', workspaceId)
          .order('visit_at', { ascending: false })
          .limit(40),
      ]);
      if (cancelled) return;
      const list: Item[] = [];
      for (const r of req.data ?? [])
        list.push({
          type: t('workspace.requirement'),
          label: r.label,
          tab: 'requirements',
          hint: r.id.slice(0, 8),
        });
      for (const c of cand.data ?? [])
        list.push({
          type: t('workspace.model'),
          label: formatCandidateListLabel({
            brand: c.brand,
            model: c.model,
            trim: c.trim ?? '',
            parent_candidate_id: c.parent_candidate_id ?? null,
          }),
          tab: 'candidates',
          hint: c.id.slice(0, 8),
        });
      for (const r of rem.data ?? [])
        list.push({
          type: t('workspace.reminder'),
          label: r.title,
          tab: 'reminders',
          hint: r.id.slice(0, 8),
        });
      for (const v of visits.data ?? []) {
        const dt = (v as { visit_at: string }).visit_at;
        const loc = ((v as { location?: string | null }).location ?? '').trim();
        const label = loc
          ? `${loc} · ${new Date(dt).toLocaleDateString(getDefaultLocale())}`
          : new Date(dt).toLocaleDateString(getDefaultLocale());
        list.push({
          type: t('workspace.visit'),
          label,
          tab: 'reminders',
          hint: (v as { id: string }).id.slice(0, 8),
        });
      }
      setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId, t]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 40);
    return items
      .filter(
        i =>
          i.label.toLowerCase().includes(s) || i.type.toLowerCase().includes(s)
      )
      .slice(0, 40);
  }, [items, q]);

  if (!open) return null;

  return (
    <div
      className="search-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('workspace.searchDialogLabel')}
    >
      {/* `tabIndex={-1}` : contrat du piège de focus du socle — le conteneur
          doit pouvoir recevoir le focus s'il ne contient rien de focusable. */}
      <div ref={panelRef} tabIndex={-1} className="search-modal card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{t('workspace.searchInWorkspace')}</strong>
          <IconActionButton
            variant="secondary"
            label={t('workspace.closeSearch')}
            onClick={onClose}
          >
            <IconX />
          </IconActionButton>
        </div>
        <input
          ref={searchRef}
          placeholder={t('workspace.searchPlaceholder')}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <ul className="search-modal-list">
          {filtered.map(i => (
            <li key={`${i.type}-${i.hint}`}>
              <button
                type="button"
                className="search-modal-item"
                onClick={() => {
                  onPick(i.tab);
                  onClose();
                }}
              >
                <span className="badge">{i.type}</span> {i.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          {t('workspace.shortcutCtrlK')}
        </p>
      </div>
    </div>
  );
}
