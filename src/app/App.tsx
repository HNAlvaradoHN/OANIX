import { useState } from 'react'
import { VaultGate } from './VaultGate'
import { NotesWorkspace } from '../features/notes/NotesWorkspace'
import { AccountPanel } from '../features/account/AccountPanel'

function UnlockedApp({ lockVault }: { lockVault: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <>
      <NotesWorkspace onLock={lockVault} />
      <button
        className="account-launcher"
        type="button"
        onClick={() => setAccountOpen(true)}
        aria-label="Abrir cuenta de OANIX"
        title="Cuenta de OANIX"
      >
        👤
      </button>
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
