import { requireSuperAdmin } from '@/lib/superadmin'
import { OrgsAdmin } from './OrgsAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminOrgsPage() {
  await requireSuperAdmin()
  return <OrgsAdmin />
}
