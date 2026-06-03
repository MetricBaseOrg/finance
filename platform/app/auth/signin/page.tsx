import { SignInForm } from './signin-form'

export const metadata = { title: 'Sign in · MetricBase' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string }>
}) {
  const { suspended } = await searchParams
  return <SignInForm suspended={suspended === '1'} />
}
