import { CmdpalEvent, Command, InputBoxOptions } from './types'

export function registerPageCommands(
  tab,
  addCommands: (group: string, commands: Command[]) => void,
  showInputBox: (options: InputBoxOptions) => Promise<string>,
) {
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
            id: command.id,
            title: command.title,
            description: command.description,
            detail: command.detail,
            group: payload.register.group,
            onTrigger: async () => {
              let textInput
              if (command.inputBox != null) {
                textInput = await showInputBox(command.inputBox)
              }
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (command, textInput) => {
                  window.dispatchEvent(
                    new CustomEvent('cmdpal', {
                      detail: {
                        execute: {
                          command: command.id,
                          textInput: textInput,
                        },
                      },
                    }),
                  )
                },
                args: [command, textInput],
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

  addCommands('builtin', [
    {
      id: 'builtin.wolframalpha',
      title: 'Calculate: calculate and explain computational',
      detail: 'Calculate and explain the input using WolframAlpha',
      onTrigger: async () => {
        await showInputBox({
          description:
            "Enter what you want to calculate (Press 'Enter' to confirm or 'Escape' to cancel)",
        }).then((textInput: string) => {
          window.open(`https://www.wolframalpha.com/input/?i=${textInput}`, '_blank')
        })
      },
    },
  ])
}
