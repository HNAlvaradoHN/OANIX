import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('synchronized vault restore exposes a visible moving progress bar while cloud access is busy', () => {
  const progressCss = readFileSync('src/styles/vaultCloudProgress.css', 'utf8')
  const gateSource = readFileSync('src/app/VaultGate.tsx', 'utf8')
  const mainSource = readFileSync('src/main.tsx', 'utf8')
  const authoritySource = readFileSync('src/app/VaultVisualStyles.ts', 'utf8')

  assert.match(gateSource, /id="cloud-master-password"/)
  assert.match(gateSource, /disabled=\{busy \|\| restoreBusy \|\| cloudBusy\}/)
  assert.match(progressCss, /:has\(#cloud-master-password:disabled\)/)
  assert.match(progressCss, /oanixCloudProgressSweep/)
  assert.match(progressCss, /prefers-reduced-motion/)
  assert.doesNotMatch(mainSource, /styles\/vaultCloudProgress\.css/)
  assert.match(mainSource, /app\/VaultVisualStyles/)
  assert.match(authoritySource, /vaultCloudProgress\.css/)
})

test('tablet and desktop keep the compact note card geometry instead of reviving the centered V383 tab', () => {
  const responsiveCss = readFileSync('src/features/notes/responsiveCompactNoteContract.css', 'utf8')
  const mainSource = readFileSync('src/main.tsx', 'utf8')
  const legacyGate = readFileSync('src/app/LegacyWorkspaceRuntimeGate.tsx', 'utf8')
  const visualRuntime = readFileSync('src/features/notes/V383WorkspaceVisualRuntime.tsx', 'utf8')

  assert.match(responsiveCss, /@media \(min-width: 761px\)/)
  assert.match(responsiveCss, /\.note-row:not\(\.note-row--selected\):not\(\.note-row--menu-open\)::before[\s\S]*?display:\s*none !important/)
  assert.match(responsiveCss, /\.note-row__avatar\[data-oanix-note-icon\][\s\S]*?left:\s*14px !important/)
  assert.match(responsiveCss, /\.note-row__avatar\[data-oanix-note-icon\][\s\S]*?top:\s*50% !important/)
  assert.match(responsiveCss, /\.note-row__open[\s\S]*?padding:\s*13px 230px 11px 68px !important/)
  assert.doesNotMatch(mainSource, /responsiveCompactNoteContract\.css/)
  assert.match(visualRuntime, /\.\/responsiveCompactNoteContract\.css/)
  assert.match(legacyGate, /<V383WorkspaceVisualRuntime \/>/)
})
