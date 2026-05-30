import { getOrgContext } from '@/lib/org'
import { SettingsView } from './SettingsView'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { user, activeOrg, orgs } = await getOrgContext()
  return (
    <SettingsView
      userName={user.name || user.email || 'You'}
      email={user.email}
      role={activeOrg.role}
      orgName={activeOrg.name}
      orgCount={orgs.length}
    />
  )
}
