import { requireSuperAdmin } from '@/lib/superadmin'
import { UsersAdmin } from './UsersAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const me = await requireSuperAdmin()
  return <UsersAdmin meId={me.id} />
}
