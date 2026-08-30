import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeTable } from './useRealtimeTable';

/**
 * Faux client Supabase : on garde la main sur les deux rappels que le
 * transport du socle installe (`on` pour les changements, `subscribe` pour les
 * statuts), ce qui permet de jouer une coupure sans réseau.
 */
const hoisted = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => hoisted.client }));

type Sub = { event: string; table: string; filter?: string };

function fakeSupabase() {
  let onPayload: ((p: unknown) => void) | null = null;
  let onStatus: ((s: string) => void) | null = null;
  let subscribed: Sub | null = null;
  const removeChannel = vi.fn();
  const channel: Record<string, unknown> = {
    state: 'joined',
    on(_event: string, config: Sub, handler: (p: unknown) => void) {
      subscribed = config;
      onPayload = handler;
      return channel;
    },
    subscribe(cb: (s: string) => void) {
      onStatus = cb;
      return channel;
    },
  };
  const channelFactory = vi.fn((_name: string) => channel);
  hoisted.client = { channel: channelFactory, removeChannel, from: vi.fn() };
  return {
    channelFactory,
    removeChannel,
    /** Les noms de sujet demandés à Supabase, dans l'ordre. */
    topics: () => channelFactory.mock.calls.map(([name]) => name),
    config: () => subscribed,
    /** Rejoue un statut du canal Supabase (`SUBSCRIBED`, `CHANNEL_ERROR`…). */
    emitStatus: (s: string) => onStatus?.(s),
    emitChange: (p: unknown) => onPayload?.(p),
  };
}

describe('useRealtimeTable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("s'abonne à la table, au filtre et à l'évènement demandés", async () => {
    const sb = fakeSupabase();
    const onChange = vi.fn();

    const { result } = renderHook(() =>
      useRealtimeTable({
        table: 'activity_log',
        event: 'INSERT',
        filter: 'workspace_id=eq.w1',
        onChange,
      })
    );

    expect(sb.config()).toMatchObject({
      table: 'activity_log',
      schema: 'public',
      event: 'INSERT',
      filter: 'workspace_id=eq.w1',
    });
    expect(result.current.status).toBe('connecting');

    await act(async () => {
      sb.emitStatus('SUBSCRIBED');
    });
    expect(result.current.status).toBe('live');

    act(() => {
      sb.emitChange({ eventType: 'INSERT', new: { id: 'a1' } });
    });
    expect(onChange).toHaveBeenCalledWith({
      eventType: 'INSERT',
      new: { id: 'a1' },
    });
  });

  it('passe en `retrying` puis revient en `live`, et rattrape UNE fois', async () => {
    const sb = fakeSupabase();
    const onResync = vi.fn();

    const { result } = renderHook(() =>
      useRealtimeTable({
        table: 'user_notes',
        filter: 'workspace_id=eq.w1',
        onChange: vi.fn(),
        onResync,
      })
    );

    await act(async () => {
      sb.emitStatus('SUBSCRIBED');
    });
    expect(result.current.status).toBe('live');
    // Première connexion : il n'y a pas de trou à combler.
    expect(onResync).not.toHaveBeenCalled();

    act(() => {
      sb.emitStatus('CHANNEL_ERROR');
    });
    expect(result.current.status).toBe('retrying');
    expect(sb.removeChannel).toHaveBeenCalledTimes(1);

    // Le socle attend le retrait exponentiel avant de reprendre la main.
    expect(sb.channelFactory).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(sb.channelFactory).toHaveBeenCalledTimes(2);

    await act(async () => {
      sb.emitStatus('SUBSCRIBED');
    });
    expect(result.current.status).toBe('live');
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('demande un sujet neuf à chaque tentative', async () => {
    const sb = fakeSupabase();

    renderHook(() =>
      useRealtimeTable({ table: 'comments', onChange: vi.fn() })
    );
    await act(async () => {
      sb.emitStatus('SUBSCRIBED');
    });
    act(() => {
      sb.emitStatus('CHANNEL_ERROR');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const topics = sb.topics();
    expect(topics).toHaveLength(2);
    // Redemander le MÊME nom rendrait le canal précédent, encore en train de
    // partir : `subscribe()` n'y ferait rien et l'écran resterait muet.
    expect(new Set(topics).size).toBe(2);
    for (const topic of topics) expect(topic).toContain('comments');
  });

  it("referme le canal même si l'abonnement n'a jamais abouti", () => {
    const sb = fakeSupabase();

    const { unmount } = renderHook(() =>
      useRealtimeTable({ table: 'comments', onChange: vi.fn() })
    );
    // Aucun `SUBSCRIBED` : le socle n'a pas de poignée de fermeture, c'est au
    // hook de ne pas laisser le canal derrière lui.
    act(() => {
      unmount();
    });
    expect(sb.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("n'ouvre aucun canal quand il est désactivé", () => {
    const sb = fakeSupabase();

    const { result } = renderHook(() =>
      useRealtimeTable({
        table: 'comments',
        onChange: vi.fn(),
        enabled: false,
      })
    );

    expect(sb.channelFactory).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('ferme le canal au démontage', async () => {
    const sb = fakeSupabase();

    const { unmount } = renderHook(() =>
      useRealtimeTable({ table: 'reminders', onChange: vi.fn() })
    );
    await act(async () => {
      sb.emitStatus('SUBSCRIBED');
    });

    act(() => {
      unmount();
    });
    expect(sb.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('ne rouvre pas le canal quand seul le rappel change', async () => {
    const sb = fakeSupabase();

    const { rerender } = renderHook(
      ({ onChange }: { onChange: (c: unknown) => void }) =>
        useRealtimeTable({ table: 'comments', onChange }),
      { initialProps: { onChange: vi.fn() } }
    );
    await act(async () => {
      sb.emitStatus('SUBSCRIBED');
    });
    expect(sb.channelFactory).toHaveBeenCalledTimes(1);

    // Une fonction recréée à chaque rendu — le cas courant dans les écrans.
    const second = vi.fn();
    act(() => {
      rerender({ onChange: second });
    });
    expect(sb.channelFactory).toHaveBeenCalledTimes(1);

    act(() => {
      sb.emitChange({ eventType: 'UPDATE', new: { id: 'c1' } });
    });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
