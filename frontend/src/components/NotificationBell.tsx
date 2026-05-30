'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { notificationsApi } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    notificationsApi
      .list()
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unreadCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  async function markAllRead() {
    await notificationsApi.markRead({ all: true });
    load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg border border-milou-border hover:border-cyan-500/50 transition"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" aria-label="Fermer" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto z-50 card p-0 shadow-neon-strong animate-fade-in">
            <div className="flex items-center justify-between p-3 border-b border-milou-border">
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && (
                <button type="button" className="text-xs text-cyan-400" onClick={markAllRead}>
                  Tout lire
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="p-4 text-gray-500 text-sm text-center">Aucune notification</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n._id} className={`border-b border-milou-border/40 ${!n.read ? 'bg-cyan-500/5' : ''}`}>
                    <Link
                      href={n.link || '/dashboard'}
                      className="block p-3 hover:bg-white/5"
                      onClick={() => {
                        notificationsApi.markRead({ ids: [n._id] }).then(load);
                        setOpen(false);
                      }}
                    >
                      <p className="text-sm font-medium text-white">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {new Date(n.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
