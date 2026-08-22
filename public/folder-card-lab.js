(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('folderLab') !== '1') return
  document.documentElement.classList.add('oanix-folder-card-lab')
})()
