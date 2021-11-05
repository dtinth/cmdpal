# cmdpal

[WIP] An extensible command palette for Google Chrome.

## What it is?

cmdpal is a Chrome extension that gives you command palette.
This extension is designed to be minimal and cannot do anything much on its own.
It’s designed to be extended by other extensions and websites.
Therefore, the core extension does not require permissions like “read and change your data on the websites you visit.”

## How to develop the extension

```sh
# Install Rush
npm install --global @microsoft/rush

# Install dependencies
rush update

# Build the extension
rush build
```

To automatically compile the extension when you save a file, open the repository in Visual Studio Code and press Cmd+Shift+B (**Tasks: Run Build Task**).

Install the extension by going to **chrome://extensions**, enable **Developer mode**, click **Load unpacked**, and then select the `cmdpal-extension/extension` folder.

Add a keyboard shortcut by going to **chrome://extensions/shortcuts** and set a shortcut to **Activate the extension**. Personally I use <kbd>⇧⌘,</kbd>. Refresh the page to make sure that you are a keyboard shortcut is saved (this is a Chrome bug). Then restart Chrome for the shortcut to take effect (also a Chrome bug).

## How to extend

**cmdpal** can be extended by communicating with the active tab via DOM events.
This makes **cmdpal** extensible by websites, content scripts, and user scripts.
First, listen to the `cmdpal` event:

```js
addEventListener('cmdpal', (e) => {
  // Your code here
})
```

Wait for user to open the command palette:

```js
addEventListener('cmdpal', (e) => {
  if (e.detail.open) {
    onCommandPaletteOpen()
  }
})
```

When the command palette is open, register available commands to be shown on the command palette:

```js
function onCommandPaletteOpen() {
  dispatchEvent(
    new CustomEvent('cmdpal', {
      detail: {
        register: {
          group: 'hello',
          commands: [
            {
              id: 'custom.hello',
              title: 'Say hello',
              description: '^_^',
              detail: 'Displays an alert',
            },
          ],
        },
      },
    }),
  )
}
```

When the user selects the command, **cmdpal** dispatches the `cmdpal` event with `e.detail.execute`.

```js
addEventListener('cmdpal', (e) => {
  if (e.detail.execute) {
    switch (e.detail.execute.command) {
      case 'custom.hello':
        alert('meow')
        break
    }
  }
})
```

Look at [`testpage.html`](testpage.html) for a complete example.

Look at [`example-integration`](example-integration) for an example of a Chrome extension that uses a content script to integrate with cmdpal.
