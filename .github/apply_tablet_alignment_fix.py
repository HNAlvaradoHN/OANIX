from pathlib import Path

css_path = Path('src/features/images/images.css')
css = css_path.read_text(encoding='utf-8')
old = """@container (max-width: 48rem) {
  .image-note-editor-root .editor-surface > .editor-image-block[data-image-compact='true'] {
    float: none !important;
    clear: both;
  }
}
"""
new = """@container (max-width: 48rem) {
  .image-note-editor-root .editor-surface > .editor-image-block[data-image-compact='true'] {
    float: none !important;
    clear: both;
  }

  .image-note-editor-root .editor-surface > .editor-image-block[data-image-compact='true'][data-image-alignment='left'] {
    margin-left: 0;
    margin-right: auto;
  }

  .image-note-editor-root .editor-surface > .editor-image-block[data-image-compact='true'][data-image-alignment='center'] {
    margin-left: auto;
    margin-right: auto;
  }

  .image-note-editor-root .editor-surface > .editor-image-block[data-image-compact='true'][data-image-alignment='right'] {
    margin-left: auto;
    margin-right: 0;
  }
}
"""
if old not in css:
    raise SystemExit('Expected responsive image container block not found')
css_path.write_text(css.replace(old, new, 1), encoding='utf-8')

changelog = Path('docs/CHANGELOG.md')
text = changelog.read_text(encoding='utf-8').rstrip()
entry = '- Corregida la alineación derecha de imágenes compactas cuando una tablet pasa a un contenedor vertical estrecho; al desactivar `float` se restauran márgenes de Izq./Centro/Der. de forma determinista.'
if entry not in text:
    text += '\n\n' + entry
changelog.write_text(text + '\n', encoding='utf-8')
