# cmdpal

[WIP] An extensible command palette for Google Chrome.

For more information, check out the [project documention page](https://docs.dt.in.th/cmdpal/index.html).

[![Project documention page](https://ss.dt.in.th/api/screenshots/docs-cmdpal__index.png)](https://docs.dt.in.th/cmdpal/index.html)

## Development

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
