addEventListener('cmdpal', (e) => {
  if (e.detail.open) {
    onCommandPaletteOpen()
  }
})

function onCommandPaletteOpen() {
  const a = document.querySelectorAll('a')
  if (a.length) {
    dispatchEvent(
      new CustomEvent('cmdpal', {
        detail: {
          register: {
            group: 'example',
            commands: [
              {
                id: 'example.copy-links',
                title: 'Copy All Links',
                detail: 'Copy all tag a links to clipboard',
              },
              {
                id: 'example.search-youtube',
                title: 'Search in youtube',
                detail: 'Search Youtube in a new tab',
                inputBox: {
                  description: "Enter the keyword to search (Press 'Enter' to confirm or 'Escape' to cancel)",
                }
              }
            ],
          },
        },
      }),
    )
  }
}

addEventListener('cmdpal', (e) => {
  if (e.detail.execute) {
    switch (e.detail.execute.command) {
      case 'example.copy-links':
        copyLinksCmd()
        break
      case 'example.search-youtube':
        searchYoutubeCmd(e.detail.execute.textInput)
        break
      default:
    }
  }
})

const copyLinksCmd = async () => {
  try {
    const a = document.querySelectorAll('a')

    // Wait for page to be focused (otherwise the clipboard API would not work).
    await new Promise((resolve) =>
      addEventListener('focus', resolve, { once: true }),
    )

    await navigator.clipboard.writeText([...a].map((a) => a.href).join('\n'))
    alert(`Copied ${a.length} links!`)
  } catch (error) {
    console.error(error)
    alert(`Unable to copy: ${error.message}`)
  }
}

const searchYoutubeCmd = (input) => {
  window.open(`https://www.youtube.com/results?search_query=${input}`, '_blank')
}
