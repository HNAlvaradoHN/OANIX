from pathlib import Path

code = Path('src/features/editor/CodeBlockEditor.tsx')
text = code.read_text(encoding='utf-8')
old = '''  const sourceContent = block.querySelector<HTMLElement>('[data-code-content="true"]')
  const sourceLanguage = block.querySelector<HTMLSelectElement>('[data-code-language="true"]')
  if (!editor || !sourceContent || !sourceLanguage) return null

  const backdrop = document.createElement('div')
'''
new = '''  const sourceContent = block.querySelector<HTMLElement>('[data-code-content="true"]')
  const sourceLanguage = block.querySelector<HTMLSelectElement>('[data-code-language="true"]')
  if (!editor || !sourceContent || !sourceLanguage) return null
  const sourceContentElement: HTMLElement = sourceContent
  const sourceLanguageElement: HTMLSelectElement = sourceLanguage

  const backdrop = document.createElement('div')
'''
if old not in text:
    raise SystemExit('Code dialog guard marker not found')
text = text.replace(old, new, 1)
text = text.replace('const language = sourceLanguage.cloneNode(true) as HTMLSelectElement', 'const language = sourceLanguageElement.cloneNode(true) as HTMLSelectElement', 1)
text = text.replace('language.value = sourceLanguage.value', 'language.value = sourceLanguageElement.value', 1)
text = text.replace('      sourceContent.textContent = textarea.value\n      sourceLanguage.value = language.value\n', '      sourceContentElement.textContent = textarea.value\n      sourceLanguageElement.value = language.value\n', 1)
text = text.replace('      Array.from(sourceLanguage.options).forEach((option) => {', '      Array.from(sourceLanguageElement.options).forEach((option) => {', 1)
text = text.replace('      sourceContent.focus()\n      placeCaretAtEnd(sourceContent)\n      sourceContent.dispatchEvent(new Event(\'input\', { bubbles: true }))', '      sourceContentElement.focus()\n      placeCaretAtEnd(sourceContentElement)\n      sourceContentElement.dispatchEvent(new Event(\'input\', { bubbles: true }))', 1)
code.write_text(text, encoding='utf-8')

image = Path('src/features/images/ImageNoteEditor.tsx')
text = image.read_text(encoding='utf-8')
text = text.replace("import { clampImageWidthPercent, defaultImageWidthPercent, isMobileImageViewport, resizeImageWidthPercent } from './imageLayout'", "import { defaultImageWidthPercent, isMobileImageViewport, resizeImageWidthPercent } from './imageLayout'", 1)
old = '''function clampImageWidth(editorWidth: number, widthPercent: number): number {
  return clampImageWidthPercent(editorWidth, widthPercent, usesMobileImageLayout())
}

'''
if old not in text:
    raise SystemExit('Unused clamp helper marker not found')
text = text.replace(old, '', 1)
image.write_text(text, encoding='utf-8')
