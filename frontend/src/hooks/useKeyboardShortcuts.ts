import { useEffect } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description?: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
        const altMatch = shortcut.alt ? event.altKey : !event.altKey
        
        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          event.preventDefault()
          shortcut.action()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export const globalShortcuts: ShortcutConfig[] = [
  {
    key: 'k',
    ctrl: true,
    action: () => {
      // Open command palette (future implementation)
      console.log('Command palette')
    },
    description: 'Open command palette'
  },
  {
    key: '/',
    action: () => {
      // Focus search (future implementation)
      const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement
      searchInput?.focus()
    },
    description: 'Focus search'
  },
  {
    key: 'Escape',
    action: () => {
      // Close modals/dialogs
      const closeButton = document.querySelector('[data-dialog-close]') as HTMLButtonElement
      closeButton?.click()
    },
    description: 'Close dialog'
  }
]