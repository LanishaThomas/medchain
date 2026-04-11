import DashboardLayout from '@/components/DashboardLayout';

/**
 * Next.js App Router layout for ALL /dashboard/* routes.
 * Non-invasive: each dashboard page (patient, doctor, hospital) keeps its
 * own tab state and content — this layout just wraps them with the sidebar.
 */
export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
