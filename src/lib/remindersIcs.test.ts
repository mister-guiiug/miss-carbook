/**
 * L'export agenda des visites et rappels, lu dans le `.ics` réellement
 * produit — comme un client d'agenda le lirait. La mécanique du format
 * (échappement, pliage, CRLF, écriture des `VALARM`) appartient au socle et y
 * est testée ; restent les questions de l'app : QUOI part, sous quel `UID`,
 * avec QUELS rappels, dans quel périmètre et dans quelle langue.
 */
import { describe, expect, it } from 'vitest';
import { createTranslator } from '@mister-guiiug/dev-pwa-config/react/i18n';
import { unescapeText, unfoldLines } from '@mister-guiiug/dev-pwa-config/ical';
import type { useI18n } from '../i18n';
import { messages } from '../i18n/messages';
import {
  ALARM_DAY_BEFORE,
  ALARM_HOUR_BEFORE,
  REMINDER_MINUTES,
  VISIT_MINUTES,
  agendaEvents,
  agendaFileName,
  agendaScopeLabel,
  buildAgendaIcs,
  reminderUid,
  visitUid,
  type AgendaReminder,
  type AgendaVisit,
} from './remindersIcs';

type Translate = ReturnType<typeof useI18n>['t'];

const fr = createTranslator(messages, 'fr', 'fr') as Translate;
const en = createTranslator(messages, 'en', 'fr') as Translate;

const DTSTAMP = '20261107T080000Z';
const NOW = Date.parse('2026-11-07T12:00:00Z');

const modelLabels = new Map([
  ['c1', 'Peugeot 208 GT'],
  ['c2', 'Renault Clio'],
]);

const reminder = (over: Partial<AgendaReminder> = {}): AgendaReminder => ({
  id: 'r1',
  title: 'Appeler le garage',
  body: '',
  due_at: '2026-11-10T09:30:00+00:00',
  done: false,
  candidate_id: null,
  place: null,
  kind: 'contact',
  ...over,
});

const visit = (over: Partial<AgendaVisit> = {}): AgendaVisit => ({
  id: 'v1',
  visit_at: '2026-11-12T14:00:00+00:00',
  location: 'Garage du Centre',
  notes: '',
  candidate_id: null,
  ...over,
});

interface ReadEvent {
  props: Record<string, string>;
  alarms: Array<Record<string, string>>;
}

/** Relit un `.ics` : dépliage d'abord, puis les propriétés et les rappels. */
function readEvents(ics: string): ReadEvent[] {
  const events: ReadEvent[] = [];
  let current: ReadEvent | null = null;
  let alarm: Record<string, string> | null = null;
  for (const line of unfoldLines(ics)) {
    if (line === 'BEGIN:VEVENT') current = { props: {}, alarms: [] };
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (line === 'BEGIN:VALARM') alarm = {};
    else if (line === 'END:VALARM') {
      if (alarm && current) current.alarms.push(alarm);
      alarm = null;
    } else if (current) {
      const colon = line.indexOf(':');
      const name = line.slice(0, colon).split(';')[0] ?? '';
      (alarm ?? current.props)[name] = unescapeText(line.slice(colon + 1));
    }
  }
  return events;
}

function exportIcs(
  reminders: AgendaReminder[],
  visits: AgendaVisit[],
  opts: { t?: Translate; candidateId?: string | null } = {}
): ReadEvent[] {
  const t = opts.t ?? fr;
  const events = agendaEvents(reminders, visits, {
    t,
    modelLabels,
    candidateId: opts.candidateId,
    now: NOW,
  });
  return readEvents(
    buildAgendaIcs(events, { calName: 'Dossier', dtstamp: DTSTAMP })
  );
}

describe('ce qui part dans l’agenda', () => {
  it('les rappels à faire datés et les visites à venir, du plus proche au plus lointain', () => {
    const events = exportIcs(
      [
        reminder({ id: 'tard', due_at: '2026-12-01T08:00:00Z' }),
        reminder({ id: 'tot', due_at: '2026-11-09T08:00:00Z' }),
      ],
      [visit({ id: 'entre', visit_at: '2026-11-20T10:00:00Z' })]
    );
    expect(events.map(e => e.props.UID)).toEqual([
      'rappel-tot@miss-carbook',
      'visite-entre@miss-carbook',
      'rappel-tard@miss-carbook',
    ]);
  });

  it('écarte les rappels faits, ceux sans échéance, et une date illisible', () => {
    const events = exportIcs(
      [
        reminder({ id: 'fait', done: true }),
        reminder({ id: 'sans', due_at: null }),
        reminder({ id: 'illisible', due_at: 'bientôt' }),
        reminder({ id: 'garde' }),
      ],
      []
    );
    expect(events.map(e => e.props.UID)).toEqual(['rappel-garde@miss-carbook']);
  });

  it('garde un rappel en retard — toujours à faire — mais pas une visite passée', () => {
    const events = exportIcs(
      [reminder({ id: 'retard', due_at: '2026-11-01T09:00:00Z' })],
      [
        visit({ id: 'passee', visit_at: '2026-11-07T11:59:00Z' }),
        visit({ id: 'avenir', visit_at: '2026-11-07T12:00:00Z' }),
      ]
    );
    expect(events.map(e => e.props.UID)).toEqual([
      'rappel-retard@miss-carbook',
      'visite-avenir@miss-carbook',
    ]);
  });

  it('un véhicule : seulement ce qui lui est lié', () => {
    const reminders = [
      reminder({ id: 'r-c1', candidate_id: 'c1' }),
      reminder({ id: 'r-c2', candidate_id: 'c2' }),
      reminder({ id: 'r-libre' }),
    ];
    const visits = [visit({ id: 'v-c1', candidate_id: 'c1' }), visit()];
    expect(
      exportIcs(reminders, visits, { candidateId: 'c1' }).map(e => e.props.UID)
    ).toEqual(['rappel-r-c1@miss-carbook', 'visite-v-c1@miss-carbook']);
    // Sans véhicule : tout le dossier.
    expect(exportIcs(reminders, visits, { candidateId: null })).toHaveLength(5);
  });
});

describe('un rappel dans l’agenda', () => {
  const [event] = exportIcs(
    [
      reminder({
        body: 'Demander la reprise, et le délai',
        place: ' Garage du Centre ',
        candidate_id: 'c1',
        kind: 'appointment',
      }),
    ],
    []
  );

  it('un instant UTC, 30 minutes, qui ne remplit pas la disponibilité', () => {
    expect(REMINDER_MINUTES).toBe(30);
    expect(event?.props.DTSTART).toBe('20261110T093000Z');
    expect(event?.props.DTEND).toBe('20261110T100000Z');
    expect(event?.props.TRANSP).toBe('TRANSPARENT');
    expect(event?.props.DTSTAMP).toBe(DTSTAMP);
  });

  it('le titre et le modèle, le type et le détail, le lieu', () => {
    expect(event?.props.SUMMARY).toBe('Appeler le garage — Peugeot 208 GT');
    expect(event?.props.DESCRIPTION).toBe(
      'Type : RDV\n\nDemander la reprise, et le délai'
    );
    expect(event?.props.LOCATION).toBe('Garage du Centre');
  });

  it('deux rappels VALARM : la veille à la même heure, puis une heure avant', () => {
    expect(ALARM_DAY_BEFORE).toBe(24 * 60);
    expect(ALARM_HOUR_BEFORE).toBe(60);
    expect(event?.alarms).toEqual([
      {
        ACTION: 'DISPLAY',
        DESCRIPTION: 'Demain — Appeler le garage — Peugeot 208 GT',
        TRIGGER: '-P1D',
      },
      {
        ACTION: 'DISPLAY',
        DESCRIPTION: 'Dans une heure — Appeler le garage — Peugeot 208 GT',
        TRIGGER: '-PT1H',
      },
    ]);
  });

  it('sans modèle ni lieu : le titre seul, et pas de LOCATION', () => {
    const [bare] = exportIcs([reminder({ kind: null })], []);
    expect(bare?.props.SUMMARY).toBe('Appeler le garage');
    expect(bare?.props.DESCRIPTION).toBe('Type : Autre');
    expect(bare?.props).not.toHaveProperty('LOCATION');
  });
});

describe('une visite dans l’agenda', () => {
  it('une heure, opaque — on est sur place —, le modèle au titre, le lieu à part', () => {
    expect(VISIT_MINUTES).toBe(60);
    const [event] = exportIcs(
      [],
      [visit({ candidate_id: 'c2', notes: 'Essayer sur autoroute' })]
    );
    expect(event?.props.DTSTART).toBe('20261112T140000Z');
    expect(event?.props.DTEND).toBe('20261112T150000Z');
    expect(event?.props).not.toHaveProperty('TRANSP');
    expect(event?.props.SUMMARY).toBe('Visite — Renault Clio');
    expect(event?.props.LOCATION).toBe('Garage du Centre');
    expect(event?.props.DESCRIPTION).toBe('Essayer sur autoroute');
    expect(event?.alarms.map(a => a.TRIGGER)).toEqual(['-P1D', '-PT1H']);
  });

  it('sans modèle, le lieu nomme la visite ; sans rien, « Visite »', () => {
    const [named, bare] = exportIcs(
      [],
      [
        visit({ id: 'a' }),
        visit({ id: 'b', location: ' ', visit_at: '2026-11-13T08:00:00Z' }),
      ]
    );
    expect(named?.props.SUMMARY).toBe('Visite — Garage du Centre');
    expect(bare?.props.SUMMARY).toBe('Visite');
    expect(bare?.props).not.toHaveProperty('LOCATION');
    expect(bare?.props).not.toHaveProperty('DESCRIPTION');
  });
});

describe('l’agenda parle la langue de l’app', () => {
  it('en anglais, titres, type et rappels', () => {
    const [r, v] = exportIcs(
      [reminder({ candidate_id: 'c1' })],
      [visit({ candidate_id: 'c1' })],
      { t: en }
    );
    expect(r?.props.SUMMARY).toBe('Appeler le garage — Peugeot 208 GT');
    expect(r?.props.DESCRIPTION).toBe('Type: Contact');
    expect(r?.alarms.map(a => a.DESCRIPTION)).toEqual([
      'Tomorrow — Appeler le garage — Peugeot 208 GT',
      'In one hour — Appeler le garage — Peugeot 208 GT',
    ]);
    expect(v?.props.SUMMARY).toBe('Visit — Peugeot 208 GT');
  });
});

describe('UID, calendrier et fichier', () => {
  it('l’UID est celui de la ligne : un rappel décalé ou renommé reste le même', () => {
    expect(reminderUid({ id: 'abc' })).toBe('rappel-abc');
    expect(visitUid({ id: 'abc' })).toBe('visite-abc');
    const before = exportIcs([reminder()], []);
    const after = exportIcs(
      [reminder({ title: 'Rappeler', due_at: '2026-11-20T10:00:00Z' })],
      []
    );
    expect(after[0]?.props.UID).toBe(before[0]?.props.UID);
  });

  it('l’en-tête du calendrier : PRODID figé, nom donné', () => {
    const ics = buildAgendaIcs([], {
      calName: 'Deuxième voiture — visites et rappels',
      dtstamp: DTSTAMP,
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('PRODID:-//Miss Carbook//Visites et rappels//FR');
    expect(ics).toContain('X-WR-CALNAME:Deuxième voiture — visites et rappels');
    expect(readEvents(ics)).toEqual([]);
  });

  it('le nom du calendrier : le dossier, puis le véhicule s’il y en a un', () => {
    expect(agendaScopeLabel('Deuxième voiture', undefined)).toBe(
      'Deuxième voiture'
    );
    expect(agendaScopeLabel('Deuxième voiture', 'Peugeot 208 GT')).toBe(
      'Deuxième voiture — Peugeot 208 GT'
    );
    expect(agendaScopeLabel(' ', '')).toBe('Miss Carbook');
    expect(fr('reminders.ics.calName', { scope: 'Dossier' })).toBe(
      'Dossier — visites et rappels'
    );
  });

  it('le fichier : sans accents ni espaces, la nature traduite', () => {
    expect(agendaFileName('Deuxième voiture — Peugeot 208 GT', fr)).toBe(
      'deuxieme-voiture-peugeot-208-gt-visites-et-rappels.ics'
    );
    expect(agendaFileName('Deuxième voiture', en)).toBe(
      'deuxieme-voiture-visits-and-reminders.ics'
    );
    expect(agendaFileName('—', fr)).toBe('miss-carbook-visites-et-rappels.ics');
  });
});
