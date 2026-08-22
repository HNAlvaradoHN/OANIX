(() => {
  const ROOT_CLASS = 'oanix-folder-card-carousel'
  document.documentElement.classList.add(ROOT_CLASS)

  let frame = 0

  function enhanceGrid(grid) {
    const cards = Array.from(grid.querySelectorAll(':scope > .oanix-folder-card'))
    cards.forEach((card, index) => {
      card.style.setProperty('--oanix-card-index', String(index))
      card.style.setProperty('--oanix-stack-offset', `${Math.min(index, 3) * 4}px`)
      card.style.setProperty('--oanix-card-z', String(index + 1))
    })
  }

  function enhance() {
    document.querySelectorAll('.oanix-folder-grid__cards').forEach(enhanceGrid)
  }

  function scheduleEnhance() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(enhance)
  }

  enhance()

  const observer = new MutationObserver(scheduleEnhance)
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  window.addEventListener('oanix:local-data-changed', scheduleEnhance)
})()
