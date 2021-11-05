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
            group: 'linkscopy',
            commands: [
              {
                id: 'linkscopy.copy',
                title: 'Copy All Links',
              },
            ],
          },
        },
      }),
    )
  }
}

addEventListener('cmdpal', async (e) => {
  if (e.detail.execute && e.detail.execute.command === 'linkscopy.copy') {
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
})
