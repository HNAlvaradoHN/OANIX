import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CODE_LANGUAGES,
  isNoteRecord,
  normalizeCodeLanguage,
  noteBlocksToPlainText,
  type CodeLanguage,
  type NoteRecord,
} from '../src/features/notes/noteTypes.ts'

const EXPECTED_LANGUAGES: CodeLanguage[] = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'bash',
  'sql',
  'java',
  'cpp',
  'csharp',
  'kotlin',
  'swift',
  'php',
]

const SAMPLE_CODE: Record<CodeLanguage, string> = {
  plaintext: 'línea 1\n\tlínea 2',
  javascript: 'const value = 42;\nconsole.log(value);',
  typescript: 'const value: number = 42;',
  python: 'def hello():\n    print("hola")',
  html: '<script>alert("no ejecutar")</script>',
  css: '.note { display: grid; }',
  json: '{"secure":true,"count":2}',
  bash: 'printf "%s\\n" "hola"',
  sql: 'SELECT * FROM notes WHERE id = 1;',
  java: 'System.out.println("hola");',
  cpp: '#include <iostream>\nstd::cout << "hola";',
  csharp: 'Console.WriteLine("hola");',
  kotlin: 'println("hola")',
  swift: 'print("hola")',
  php: '<?php echo "hola"; ?>',
}

function makeNote(language: CodeLanguage, text: string): NoteRecord {
  return {
    version: 1,
    id: `note-${language}`,
    title: `Prueba ${language}`,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    content: {
      format: 'blocks-v1',
      blocks: [
        {
          id: `code-${language}`,
          type: 'code',
          language,
          text,
        },
      ],
    },
  }
}

test('the code selector exposes the complete expected language contract', () => {
  assert.deepEqual([...CODE_LANGUAGES], EXPECTED_LANGUAGES)
})

test('every code language survives validation with its text unchanged', () => {
  for (const language of CODE_LANGUAGES) {
    const sample = SAMPLE_CODE[language]
    const note = makeNote(language, sample)

    assert.equal(normalizeCodeLanguage(language), language)
    assert.equal(isNoteRecord(note), true, `${language} must be a valid persisted note`)
    assert.equal(noteBlocksToPlainText(note.content.blocks), sample)
  }
})

test('unknown code languages are never persisted silently', () => {
  assert.equal(normalizeCodeLanguage('ruby'), 'plaintext')

  const invalid = makeNote('plaintext', 'puts "hola"') as unknown as {
    content: { blocks: Array<Record<string, unknown>> }
  }
  invalid.content.blocks[0].language = 'ruby'

  assert.equal(isNoteRecord(invalid), false)
})
