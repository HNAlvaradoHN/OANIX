import { VaultGate } from './VaultGate'
import { NotesWorkspace } from '../features/notes/NotesWorkspace'

export function App() {
  return (
    <VaultGate
      renderUnlocked={(lockVault) => <NotesWorkspace onLock={lockVault} />}
    />
  )
}
