'use client'

import { useState, useEffect } from 'react'
import { SearchPalette } from './search-palette'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      // Also support "/" as a quick search trigger (when not in an input)
      if (e.key === '/' && !open) {
        const active = document.activeElement as HTMLElement | null
        const isInput = active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable
        )
        if (!isInput) {
          e.preventDefault()
          setOpen(true)
        }
      }
    }

    // Custom event so the topbar button can open it
    const onOpenRequest = () => setOpen(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('open-global-search', onOpenRequest)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('open-global-search', onOpenRequest)
    }
  }, [open])

  return <SearchPalette open={open} onClose={() => setOpen(false)} />
}
