export type CmdpalEvent = {
  detail: {
    /**
     * Fired by cmdpal when the command palette is opened.
     */
    open?: {}

    /**
     * Fired by the page to register commands in the command palette.
     * This only works when the command palette is open.
     */
    register?: {
      /**
       * The command group. This will replace existing commands in the same group.
       */
      group: string

      /**
       * The commands to register.
       */
      commands: {
        /** The command ID */
        id: string

        /** The searchable text for the command. */
        title: string

        /** Extra text that is displayed less prominently next to the command. */
        description?: string

        /** Extra text that is displayed below the command. */
        detail?: string
      }[]
    }

    /**
     * Fired by cmdpal when a command will be executed.
     */
    execute?: {
      command: string
    }
  }
}

export type Command = {
  id: string
  title: string
  group?: string
  onTrigger: () => Promise<false | void>
  description?: string
  detail?: string
  iconUrl?: string
}

export type InputBoxOptions = {
  description: string
}

export type InputBox = {
  options: InputBoxOptions
  callback: (input: string) => void
}
