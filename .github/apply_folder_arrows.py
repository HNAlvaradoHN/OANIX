from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected marker not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    "  const [folderScrollHint, setFolderScrollHint] = useState<'left' | 'right' | null>(null)\n",
    "  const [folderScrollEdges, setFolderScrollEdges] = useState({ left: false, right: false })\n",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """      const overflow = tabs.scrollWidth > tabs.clientWidth + 4
      if (!overflow) {
        setFolderScrollHint(null)
        return
      }
      const hasRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4
      setFolderScrollHint(hasRight ? 'right' : tabs.scrollLeft > 4 ? 'left' : null)
""",
    """      const overflow = tabs.scrollWidth > tabs.clientWidth + 4
      if (!overflow) {
        setFolderScrollEdges({ left: false, right: false })
        return
      }
      setFolderScrollEdges({
        left: tabs.scrollLeft > 4,
        right: tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4,
      })
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """    setNoteMenuId(noteId)
  }

  return (
""",
    """    setNoteMenuId(noteId)
  }

  function scrollFolderTabs(direction: 'left' | 'right') {
    const tabs = folderTabsRef.current
    if (!tabs) return
    const distance = Math.max(160, Math.round(tabs.clientWidth * 0.72))
    tabs.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    })
  }

  return (
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """        <div className={`notes-tabs-shell${folderScrollHint ? ` notes-tabs-shell--hint-${folderScrollHint}` : ''}`}>
          <nav
""",
    """        <div className=\"notes-tabs-shell\">
          <button
            className=\"notes-tabs-scroll-button notes-tabs-scroll-button--left\"
            type=\"button\"
            onClick={() => scrollFolderTabs('left')}
            disabled={!folderScrollEdges.left}
            aria-label=\"Ver carpetas anteriores\"
            title=\"Carpetas anteriores\"
          >
            «
          </button>
          <nav
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """            onScroll={() => {
              const tabs = folderTabsRef.current
              if (!tabs) return
              const hasRight = tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4
              setFolderScrollHint(hasRight ? 'right' : tabs.scrollLeft > 4 ? 'left' : null)
            }}
""",
    """            onScroll={() => {
              const tabs = folderTabsRef.current
              if (!tabs) return
              const overflow = tabs.scrollWidth > tabs.clientWidth + 4
              setFolderScrollEdges({
                left: overflow && tabs.scrollLeft > 4,
                right: overflow && tabs.scrollLeft + tabs.clientWidth < tabs.scrollWidth - 4,
              })
            }}
""",
)

replace_once(
    'src/features/notes/NotesWorkspace.tsx',
    """          </nav>
          {folderScrollHint && (
            <span className=\"notes-tabs-scroll-hint\" aria-hidden=\"true\">
              {folderScrollHint === 'right' ? 'Desliza →' : '← Desliza'}
            </span>
          )}
        </div>
""",
    """          </nav>
          <button
            className=\"notes-tabs-scroll-button notes-tabs-scroll-button--right\"
            type=\"button\"
            onClick={() => scrollFolderTabs('right')}
            disabled={!folderScrollEdges.right}
            aria-label=\"Ver carpetas siguientes\"
            title=\"Carpetas siguientes\"
          >
            »
          </button>
        </div>
""",
)

css = Path('src/features/notes/notes.css')
text = css.read_text(encoding='utf-8')
start = text.index('/* Folder navigation polish */')
new_css = r'''/* Folder navigation polish */
.notes-tabs-shell {
  min-width: 0;
  display: grid;
  grid-template-columns: 2.35rem minmax(0, 1fr) 2.35rem;
  align-items: stretch;
  border-bottom: 1px solid #e8edf2;
  background: #fff;
}
.notes-tabs-shell .notes-tabs {
  min-width: 0;
  border-bottom: 0;
  padding-inline: .2rem;
  scroll-behavior: smooth;
}
.notes-tabs-scroll-button {
  position: relative;
  z-index: 2;
  width: 100%;
  min-width: 0;
  min-height: 2.9rem;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: #fff;
  color: #2563eb;
  font: inherit;
  font-size: 1.45rem;
  font-weight: 850;
  line-height: 1;
  transition: background .16s ease, color .16s ease, opacity .16s ease;
}
.notes-tabs-scroll-button--left { border-right: 1px solid #edf1f5; }
.notes-tabs-scroll-button--right { border-left: 1px solid #edf1f5; }
.notes-tabs-scroll-button:hover:not(:disabled),
.notes-tabs-scroll-button:focus-visible:not(:disabled) {
  outline: none;
  background: #eef4ff;
  color: #1d4ed8;
}
.notes-tabs-scroll-button:disabled {
  opacity: 0;
  pointer-events: none;
}
.folder-list__order { display: inline-flex; gap: .25rem; }
.folder-list__order button { width: 2.35rem; padding-inline: 0; font-size: 1rem; }

@media (max-width: 420px) {
  .notes-tabs-shell { grid-template-columns: 2.15rem minmax(0, 1fr) 2.15rem; }
  .notes-tabs-scroll-button { font-size: 1.3rem; }
}
'''
css.write_text(text[:start].rstrip() + '\n\n' + new_css, encoding='utf-8')

Path('tests/folderNavigationControls.test.ts').write_text(r'''import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('folder overflow uses dedicated click arrows without covering folder tabs', () => {
  const source = readFileSync('src/features/notes/NotesWorkspace.tsx', 'utf8')
  const css = readFileSync('src/features/notes/notes.css', 'utf8')

  assert.doesNotMatch(source, /Desliza/)
  assert.match(source, /Ver carpetas anteriores/)
  assert.match(source, /Ver carpetas siguientes/)
  assert.match(source, /tabs\.scrollBy/)
  assert.match(css, /grid-template-columns:\s*2\.35rem minmax\(0, 1fr\) 2\.35rem/)
  assert.match(css, /notes-tabs-scroll-button:disabled/)
})
''', encoding='utf-8')

change = '- La navegación horizontal de Carpetas usa controles « » reservados fuera del carril, compatibles con mouse y tacto, sin cubrir nombres de carpetas.\n'
changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8')
marker = '## Unreleased\n'
if change not in text:
    text = text.replace(marker, marker + change, 1)
    changelog.write_text(text, encoding='utf-8')
