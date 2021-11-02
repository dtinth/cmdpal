import { render, useCallback, useEffect, useState } from 'preact/compat'

type Command = {
  id: string
  title: string
  group: string
  onTrigger: () => void
}

function CommandPalette() {
  const [commands, setCommands] = useState<Array<Command>>([])
  const addCommands = useCallback((group: string, commandsToAdd: Command[]) => {
    setCommands((commands) => {
      return [
        ...commands.filter((command) => command.group !== group),
        ...commandsToAdd,
      ]
    })
  }, [])

  useEffect(() => {
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
                onTrigger: () => {
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
    })
  }, [])

  return (
    <CommandPaletteTypeahead
      commands={commands}
      onSelect={(command) => command.onTrigger()}
    />
  )
}

function CommandPaletteTypeahead(props: {
  onSelect: (command: Command) => void
  commands: Command[]
}) {
  return (
    <>
      <div class="input-font">
        <input id="text" autofocus class="input" />
      </div>
      <ul>
        {props.commands.map((command) => (
          <li onClick={() => props.onSelect(command)} key={command.id}>
            {command.title}
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
