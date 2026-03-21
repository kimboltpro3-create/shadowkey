import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TableName =
  | 'policies'
  | 'disclosure_logs'
  | 'encrypted_secrets'
  | 'privacy_budgets'
  | 'ephemeral_personas'
  | 'dead_man_switches'
  | 'reverse_disclosure_requests';

interface UseRealtimeOptions {
  table: TableName;
  filter?: string;
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
  onChange?: () => void;
  enabled?: boolean;
}

export function useRealtime({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const onChangeRef = useRef(onChange);
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  onChangeRef.current = onChange;
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `${table}-${filter || 'all'}-${Date.now()}`;

    const channel = supabase.channel(channelName);

    const pgChangesFilter: { event: '*'; schema: 'public'; table: string; filter?: string } = {
      event: '*',
      schema: 'public',
      table,
    };

    if (filter) {
      pgChangesFilter.filter = filter;
    }

    channel
      .on('postgres_changes', pgChangesFilter, (payload) => {
        if (payload.eventType === 'INSERT' && onInsertRef.current) {
          onInsertRef.current(payload.new as Record<string, unknown>);
        } else if (payload.eventType === 'UPDATE' && onUpdateRef.current) {
          onUpdateRef.current(payload.new as Record<string, unknown>);
        } else if (payload.eventType === 'DELETE' && onDeleteRef.current) {
          onDeleteRef.current(payload.old as Record<string, unknown>);
        }
        if (onChangeRef.current) {
          onChangeRef.current();
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filter, enabled]);
}

export function useVaultRealtime(
  vaultId: string | null,
  tables: TableName[],
  onAnyChange: () => void
) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const onChangeRef = useRef(onAnyChange);

  onChangeRef.current = onAnyChange;

  useEffect(() => {
    if (!vaultId) return;

    const channels: RealtimeChannel[] = [];

    tables.forEach((table) => {
      const channelName = `${table}-vault-${vaultId}-${Date.now()}-${Math.random()}`;
      const channel = supabase.channel(channelName);

      channel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: `vault_id=eq.${vaultId}`,
        }, () => {
          if (onChangeRef.current) {
            onChangeRef.current();
          }
        })
        .subscribe();

      channels.push(channel);
    });

    channelsRef.current = channels;

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [vaultId, tables.join(',')]);
}
