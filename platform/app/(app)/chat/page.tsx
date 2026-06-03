import { requireAppAccess } from '@/lib/org'
import { can } from '@/lib/permissions'
import { ChatView } from './ChatView'

export default async function ChatPage() {
  const { user, activeOrg } = await requireAppAccess('chat')
  return (
    <ChatView
      meId={user.id}
      orgName={activeOrg.name}
      canSend={can(activeOrg.role, 'chat.send')}
      canManage={can(activeOrg.role, 'chat.channel.manage')}
    />
  )
}
