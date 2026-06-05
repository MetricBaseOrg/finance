import { requireMembership, getCurrentUserWorkspaces } from "@/server/workspace";
import { buildAlerts } from "@/server/analytics";
import { AppTopbar } from "@/components/mb/AppTopbar";
import { Sidebar } from "@/components/mb/Sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace, user } = await requireMembership(slug);
  const [memberships, alerts] = await Promise.all([
    getCurrentUserWorkspaces(),
    buildAlerts(workspace.id),
  ]);

  const workspaces = memberships.map((m) => ({
    slug: m.workspace.slug,
    name: m.workspace.name,
    type: m.workspace.type,
    baseCurrency: m.workspace.baseCurrency,
  }));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppTopbar
        current={{
          slug: workspace.slug,
          name: workspace.name,
          type: workspace.type,
          baseCurrency: workspace.baseCurrency,
        }}
        workspaces={workspaces}
        userEmail={user.email}
        alertCount={alerts.length}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar workspaceSlug={workspace.slug} />
        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
