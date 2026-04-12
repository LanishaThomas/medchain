'use client';

import { useEffect, useRef } from 'react';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const typeIcon: Record<string, string> = {
  appointment: '📅',
  prescription: '💊',
  permission: '🔐',
  medical_record: '📋',
  emergency: '🚨',
  system: '🔔',
  account_status: '👤',
  doctor_application: '🏥',
};

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-blue-400',
  low: 'bg-slate-300',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, open, setOpen, markRead, markAllRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, setOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-btn"
        aria-label="View notifications"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n: AppNotification) => (
                <button
                  key={n._id}
                  onClick={() => !n.isRead && markRead(n._id)}
                  className={[
                    'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-50',
                    'hover:bg-slate-50 transition-colors',
                    !n.isRead ? 'bg-blue-50/50' : '',
                  ].join(' ')}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{typeIcon[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold truncate ${!n.isRead ? 'text-slate-900' : 'text-slate-600'}`}>
                        {n.title}
                      </p>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot[n.priority] ?? 'bg-slate-300'} ${n.isRead ? 'opacity-0' : ''}`} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
