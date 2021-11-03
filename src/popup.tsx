import { render, useCallback, useEffect, useRef, useState } from 'preact/compat'

type Command = {
  id: string
  title: string
  group?: string
  onTrigger: () => Promise<void>
  description?: string
  detail?: string
  iconUrl?: string
}

function CommandPalette() {
  const [commands, setCommands] = useState<Array<Command>>([])
  const [tabCommands, setTabCommands] = useState<Array<Command>>([])
  const [currentText, setCurrentText] = useState('>')

  const addCommands = useCallback((group: string, commandsToAdd: Command[]) => {
    setCommands((commands) => {
      return [
        ...commands.filter(
          (command) => !command.group || command.group !== group,
        ),
        ...commandsToAdd,
      ]
    })
  }, [])

  useEffect(() => {
    chrome.tabs.query({}, (tabs) => {
      setTabCommands(
        tabs.map((tab) => {
          return {
            id: `tab-${tab.id}`,
            title: tab.title,
            onTrigger: async () => {
              chrome.tabs.update(tab.id, { active: true })
            },
            detail: tab.url,
            iconUrl: tab.favIconUrl,
            group: 'tabs',
          }
        }),
      )
    })
    chrome.tabs.query({ active: true, currentWindow: true }, function ([tab]) {
      chrome.runtime.onMessage.addListener(function (
        payload: CmdpalEvent['detail'],
        sender,
        sendResponse,
      ) {
        if (!sender.tab || sender.tab.id !== tab.id) {
          return
        }
        if (payload.register) {
          addCommands(
            payload.register.group,
            payload.register.commands.map((command) => {
              return {
                ...command,
                group: payload.register.group,
                onTrigger: async () => {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (command) => {
                      window.dispatchEvent(
                        new CustomEvent('cmdpal', {
                          detail: {
                            execute: { command: command.id },
                          },
                        }),
                      )
                    },
                    args: [command],
                  })
                },
              }
            }),
          )
        }
      })

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (!(window as any).cmdpalRegistered) {
            addEventListener('cmdpal', (e) => {
              const payload = (e as unknown as CmdpalEvent).detail
              if (payload.register) {
                chrome.runtime.sendMessage({ register: payload.register })
              }
            })
            ;(window as any).cmdpalRegistered = true
          }
          window.dispatchEvent(
            new CustomEvent('cmdpal', {
              detail: {
                open: {},
              },
            }),
          )
        },
      })

      if (tab.url) {
        addCommands('builtin', [
          {
            id: 'builtin.copyPageUrl',
            title: 'Copy: Page URL',
            detail: tab.url,
            onTrigger: async () => {
              await navigator.clipboard.writeText(tab.url)
            },
          },
        ])
      }
      if (tab.title) {
        addCommands('builtin', [
          {
            id: 'builtin.copyPageTitle',
            title: 'Copy: Page Title',
            detail: tab.title,
            onTrigger: async () => {
              await navigator.clipboard.writeText(tab.title)
            },
          },
        ])
      }
      if (tab.title && tab.url) {
        const markdown = `[${tab.title}](${tab.url})`
        addCommands('builtin', [
          {
            id: 'builtin.copyPageTitleAndUrl',
            title: 'Copy: Page Title and URL as Markdown',
            detail: markdown,
            onTrigger: async () => {
              await navigator.clipboard.writeText(markdown)
            },
          },
        ])
      }
    })
  }, [])

  const onCommandSelect = useCallback(
    async (command: Command): Promise<void> => {
      await command.onTrigger()
      window.close()
    },
    [],
  )

  return (
    <CommandPaletteTypeahead
      commands={currentText.startsWith('>') ? commands : tabCommands}
      updateDelay={currentText.startsWith('>') ? 128 : 0}
      onSelect={onCommandSelect}
      defaultText=">"
      onTextChanged={setCurrentText}
    />
  )
}

function CommandPaletteTypeahead(props: {
  onSelect: (command: Command) => void
  updateDelay: number
  onTextChanged?: (text: string) => void
  defaultText: string
  commands: Command[]
}) {
  const input = useRef<HTMLInputElement>()
  const defaultText = useRef(props.defaultText)
  useEffect(() => {
    input.current.value = defaultText.current
  }, [])
  const onChange = useCallback(() => {
    props.onTextChanged?.(input.current.value)
  }, [props.onTextChanged])
  return (
    <>
      <div class="input-font">
        <input
          id="text"
          autofocus
          class="input"
          ref={input}
          onChange={onChange}
        />
      </div>
      <ul>
        {props.commands.map((command) => (
          <li onClick={() => props.onSelect(command)} key={command.id}>
            {!!command.iconUrl && (
              <img src={command.iconUrl} height={16} width={16} />
            )}
            {command.title}
            {!!command.description && (
              <span className="dim">&nbsp; {command.description}</span>
            )}
            {!!command.detail && <div className="dim">{command.detail}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}

render(<CommandPalette />, document.querySelector('#cmdpal'))

type CmdpalEvent = {
  detail: {
    register?: {
      commands: { id: string; title: string }[]
      group: string
    }
    execute?: {
      command: string
    }
  }
}
