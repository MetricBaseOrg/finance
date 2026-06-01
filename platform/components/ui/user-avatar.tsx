'use client'

import { Avatar, AvatarImage, AvatarFallback } from './avatar'
import { cn } from '@/lib/utils'

interface Props {
  user: { name?: string | null; image?: string | null; email?: string | null }
  className?: string
}

function initials(user: Props['user']) {
  const src = user.name || user.email || '?'
  return src.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function UserAvatar({ user, className }: Props) {
  return (
    <Avatar className={cn('shrink-0', className)}>
      <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
      <AvatarFallback>{initials(user)}</AvatarFallback>
    </Avatar>
  )
}
