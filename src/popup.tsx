import {
  forwardRef,
  render,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'preact/compat'
import { go, highlight } from 'fuzzysort'
import { ComponentProps } from 'preact/src/index.js'

type Command = {
  id: string
  title: string
  group?: string
  onTrigger: () => Promise<false | void>
  description?: string
  detail?: string
  iconUrl?: string
}

function CommandPalette() {
  const typeaheadRef = useRef<any>(null)
  const [commands, setCommands] = useState<Array<Command>>([])
  const [tabCommands, setTabCommands] = useState<Array<Command>>([])
  const [bookmarkCommands, setBookmarkCommands] = useState<Array<Command>>([])
  const [bookmarkSearchResultCommands, setBookmarkSearchResultCommands] =
    useState<Array<Command>>([])
  const [currentText, setCurrentText] = useState('>')

  const setInputText = useCallback((text: string) => {
    setCurrentText(text)
    typeaheadRef.current.setInputText(text)
  }, [])

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

    chrome.bookmarks.getRecent(100, (bookmarks) => {
      const bookmarkCommands = bookmarksToCommands(bookmarks)
      setBookmarkCommands(bookmarkCommands)
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
                id: command.id,
                title: command.title,
                description: command.description,
                detail: command.detail,
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
      const result = await command.onTrigger()
      if (result !== false) {
        window.close()
      }
    },
    [],
  )

  type TypeaheadProps = Pick<
    ComponentProps<typeof CommandPaletteTypeahead>,
    'commands' | 'updateDelay' | 'showRecentWhenNoQueryText' | 'stripPrefix'
  >

  const commandMode = currentText.startsWith('>')
  const commandsTypeahead = useMemo((): TypeaheadProps | undefined => {
    if (!commandMode) return
    return {
      commands: commands,
      updateDelay: 128,
      showRecentWhenNoQueryText: true,
      stripPrefix: 1,
    }
  }, [commandMode, commands])

  const bookmarkMode = currentText.startsWith('#')
  const bookmarksTypeahead = useMemo((): TypeaheadProps | undefined => {
    if (!bookmarkMode) return
    const ids = new Set(bookmarkCommands.map((command) => command.id))
    return {
      commands: [
        ...bookmarkCommands,
        ...bookmarkSearchResultCommands.filter(
          (command) => !ids.has(command.id),
        ),
      ],
      updateDelay: 0,
      showRecentWhenNoQueryText: false,
      stripPrefix: 1,
    }
  }, [bookmarkMode, bookmarkCommands, bookmarkSearchResultCommands])
  useEffect(() => {
    if (!bookmarkMode) return
    const searchQuery = currentText.slice(1)
    if (!searchQuery) return
    chrome.bookmarks.search(searchQuery, (bookmarks) => {
      setBookmarkSearchResultCommands(bookmarksToCommands(bookmarks))
    })
  }, [bookmarkMode, currentText])

  const helpMode = currentText.startsWith('?')
  const helpTypeahead = useMemo((): TypeaheadProps | undefined => {
    if (!helpMode) return
    return {
      commands: [
        {
          id: 'help.tabs',
          title: '…',
          description: 'Search Open Tabs',
          onTrigger: async () => {
            setInputText('')
            return false
          },
        },
        {
          id: 'help.cmd',
          title: '>',
          description: 'Show and Run Commands',
          onTrigger: async () => {
            setInputText('>')
            return false
          },
        },
        {
          id: 'help.bookmark',
          title: '#',
          description: 'Search Bookmarks',
          onTrigger: async () => {
            setInputText('#')
            return false
          },
        },
      ],
      updateDelay: 0,
      showRecentWhenNoQueryText: false,
      stripPrefix: 1,
    }
  }, [helpMode])

  const tabsTypeahead = useMemo((): TypeaheadProps => {
    return {
      commands: tabCommands,
      updateDelay: 0,
      showRecentWhenNoQueryText: false,
      stripPrefix: 0,
    }
  }, [tabCommands])

  const typeaheadProps =
    commandsTypeahead || helpTypeahead || bookmarksTypeahead || tabsTypeahead

  return (
    <CommandPaletteTypeahead
      {...typeaheadProps}
      onSelect={onCommandSelect}
      defaultText=">"
      onTextChanged={setCurrentText}
      typeaheadRef={typeaheadRef}
    />
  )
}

type ResultViewModel = {
  commands: Command[]
  searchedText: string
  selectedIndex: number
}

function bookmarksToCommands(bookmarks: chrome.bookmarks.BookmarkTreeNode[]) {
  return bookmarks.flatMap((bookmark): Command[] => {
    if (!bookmark.url) return []
    return [
      {
        id: `bookmark-${bookmark.id}`,
        title: bookmark.title,
        detail: bookmark.url,
        onTrigger: async () => {
          chrome.tabs.create({ url: bookmark.url })
        },
      },
    ]
  })
}

function CommandPaletteTypeahead(props: {
  onSelect: (command: Command) => void
  updateDelay: number
  showRecentWhenNoQueryText: boolean
  stripPrefix: number
  onTextChanged?: (text: string) => void
  defaultText: string
  commands: Command[]
  typeaheadRef: any
}) {
  const input = useRef<HTMLInputElement>()
  const defaultTextRef = useRef(props.defaultText)
  const [currentText, setCurrentText] = useState(props.defaultText)
  const [result, setResult] = useState<ResultViewModel>({
    commands: props.commands,
    selectedIndex: 0,
    searchedText: '',
  })

  props.typeaheadRef.current = useMemo(
    () => ({
      setInputText: (text: string) => {
        setCurrentText(text)
        input.current.value = text
      },
    }),
    [],
  )

  useEffect(() => {
    input.current.value = defaultTextRef.current
  }, [])

  useEffect(() => {
    const searchText = currentText.substring(props.stripPrefix).trim()
    setResult((result) => {
      const nextCommands = filterCommands(searchText, props.commands)
      const nextSelectedIndex =
        result.searchedText === searchText
          ? reconcileSelectedIndex(
              result.commands,
              nextCommands,
              result.selectedIndex,
            )
          : 0
      return {
        commands: nextCommands,
        selectedIndex: nextSelectedIndex,
        searchedText: searchText,
      }
    })
  }, [props.commands, props.stripPrefix, currentText])

  const onChange = useCallback(() => {
    const value = input.current.value
    props.onTextChanged?.(value)
    setCurrentText(value)
  }, [props.onTextChanged])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          setResult(selectResultAbove)
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          setResult(selectResultBelow)
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (result.commands.length > 0) {
            const command = result.commands[result.selectedIndex]
            if (command) {
              props.onSelect(command)
            }
          }
          break
        }
      }
    },
    [props, result],
  )

  return (
    <>
      <div className="input-font">
        <input
          id="text"
          autofocus
          class="input"
          ref={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="result-container">
        <ul className="listbox">
          {result.commands.map((command, index) => (
            <li
              data-selected={index === result.selectedIndex}
              className="listbox-item hbox"
              onClick={() => props.onSelect(command)}
              key={command.id}
            >
              {!!command.iconUrl && (
                <img src={command.iconUrl} height={16} width={16} />
              )}
              <div>
                {command.title}
                {!!command.description && (
                  <span className="dim">&nbsp; {command.description}</span>
                )}
                {!!command.detail && (
                  <div className="dim">{command.detail}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

render(<CommandPalette />, document.querySelector('#cmdpal'))

type CmdpalEvent = {
  detail: {
    register?: {
      commands: {
        id: string
        title: string
        description?: string
        detail?: string
      }[]
      group: string
    }
    execute?: {
      command: string
    }
  }
}

function filterCommands(searchText: string, commands: Command[]) {
  if (!searchText) return commands
  const results = go(searchText, commands, { key: 'title' })
  return results.map((r) => r.obj)
}

function reconcileSelectedIndex(
  commands: Command[],
  nextCommands: Command[],
  selectedIndex: number,
) {
  if (selectedIndex < 0) return 0
  const originallySelectedCommand = commands[selectedIndex]
  if (!originallySelectedCommand) return 0
  const nextSelectedCommandIndex = nextCommands.findIndex(
    (command: Command) => command.id === originallySelectedCommand.id,
  )
  if (nextSelectedCommandIndex === -1) return 0
  return nextSelectedCommandIndex
}

function selectResultAbove(result: ResultViewModel): ResultViewModel {
  if (result.selectedIndex === 0) {
    return { ...result, selectedIndex: Math.max(0, result.commands.length - 1) }
  } else {
    return { ...result, selectedIndex: result.selectedIndex - 1 }
  }
}

function selectResultBelow(result: ResultViewModel): ResultViewModel {
  if (result.selectedIndex >= result.commands.length - 1) {
    return { ...result, selectedIndex: 0 }
  } else {
    return { ...result, selectedIndex: result.selectedIndex + 1 }
  }
}
