import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { VaultGate } from './VaultGate'
import { NotesWorkspace } from '../features/notes/NotesWorkspace'
import { AccountPanel } from '../features/account/AccountPanel'

function UnlockedApp({ lockVault }: { lockVault: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountHost, setAccountHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setAccountHost(document.querySelector<HTMLElement>('.notes-header__actions'))
  }, [])

  return (
    <>
      <NotesWorkspace onLock={lockVault} />
      {accountHost && createPortal(
        <button
          className="icon-button account-header-action"
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-label="Cuenta de OANIX"
          title="Cuenta de OANIX"
        >
          👤
        </button>,
        accountHost,
      )}
      {accountOpen && <AccountPanel onClose={() => setAccountOpen(false)} />}
    </>
  )
}

export function App() {
  return (
    <VaultGate
      renderUnlocked={(lockVault) => <UnlockedApp lockVault={lockVault} />}
    />
  )
}
