(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('folderLab') !== '1') return

  document.documentElement.classList.add('oanix-folder-card-lab')

  const VARIANTS = ['a', 'b', 'c', 'd']

  function makeLabel(letter, name) {
    const label = document.createElement('span')
    label.className = 'oanix-folder-lab__label'
    label.textContent = `${letter.toUpperCase()} · ${name}`
    label.setAttribute('aria-hidden', 'true')
    return label
  }

  function wrap(nodes, className) {
    const wrapper = document.createElement('span')
    wrapper.className = className
    nodes.forEach((node) => wrapper.appendChild(node))
    return wrapper
  }

  function buildCard(card, customIndex) {
    if (card.dataset.folderLabBuilt === 'true') return

    const open = card.querySelector(':scope > .oanix-folder-card__open')
    const menu = card.querySelector(':scope > .oanix-folder-card__menu')
    if (!open || !menu) return

    const visual = open.querySelector(':scope > .oanix-folder-card__visual')
    const title = open.querySelector(':scope > strong')
    const meta = open.querySelector(':scope > small')
    if (!visual || !title || !meta) return

    const variant = VARIANTS[customIndex % VARIANTS.length]
    card.dataset.folderLabVariant = variant
    card.dataset.folderLabBuilt = 'true'
    open.classList.add('oanix-folder-lab__open')

    if (variant === 'a') {
      const content = wrap([title, meta], 'oanix-folder-lab__cinema-content')
      const shade = document.createElement('span')
      shade.className = 'oanix-folder-lab__cinema-shade'
      shade.setAttribute('aria-hidden', 'true')
      open.replaceChildren(visual, shade, content)
      card.appendChild(makeLabel('A', 'CINEMA'))
      return
    }

    if (variant === 'b') {
      const info = wrap([title, meta], 'oanix-folder-lab__editorial-info')
      const arrow = document.createElement('span')
      arrow.className = 'oanix-folder-lab__editorial-arrow'
      arrow.textContent = '→'
      arrow.setAttribute('aria-hidden', 'true')
      info.appendChild(arrow)
      open.replaceChildren(visual, info)
      card.appendChild(makeLabel('B', 'EDITORIAL'))
      return
    }

    if (variant === 'c') {
      const glass = wrap([title, meta], 'oanix-folder-lab__glass-panel')
      const eyebrow = document.createElement('span')
      eyebrow.className = 'oanix-folder-lab__glass-eyebrow'
      eyebrow.textContent = 'OANIX SPACE'
      eyebrow.setAttribute('aria-hidden', 'true')
      glass.prepend(eyebrow)
      open.replaceChildren(visual, glass)
      card.appendChild(makeLabel('C', 'GLASS'))
      return
    }

    const identity = document.createElement('span')
    identity.className = 'oanix-folder-lab__future-id'
    identity.textContent = String(customIndex + 1).padStart(2, '0')
    identity.setAttribute('aria-hidden', 'true')
    const info = wrap([title, meta], 'oanix-folder-lab__future-info')
    const rail = document.createElement('span')
    rail.className = 'oanix-folder-lab__future-rail'
    rail.setAttribute('aria-hidden', 'true')
    open.replaceChildren(identity, visual, info, rail)
    card.appendChild(makeLabel('D', 'OANIX'))
  }

  function buildLab() {
    document.querySelectorAll('.oanix-folder-grid__cards').forEach((grid) => {
      const cards = Array.from(grid.querySelectorAll(':scope > .oanix-folder-card--custom'))
      cards.forEach((card, index) => buildCard(card, index))
    })
  }

  buildLab()

  const observer = new MutationObserver(() => buildLab())
  observer.observe(document.documentElement, { childList: true, subtree: true })
})()
