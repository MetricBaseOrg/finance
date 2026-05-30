import { redirect } from 'next/navigation'
import { getOrgContext } from '@/lib/org'

// /finance → the active org's finance dashboard.
export default async function FinanceIndex() {
  const { activeOrg } = await getOrgContext()
  redirect(`/finance/${activeOrg.slug}/dashboard`)
}
