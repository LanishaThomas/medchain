'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Types ─────────────────────────────────────────── */
type UserRole = 'super_admin' | 'hospital_admin' | 'doctor' | 'patient' | 'caregiver';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

interface RoleConfig {
  gradient: string;         // Tailwind gradient for brand pill
  accentBg: string;         // Active item bg  e.g. 'bg-indigo-50'
  accentText: string;       // Active item text e.g. 'text-indigo-700'
  accentIcon: string;       // Active icon colour
  label: string;
  badgeBg: string;
  navItems: NavItem[];
}

/* ─── Role Configuration ────────────────────────────── */
const roleConfig: Record<UserRole, RoleConfig> = {
  super_admin: {
    gradient:   'from-red-500 to-rose-600',
    accentBg:   'bg-red-50',
    accentText: 'text-red-700',
    accentIcon: 'text-red-600',
    label:      'Super Admin',
    badgeBg:    'bg-red-100 text-red-700',
    navItems: [
      { name: 'Dashboard',         href: '/dashboard/admin',           icon: <HomeIcon /> },
      { name: 'Verify Hospitals',  href: '/dashboard/admin/hospitals',  icon: <BuildingIcon /> },
      { name: 'Verify Doctors',    href: '/dashboard/admin/doctors',    icon: <UserCheckIcon /> },
      { name: 'Analytics',         href: '/dashboard/admin/analytics',  icon: <ChartIcon /> },
      { name: 'Users',             href: '/dashboard/admin/users',      icon: <UsersIcon /> },
      { name: 'Helplines',         href: '/dashboard/admin/helplines',  icon: <PhoneIcon /> },
      { name: 'Emergency',         href: '/dashboard/admin/emergency',  icon: <AlertIcon /> },
      { name: 'Settings',          href: '/dashboard/admin/settings',   icon: <SettingsIcon /> },
    ],
  },
  hospital_admin: {
    gradient:   'from-violet-600 to-purple-700',
    accentBg:   'bg-violet-50',
    accentText: 'text-violet-700',
    accentIcon: 'text-violet-600',
    label:      'Hospital Admin',
    badgeBg:    'bg-violet-100 text-violet-700',
    navItems: [
      { name: 'Dashboard',           href: '/dashboard/hospital',                       icon: <HomeIcon /> },
      { name: 'Doctor Applications', href: '/dashboard/hospital?section=applications',  icon: <UserCheckIcon /> },
      { name: 'Emergency Access',    href: '/dashboard/hospital?section=emergency',     icon: <AlertIcon /> },
    ],
  },
  doctor: {
    gradient:   'from-blue-600 to-blue-700',
    accentBg:   'bg-blue-50',
    accentText: 'text-blue-700',
    accentIcon: 'text-blue-600',
    label:      'Doctor',
    badgeBg:    'bg-blue-100 text-blue-700',
    navItems: [
      { name: 'Dashboard',       href: '/dashboard/doctor',                              icon: <HomeIcon /> },
      { name: 'Appointments',    href: '/dashboard/doctor?section=appointments',         icon: <CalendarIcon /> },
      { name: 'Prescriptions',   href: '/dashboard/doctor?section=prescriptions',        icon: <PrescriptionIcon /> },
      { name: 'Patient Records', href: '/dashboard/doctor?section=patient-records',      icon: <DocumentIcon /> },
      { name: 'Request Access',  href: '/dashboard/doctor?section=request-access',       icon: <ShieldIcon /> },
      { name: 'Hospital Apps',   href: '/dashboard/doctor?section=applications',         icon: <BuildingIcon /> },
      { name: 'Profile',         href: '/dashboard/doctor?section=profile',              icon: <UserIcon /> },
    ],
  },
  patient: {
    gradient:   'from-green-600 to-green-700',
    accentBg:   'bg-green-50',
    accentText: 'text-green-700',
    accentIcon: 'text-green-600',
    label:      'Patient',
    badgeBg:    'bg-green-100 text-green-700',
    navItems: [
      { name: 'Dashboard',      href: '/dashboard/patient',                       icon: <HomeIcon /> },
      { name: 'My Records',     href: '/dashboard/patient?section=records',       icon: <DocumentIcon /> },
      { name: 'Appointments',   href: '/dashboard/patient?section=appointments',  icon: <CalendarIcon /> },
      { name: 'Prescriptions',  href: '/dashboard/patient?section=prescriptions', icon: <PrescriptionIcon /> },
      { name: 'Access Control', href: '/dashboard/patient?section=permissions',   icon: <ShieldIcon /> },
      { name: 'Emergency QR',   href: '/dashboard/patient?section=emergency',     icon: <QRIcon /> },
      { name: 'AI Health Bot',  href: '/chatbot',                                 icon: <BotIcon /> },
      { name: 'Mental Health',  href: '/dashboard/patient?section=mental-health', icon: <HeartIcon /> },
      { name: 'Profile',        href: '/dashboard/patient?section=profile',       icon: <UserIcon /> },
    ],
  },
};

/* ─── Props ─────────────────────────────────────────── */
interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

/* ─── Component ─────────────────────────────────────── */
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sidebarRef = useRef<HTMLElement>(null);

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) onMobileClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onMobileClose]);

  if (!user) return null;

  const role = user.role as UserRole;
  const config = roleConfig[role] ?? roleConfig.patient;
  const initials = `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase();
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

  return (
    <>
      {/* ── Mobile Overlay ─────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={onMobileClose}
        className={[
          'fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden',
          'transition-opacity duration-300',
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* ── Sidebar Panel ──────────────────────────── */}
      <aside
        ref={sidebarRef}
        id="main-sidebar"
        aria-label="Main navigation"
        className={[
          /* Base */
          'fixed inset-y-0 left-0 z-40 flex flex-col',
          'bg-white border-r border-slate-100 shadow-sidebar',

          /* Width — desktop collapses, mobile overlays */
          'transition-[width,transform] duration-300 ease-in-out',
          isCollapsed ? 'w-[70px]' : 'w-[240px]',

          /* Mobile: slide in/out */
          'lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        {/* ── Brand Header ───────────────────────── */}
        <div className="flex items-center h-16 px-3 border-b border-slate-100 flex-shrink-0">
          {/* Logo pill */}
          <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          {/* Brand name — hidden when collapsed */}
          <span
            className={[
              'ml-3 text-base font-bold text-slate-800 whitespace-nowrap',
              'transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            ].join(' ')}
          >
            MedChain
          </span>

          {/* Collapse toggle — desktop only */}
          <button
            id="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'hidden lg:flex items-center justify-center',
              'ml-auto p-1.5 rounded-lg',
              'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
              'transition-colors duration-150',
            ].join(' ')}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* ── Role Badge ──────────────────────────── */}
        <div className={[
          'mx-3 mt-3 mb-1 overflow-hidden transition-all duration-300',
          isCollapsed ? 'opacity-0 h-0 mt-0 mb-0 mx-0' : 'opacity-100 h-auto',
        ].join(' ')}>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.badgeBg}`}>
            {config.label}
          </span>
        </div>

        {/* ── Navigation ──────────────────────────── */}
        <nav className="flex-1 overflow-y-auto sidebar-nav px-3 py-2 space-y-0.5">
          {config.navItems.map((item) => {
            const active = (() => {
              if (item.href.includes('?section=')) {
                const [hrefPath, hrefQuery] = item.href.split('?');
                const hrefSection = new URLSearchParams(hrefQuery).get('section');
                return pathname === hrefPath && searchParams.get('section') === hrefSection;
              }
              const dashRoots = ['/dashboard/patient', '/dashboard/doctor', '/dashboard/hospital'];
              if (dashRoots.includes(item.href)) {
                return pathname === item.href && !searchParams.get('section');
              }
              return pathname === item.href || pathname.startsWith(item.href + '/');
            })();
            return (
              <Link
                key={item.name}
                href={item.href}
                id={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                title={isCollapsed ? item.name : undefined}
                className={[
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  'text-sm font-medium',
                  'transition-all duration-150 ease-in-out relative',
                  active
                    ? `${config.accentBg} ${config.accentText} shadow-sm`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')}
              >
                {/* Active indicator bar */}
                {active && (
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b ${config.gradient}`} />
                )}

                {/* Icon */}
                <span className={[
                  'w-5 h-5 flex-shrink-0 transition-colors duration-150',
                  active ? config.accentIcon : 'text-slate-400 group-hover:text-slate-600',
                ].join(' ')}>
                  {item.icon}
                </span>

                {/* Label */}
                <span className={[
                  'whitespace-nowrap overflow-hidden transition-all duration-300',
                  isCollapsed ? 'opacity-0 w-0' : 'opacity-100',
                ].join(' ')}>
                  {item.name}
                </span>

                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <span className={[
                    'absolute left-full ml-3 px-2.5 py-1.5 z-50',
                    'bg-slate-800 text-white text-xs font-medium rounded-lg',
                    'whitespace-nowrap pointer-events-none',
                    'opacity-0 group-hover:opacity-100',
                    'translate-x-1 group-hover:translate-x-0',
                    'transition-all duration-150',
                    'shadow-medium',
                  ].join(' ')}>
                    {item.name}
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── User Footer ─────────────────────────── */}
        <div className="border-t border-slate-100 p-3 flex-shrink-0">
          <div className={[
            'flex items-center gap-3 mb-2',
            isCollapsed ? 'justify-center' : '',
          ].join(' ')}>
            {/* Avatar */}
            <div className={`h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-xs font-bold">{initials || '?'}</span>
            </div>
            {/* Name + email */}
            <div className={[
              'flex-1 min-w-0 overflow-hidden',
              'transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0' : 'opacity-100',
            ].join(' ')}>
              <p className="text-sm font-semibold text-slate-800 truncate">{fullName}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Sign out button */}
          <button
            id="sidebar-logout-btn"
            onClick={logout}
            aria-label="Sign out"
            title={isCollapsed ? 'Sign out' : undefined}
            className={[
              'flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl',
              'text-sm font-medium text-slate-600',
              'bg-slate-50 hover:bg-red-50 hover:text-red-600',
              'border border-slate-100 hover:border-red-100',
              'transition-all duration-150',
            ].join(' ')}
          >
            <LogoutIcon />
            <span className={[
              'transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            ].join(' ')}>
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── SVG Icons ─────────────────────────────────────── */
function HomeIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PatientIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function PrescriptionIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function QRIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function CaregiverIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4 flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
