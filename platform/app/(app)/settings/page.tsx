import { getOrgContext } from '@/lib/org'
import { db } from '@/server/db'
import { SettingsView } from './SettingsView'
import { ProfileForm } from './ProfileForm'
import { TelegramConnect } from './TelegramConnect'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const { user, activeOrg, orgs } = await getOrgContext()
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: {
      name: true, email: true, title: true, bio: true, image: true,
      telegramUserId: true, telegramUsername: true, telegramLinkedAt: true,
    },
  })
  return (
    <SettingsView
      userName={profile?.name || user.email || 'You'}
      email={user.email}
      role={activeOrg.role}
      orgName={activeOrg.name}
      orgCount={orgs.length}
      profileForm={
        <ProfileForm
          userId={user.id}
          initial={{
            name: profile?.name || '',
            email: user.email,
            title: profile?.title ?? null,
            bio: profile?.bio ?? null,
            image: profile?.image ?? null,
          }}
        />
      }
      telegramConnect={
        <TelegramConnect
          initial={{
            linked: profile?.telegramUserId != null,
            username: profile?.telegramUsername ?? null,
            linkedAt: profile?.telegramLinkedAt
              ? profile.telegramLinkedAt.toISOString().slice(0, 10)
              : null,
          }}
        />
      }
    />
  )
}
