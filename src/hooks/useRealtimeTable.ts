import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createChannel,
  STATUS,
  type ChannelStatus,
} from '@mister-guiiug/dev-pwa-config/realtime';
import {
  supabaseRealtimeTransport,
  type SupabaseChange,
} from '@mister-guiiug/dev-pwa-config/realtime/supabase';
import { getSupabase } from '../lib/supabase';

/**
 * Un abonnement `postgres_changes` résilient, pour les quatre écrans qui en
 * ouvrent un.
 *
 * POURQUOI UN HOOK ET PAS QUATRE APPELS. Les quatre écrans (activité,
 * candidats, notes, commentaires) recopiaient le même bloc
 * `channel().on().subscribe()` à la table près — sans reconnexion, sans
 * rattrapage. Un onglet endormi ratait donc les changements et n'en disait
 * rien : l'écran se croyait à jour. Le socle règle la reconnexion (retrait
 * exponentiel dispersé) et la veille (sonde au `visibilitychange`) ; ce hook
 * l'y branche une seule fois pour les quatre.
 *
 * POURQUOI PAS LE `catchUp` DU SOCLE. Deux raisons, dans cet ordre :
 *
 * 1. `realtime/supabase` rattrape en interrogeant la table sur la colonne
 *    curseur SANS réappliquer le `filter` de l'abonnement. Or ici les quatre
 *    abonnements sont filtrés (`workspace_id` ou `candidate_id`) et la RLS
 *    laisse passer tous les espaces dont on est membre : un rattrapage non
 *    filtré ferait entrer l'activité d'un AUTRE espace dans le journal.
 * 2. Seule `user_notes` a un `updated_at` ; `activity_log`, `comments` et
 *    `reminders` n'ont qu'un `created_at`, et `reminders` est mise à jour en
 *    place (`done`) — son `created_at` ne borne donc rien. Aucune migration
 *    SQL n'est ajoutée ici pour y remédier.
 *
 * À la place, `onResync` : après chaque RE-connexion (jamais la première), on
 * redemande à l'écran de recharger avec SA requête, déjà filtrée et déjà
 * éprouvée. La garantie est la même — pas de trou après une veille — sans
 * requête inventée ni colonne manquante.
 */

/**
 * Numéro de sujet, global au module : voir `channel` dans le hook.
 *
 * `supabase.channel(nom)` REND le canal déjà enregistré sous ce nom au lieu
 * d'en créer un — et le socle nomme le sien `dwc:<schema>:<table>`, sans le
 * filtre. Deux abonnements qui se succèdent sur la même table (le détail du
 * candidat A puis celui de B) demanderaient donc le canal de A, alors en train
 * de partir : `on()` refuse d'y ajouter un écouteur, ou pire `subscribe()` ne
 * fait RIEN — un canal qui n'est pas `closed` n'est pas rejoint. La promesse
 * du transport ne se résout alors jamais, et l'écran reste muet sans qu'aucune
 * erreur ne le dise. Un suffixe neuf à chaque tentative écarte le cas, et rend
 * au passage aux quatre canaux les noms distincts qu'ils avaient avant.
 */
let topicSeq = 0;

export type RealtimeTableOptions = {
  table: string;
  /** Filtre `postgres_changes`, ex. `workspace_id=eq.<id>`. */
  filter?: string;
  /** Défaut : `*`. */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** Reçoit chaque changement reçu en direct. */
  onChange: (change: SupabaseChange) => void;
  /** Rechargement complet après une RE-connexion. Voir l'entête. */
  onResync?: () => void;
  /** À `false`, aucun canal n'est ouvert. Défaut : `true`. */
  enabled?: boolean;
};

export function useRealtimeTable({
  table,
  filter,
  event = '*',
  onChange,
  onResync,
  enabled = true,
}: RealtimeTableOptions): { status: ChannelStatus } {
  const [status, setStatus] = useState<ChannelStatus>(STATUS.idle);

  // Les rappels vivent dans des refs : sans ça, une simple re-création de
  // `onChange` au rendu fermerait puis rouvrirait le canal, ce qui rouvre
  // précisément le trou qu'on vient de boucher.
  const onChangeRef = useRef(onChange);
  const onResyncRef = useRef(onResync);
  useEffect(() => {
    onChangeRef.current = onChange;
    onResyncRef.current = onResync;
  });

  useEffect(() => {
    if (!enabled) return;

    /** Une transition vers `live` déjà vue = la suivante est un retour. */
    let wasLive = false;

    const supabase = getSupabase();

    // Canaux ouverts dont le socle n'a jamais reçu la poignée de fermeture :
    // une tentative qui échoue AVANT `SUBSCRIBED` n'en produit pas, et
    // personne d'autre ne les refermerait.
    const orphans = new Set<RealtimeChannel>();
    const releaseOrphans = () => {
      for (const orphan of orphans) void supabase.removeChannel(orphan);
      orphans.clear();
    };

    const transport = supabaseRealtimeTransport({
      // Pont de types, pas un contournement : le socle déclare
      // `removeChannel(channel: unknown)` là où supabase-js attend un
      // `RealtimeChannel`, et par contravariance les deux signatures ne se
      // rencontrent pas — pour un seul et même objet.
      client: {
        channel: name => {
          // Une nouvelle tentative rend la précédente caduque.
          releaseOrphans();
          const opened = supabase.channel(`${name}-${++topicSeq}`);
          orphans.add(opened);
          return opened;
        },
        removeChannel: channel => {
          orphans.delete(channel as RealtimeChannel);
          return supabase.removeChannel(channel as RealtimeChannel);
        },
        from: table_ => supabase.from(table_),
      },
      table,
      event,
      ...(filter ? { filter } : {}),
    });

    const channel = createChannel<SupabaseChange, string>({
      // On ne prend QUE `connect` : ni `catchUp` ni le `cursorOf` qui ne sert
      // qu'à lui (voir l'entête).
      connect: transport.connect,
      onMessage: change => onChangeRef.current(change),
      onStatus: next => {
        setStatus(next);
        if (next !== STATUS.live) return;
        if (wasLive) onResyncRef.current?.();
        wasLive = true;
      },
    });

    void channel.start();
    return () => {
      channel.stop();
      // `stop()` ne referme que l'abonnement établi. En développement, React
      // monte-démonte-remonte : le premier canal n'a pas eu le temps d'aboutir
      // et resterait ouvert pour toujours.
      releaseOrphans();
    };
  }, [table, filter, event, enabled]);

  // Désactivé, il n'y a pas de canal : `idle` est l'état, pas le dernier
  // souvenir du canal précédent.
  return { status: enabled ? status : STATUS.idle };
}
