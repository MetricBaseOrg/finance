import { redirect } from "next/navigation";
import { getCurrentUserWorkspaces } from "@/server/workspace";

export default async function AppIndexPage() {
  const memberships = await getCurrentUserWorkspaces();
  if (memberships.length === 0) redirect("/app/onboarding");
  redirect(`/app/${memberships[0].workspace.slug}/dashboard`);
}
