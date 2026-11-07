/**
 * Les visites et rappels d'un dossier, dans l'agenda de chacun. L'onglet
 * « Visites et rappels » porte des échéances, mais ne parle qu'à qui l'ouvre :
 * aucune notification ne part de l'application. Un fichier `.ics` importé dans
 * son agenda sonne, lui, application fermée.
 *
 * Écrit par le module `ical` du socle (échappement, pliage, CRLF, `VALARM`),
 * comme les échéances de miss-uwh (`features/export/deadlinesIcs.ts`). Ne
 * reste ici que ce qui est propre à Carbook : QUOI part, sous quel `UID`,
 * avec QUELS rappels, et dans quelle langue.
 *
 * CE QUI EST DÉCIDÉ ICI :
 *  - CE QUI RESTE À FAIRE OU À VENIR. Les rappels non faits qui ont une
 *    échéance — en retard compris : ils sont toujours à faire — et les visites
 *    qui n'ont pas encore eu lieu. Un rappel sans échéance n'a pas de place
 *    dans un agenda ; une visite passée est de l'historique, pas un rendez-vous.
 *  - DES INSTANTS, PAS DES JOURNÉES. `due_at` et `visit_at` sont saisis avec
 *    une heure (`datetime-local`) et stockés en UTC : l'agenda les affiche à
 *    l'heure locale de chacun, comme l'onglet.
 *  - UNE DURÉE CHOISIE, parce que la base n'en stocke aucune : 30 minutes pour
 *    un rappel (appeler, relancer), une heure pour une visite (essai, échange
 *    en concession). Un rappel est TRANSPARENT — il ne remplit pas la
 *    disponibilité ; une visite, si : on est sur place.
 *  - DEUX RAPPELS `VALARM` : la veille à la même heure, puis une heure avant.
 *    Google Agenda ignore les rappels d'un fichier importé et applique les
 *    siens ; Apple Calendar, Outlook et Thunderbird les honorent.
 *  - UN `UID` STABLE : `rappel-<id>` ou `visite-<id>`, l'identifiant de la
 *    ligne. Réimporter le fichier met à jour au lieu de dupliquer — un rappel
 *    décalé reste le même rappel. Un rappel marqué fait ou une visite supprimée
 *    ne part plus, mais l'événement déjà importé reste dans l'agenda : un
 *    export ne sait pas retirer ce qu'un autre a posé.
 *  - LE PÉRIMÈTRE est celui du filtre « Modèle » de l'onglet : un véhicule, ou
 *    tout le dossier. La recherche et le filtre de type, eux, ne s'appliquent
 *    pas : ils trient un écran, l'agenda n'en est pas un.
 */
import { downloadText } from '@mister-guiiug/dev-pwa-config/download';
import { slugify } from '@mister-guiiug/dev-pwa-config/format';
import {
  ICAL_MIME,
  toIcalendar,
  type IcalEvent,
} from '@mister-guiiug/dev-pwa-config/ical';
import type { useI18n } from '../i18n';

type Translate = ReturnType<typeof useI18n>['t'];

export type ReminderKind = 'contact' | 'visit' | 'appointment' | 'other';

/** Ce que l'export lit d'un rappel — la ligne `reminders` suffit. */
export type AgendaReminder = {
  id: string;
  title: string;
  body: string;
  due_at: string | null;
  done: boolean;
  candidate_id: string | null;
  place?: string | null;
  kind?: ReminderKind | null;
};

/** Ce que l'export lit d'une visite — la ligne `visits` suffit. */
export type AgendaVisit = {
  id: string;
  visit_at: string;
  location: string;
  notes: string;
  candidate_id: string | null;
};

export type AgendaOptions = {
  t: Translate;
  /** Libellé de chaque modèle, par identifiant (celui de la liste). */
  modelLabels?: ReadonlyMap<string, string>;
  /** Un seul véhicule ; absent ou `null` : tout le dossier. */
  candidateId?: string | null;
  /** « Maintenant », pour écarter les visites passées. Injectable = testable. */
  now?: Date | number;
};

/** Le logiciel qui a écrit le fichier — FIGÉ, comme le suffixe d'`UID`. */
const PROD_ID = '-//Miss Carbook//Visites et rappels//FR';

/** Suffixe d'`UID` : l'application, pas l'export. */
const UID_DOMAIN = 'miss-carbook';

/** Durée d'un rappel dans l'agenda, en minutes. */
export const REMINDER_MINUTES = 30;

/** Durée d'une visite dans l'agenda, en minutes. */
export const VISIT_MINUTES = 60;

/** La veille, à la même heure. */
export const ALARM_DAY_BEFORE = 24 * 60;

/** Une heure avant. */
export const ALARM_HOUR_BEFORE = 60;

const KIND_KEY = {
  contact: 'reminders.kind.contact',
  visit: 'reminders.kind.visit',
  appointment: 'reminders.kind.appointment',
  other: 'reminders.kind.other',
} as const satisfies Record<ReminderKind, Parameters<Translate>[0]>;

/** L'instant d'un horodatage ISO, ou `null` s'il est absent ou illisible. */
function instantOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function modelOf(
  candidateId: string | null,
  labels: ReadonlyMap<string, string> | undefined
): string {
  return candidateId ? (labels?.get(candidateId) ?? '').trim() : '';
}

function alarmsFor(summary: string, t: Translate): IcalEvent['alarms'] {
  return [
    {
      minutesBefore: ALARM_DAY_BEFORE,
      description: t('reminders.ics.alarmDay', { what: summary }),
    },
    {
      minutesBefore: ALARM_HOUR_BEFORE,
      description: t('reminders.ics.alarmHour', { what: summary }),
    },
  ];
}

/** `rappel-<id>` : l'identité de la ligne, rien d'autre. */
export function reminderUid(reminder: Pick<AgendaReminder, 'id'>): string {
  return `rappel-${reminder.id}`;
}

/** `visite-<id>` : l'identité de la ligne, rien d'autre. */
export function visitUid(visit: Pick<AgendaVisit, 'id'>): string {
  return `visite-${visit.id}`;
}

/** Un rappel daté → un événement d'agenda. Pur. */
export function reminderToIcal(
  reminder: AgendaReminder,
  opts: Pick<AgendaOptions, 't' | 'modelLabels'>
): IcalEvent {
  const { t } = opts;
  const title = reminder.title.trim();
  const model = modelOf(reminder.candidate_id, opts.modelLabels);
  const summary = model
    ? t('reminders.ics.withModel', { title, model })
    : title;
  const kind = t(KIND_KEY[reminder.kind ?? 'other']);
  const description = [
    t('reminders.ics.typeLine', { kind }),
    reminder.body.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
  const place = (reminder.place ?? '').trim();
  return {
    uid: reminderUid(reminder),
    start: new Date(reminder.due_at ?? ''),
    durationMinutes: REMINDER_MINUTES,
    summary,
    description,
    ...(place ? { location: place } : {}),
    // Un rappel n'occupe pas l'agenda : le créneau reste libre.
    transparent: true,
    alarms: alarmsFor(summary, t),
  };
}

/** Une visite → un événement d'agenda. Pur. */
export function visitToIcal(
  visit: AgendaVisit,
  opts: Pick<AgendaOptions, 't' | 'modelLabels'>
): IcalEvent {
  const { t } = opts;
  const model = modelOf(visit.candidate_id, opts.modelLabels);
  const location = visit.location.trim();
  // Le modèle d'abord : le lieu a déjà sa propriété. Sans modèle, le lieu
  // nomme la visite, pour que l'agenda n'affiche pas un « Visite » nu.
  const main = model || location;
  const summary = main
    ? t('reminders.ics.visitSummary', { main })
    : t('reminders.kind.visit');
  const notes = visit.notes.trim();
  return {
    uid: visitUid(visit),
    start: new Date(visit.visit_at),
    durationMinutes: VISIT_MINUTES,
    summary,
    ...(notes ? { description: notes } : {}),
    ...(location ? { location } : {}),
    alarms: alarmsFor(summary, t),
  };
}

/**
 * Les événements qui partent : rappels à faire datés, visites à venir, dans
 * le périmètre demandé, du plus proche au plus lointain.
 */
export function agendaEvents(
  reminders: readonly AgendaReminder[],
  visits: readonly AgendaVisit[],
  opts: AgendaOptions
): IcalEvent[] {
  const now = opts.now === undefined ? Date.now() : Number(opts.now);
  const inScope = (candidateId: string | null) =>
    !opts.candidateId || candidateId === opts.candidateId;

  const dated: Array<{ at: number; event: IcalEvent }> = [];
  for (const r of reminders) {
    const at = instantOf(r.due_at);
    if (r.done || at === null || !inScope(r.candidate_id)) continue;
    dated.push({ at, event: reminderToIcal(r, opts) });
  }
  for (const v of visits) {
    const at = instantOf(v.visit_at);
    if (at === null || at < now || !inScope(v.candidate_id)) continue;
    dated.push({ at, event: visitToIcal(v, opts) });
  }
  return dated.sort((a, b) => a.at - b.at).map(d => d.event);
}

/** Le nom de ce qui est exporté : le dossier, et le véhicule s'il y en a un. */
export function agendaScopeLabel(
  workspaceName: string | undefined,
  modelLabel: string | undefined
): string {
  return (
    [workspaceName?.trim(), modelLabel?.trim()].filter(Boolean).join(' — ') ||
    'Miss Carbook'
  );
}

/** Le `.ics` complet. Pur : `dtstamp` injectable rend l'export comparable. */
export function buildAgendaIcs(
  events: readonly IcalEvent[],
  opts: { calName: string; dtstamp?: string }
): string {
  return toIcalendar(events, {
    name: opts.calName,
    prodId: PROD_ID,
    uidDomain: UID_DOMAIN,
    dtstamp: opts.dtstamp,
  });
}

/** `<dossier>[-<modèle>]-visites-et-rappels.ics`, sans accents ni espaces. */
export function agendaFileName(scope: string, t: Translate): string {
  return `${slugify(scope) || 'miss-carbook'}-${t('reminders.ics.fileSuffix')}.ics`;
}

/**
 * Télécharge l'agenda et rend le nombre d'événements écrits. Rien n'est
 * téléchargé quand il n'y en a aucun : un calendrier vide ne rappelle rien,
 * et l'appelant le dit.
 */
export function downloadAgendaIcs(
  reminders: readonly AgendaReminder[],
  visits: readonly AgendaVisit[],
  opts: AgendaOptions & { workspaceName?: string }
): number {
  const events = agendaEvents(reminders, visits, opts);
  if (events.length === 0) return 0;
  const model = opts.candidateId
    ? modelOf(opts.candidateId, opts.modelLabels)
    : '';
  const scope = agendaScopeLabel(opts.workspaceName, model);
  downloadText(
    buildAgendaIcs(events, {
      calName: opts.t('reminders.ics.calName', { scope }),
    }),
    agendaFileName(scope, opts.t),
    ICAL_MIME
  );
  return events.length;
}
