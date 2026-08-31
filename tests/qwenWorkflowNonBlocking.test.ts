import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/qwen-pr-review.yml', 'utf8')
const policy = readFileSync('QWEN.md', 'utf8')

test('automatic Qwen review remains non-blocking when the external reviewer is unavailable', () => {
  assert.match(policy, /workflow automático de Qwen \*\*no es gate técnico\*\*/)
  assert.match(workflow, /Review independently with grounded Qwen prompt[\s\S]*continue-on-error: true/)
  assert.match(workflow, /Validate Qwen grounding[\s\S]*continue-on-error: true/)
  assert.match(workflow, /Report unavailable independent review/)
  assert.match(workflow, /OANIX CI and Android remain the technical gates/)
})

test('a grounded Qwen review is still published normally', () => {
  assert.match(workflow, /Publish Qwen review as PR comment/)
  assert.match(workflow, /if: steps\.validate\.outcome == 'success'/)
  assert.match(workflow, /QWEN_REVIEW\.md/)
})
