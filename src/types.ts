export type CmdpalEvent = {
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

export type Command = {
  id: string
  title: string
  group?: string
  onTrigger: () => Promise<false | void>
  description?: string
  detail?: string
  iconUrl?: string
}
