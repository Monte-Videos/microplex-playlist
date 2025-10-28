# Testing Microplex Playlist

## Prerequisites
- Node.js 18 or newer
- npm 9 or newer (bundled with Node.js)

Install project dependencies once:

```bash
npm install
```

## Running the desktop app
Launch the Electron application locally:

```bash
npm start
```

This command opens the Microplex Playlist window so you can exercise the Add File button and drag-and-drop workflows.

## Troubleshooting
If `npm start` fails because Electron cannot find native libraries (common in headless containers), run the command on your local machine where a desktop environment is available.
