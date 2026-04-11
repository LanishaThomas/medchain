'use client';

import { useState, useCallback } from 'react';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => setIsCollapsed((c) => !c), []);
  const handleMobileOpen    = useCallback(() => setIsMobileOpen(true), []);
  const handleMobileClose   = useCallback(() => setIsMobileOpen(false), []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Sidebar ──────────────────────────────── */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onMobileClose={handleMobileClose}
      />

      {/* ── Main area: offset by sidebar width on desktop ── */}
      <div
        className={[
          'flex flex-col flex-1 min-w-0',
          'transition-[margin] duration-300 ease-in-out',
          /* On lg+: push content right by sidebar width */
          isCollapsed ? 'lg:ml-[70px]' : 'lg:ml-[240px]',
        ].join(' ')}
      >
        {/* ── Top bar ────────────────────────────── */}
        <header className="sticky top-0 z-20 h-14 flex items-center gap-3 px-4 lg:px-6 bg-white/80 backdrop-blur-sm border-b border-slate-100 shadow-soft">
          {/* Hamburger — mobile only */}
          <button
            id="hamburger-btn"
            onClick={handleMobileOpen}
            aria-label="Open navigation menu"
            aria-controls="main-sidebar"
            aria-expanded={isMobileOpen}
            className="lg:hidden p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right-side actions */}
          <div className="flex items-center gap-2">
            {/* Global search */}
            <div className="hidden sm:flex items-center relative">
              <input
                id="global-search"
                type="text"
                placeholder="Search…"
                aria-label="Global search"
                className="w-40 lg:w-56 pl-9 pr-4 py-2 text-sm
                           bg-slate-50 border border-slate-200 rounded-xl
                           placeholder:text-slate-400 text-slate-700
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                           transition-all duration-200"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Notification bell */}
            <button
              id="notification-btn"
              aria-label="View notifications"
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {/* Unread dot */}
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* ── Page content ───────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
