type OanixMenuDismissWindow = Window & {
  __oanixNoteMenuScrollDismissInstalled?: boolean
}

function eventComesFromNoteList(event: Event): boolean {
  const target = event.target
  return target instanceof Element && target.closest('.notes-list') !== null
}

function closeOpenNoteRowMenu() {
  const openButton = document.querySelector<HTMLButtonElement>(
    '.note-row__menu-button[aria-expanded="true"]',
  )
  openButton?.click()
}

export function installNoteMenuScrollDismiss() {
  const oanixWindow = window as OanixMenuDismissWindow
  if (oanixWindow.__oanixNoteMenuScrollDismissInstalled) return

  const dismissFromListMovement = (event: Event) => {
    if (!eventComesFromNoteList(event)) return
    closeOpenNoteRowMenu()
  }

  // `scroll` catches mouse/trackpad and the actual mobile list movement.
  // `touchmove` closes the floating menu as soon as the user starts a swipe,
  // before the content has visibly moved behind it.
  document.addEventListener('scroll', dismissFromListMovement, true)
  document.addEventListener('touchmove', dismissFromListMovement, { passive: true })

  oanixWindow.__oanixNoteMenuScrollDismissInstalled = true
}
