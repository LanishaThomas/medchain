'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { authService } from '@/services/authService';

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Fetch existing notifications on mount
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authService.client.get('/notifications?limit=30');
      const { notifications: list, unreadCount: count } = res.data.data;
      setNotifications(list);
      setUnreadCount(count);
    } catch { /* ignore */ }
  }, []);

  // Connect SSE stream
  useEffect(() => {
    const token = authService.getAccessToken();
    if (!token) return;

    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const url = `${API}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);

        if (payload.event === 'init') {
          setUnreadCount(payload.unreadCount ?? 0);
          fetchNotifications();
          return;
        }

        if (payload.event === 'notification' && payload.notification) {
          const n: AppNotification = payload.notification;
          setNotifications(prev => [n, ...prev].slice(0, 50));
          setUnreadCount(c => c + 1);
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // SSE auto-reconnects; just close and let browser retry
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    try {
      const res = await authService.client.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(res.data.data.unreadCount);
    } catch { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await authService.client.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }, []);

  return { notifications, unreadCount, open, setOpen, markRead, markAllRead };
}
