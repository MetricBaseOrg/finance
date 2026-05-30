import { redirect } from 'next/navigation'
import { requireUser, getMemberships } from '@/lib/org'
import { createOrg } from '../(app)/actions'

const inputCls =
  'w-full border border-[var(--border)] bg-[var(--dark)] px-3 py-2 text-sm text-[var(--light)] outline-none focus:border-[var(--gold-dim)]'

export default async function WelcomePage() {
  const user = await requireUser()
  const orgs = await getMemberships(user.id)
  if (orgs.length > 0) redirect('/projects')

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md border border-[var(--border)] bg-[var(--mid)] p-8">
        <span
          className="mb-6 inline-block h-8 w-8 rotate-45 border border-[var(--gold)]"
          style={{ background: 'rgba(201,168,76,0.4)' }}
        />
        <h1 className="text-xl font-bold">Create your organization</h1>
        <p className="mb-6 mt-1 font-[family-name:var(--font-mono)] text-xs text-[var(--subtle)]">
          One organization holds your projects, finances, and field operations.
        </p>
        <form action={createOrg} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Organization name
            </label>
            <input name="name" placeholder="Acme Energy" className={inputCls} required />
          </div>
          <div>
            <label className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Base currency
            </label>
            <select name="baseCurrency" className={inputCls} defaultValue="IDR">
              <option value="IDR">IDR — Indonesian Rupiah</option>
              <option value="USD">USD — US Dollar</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-[var(--gold)] px-3 py-2 text-sm font-bold text-[var(--black)]"
          >
            Create organization
          </button>
        </form>
      </div>
    </main>
  )
}
