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
import { registerPageCommands } from './PageCommands'
import { Command } from './types'

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
      registerPageCommands(tab, addCommands)
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
