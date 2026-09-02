# OANIX continuous sheet — functional inventory

This document freezes the capabilities that must survive the replacement of the Replica V16 visual surface.

## Content types

- Plain writing / text segments.
- Dated entry: title + body + creation timestamp.
- Checklist with multiple items and checked state.
- Contact: name + detail.
- Separator.
- Code block: optional language + code text.
- Image attachment.
- File attachment.

## Attachment presentation

- Open.
- Replace.
- Remove.
- Width / size control.
- Lock / unlock size behavior where supported.
- Alignment: left, center, right.
- Filename visibility.
- Description / caption.
- Information metadata.
- Durable ordering with normal rich content.
- Failed replacement deletion must not resurrect the retired asset.

## Sheet personalization

Current replica options that must remain available in the replacement:

- Plain.
- Ruled.
- Dots.
- Grid.

The replacement may redesign the controls and visual treatment, but it must not silently remove these choices.

## Continuous-writing behavior

The replacement is a single visual document, not a visible technical block editor.

- Writing continues naturally from line to line.
- Inserting any non-text item happens at the active insertion position in the document flow.
- Every inserted item must keep an editable writing position immediately before and immediately after it.
- The user must be able to resume writing above or below an image, entry, code block, contact, checklist, separator or file without exposing block-order arrows or technical `Insertar` separators.
- Structural controls are contextual and visually secondary.
- Mobile menus must fit the viewport and remain usable above browser / keyboard chrome.

## Safety / persistence constraints

- Reuse the existing encrypted attachment storage and EditorBlockSession persistence.
- Do not introduce a parallel persistence layer.
- Do not merge the experimental surface to `main` until visual and physical-mobile review is complete.
