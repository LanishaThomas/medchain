'use client';

import { useState, useCallback, Suspense } from 'react';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => setIsCollapsed((c) => !c), []);
  const handleMobileOpen    = useCallback(() => setIsMobileOpen(true),  []);
  const handleMobileClose   = useCallback(() => setIsMobileOpen(false), []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar wrapped in Suspense — required for useSearchParams inside Sidebar */}
      <Suspense fallback={
        <div className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-100 ${isCollapsed ? 'w-[70px]' : 'w-[240px]'}`} />
      }>
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          isMobileOpen={isMobileOpen}
          onMobileClose={handleMobileClose}
        />
      </Suspense>

      {/* Main area shifts right by sidebar width */}
      <div
        className={[
          'flex flex-col flex-1 min-w-0',
          'transition-[margin] duration-300 ease-in-out',
          isCollapsed ? 'lg:ml-[70px]' : 'lg:ml-[240px]',
        ].join(' ')}
      >
        {/* ── Top bar ── */}
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

          {/* Desktop collapse toggle — always visible */}
          <button
            id="topbar-collapse-btn"
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-2 -ml-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button id="notification-btn" aria-label="View notifications"
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
