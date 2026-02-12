# Local Setup

This guide is written for a first-time setup.
All command-line steps below are run inside the **VS Code Terminal** on Mac (shell: `zsh`).

## 1. Install GitHub Desktop and clone the repository

1. Download and install **GitHub Desktop**: https://desktop.github.com/
2. Open GitHub Desktop and sign in to your GitHub account.
3. In GitHub Desktop, click `File > Clone repository...`.
4. Find `geobtaa.github.io` in the list (or paste the repo URL).
5. Choose where to save it on your computer.
6. Click **Clone**.

At this point, the project is now copied to your computer.

## 2. Install VS Code and extensions

1. Download and install **Visual Studio Code**: https://code.visualstudio.com/
2. Open VS Code.
3. Click the **Extensions** icon on the left sidebar.
4. Install these extensions:
   - `Astro`
   - `MDX`
   - `Markdown All in One`

## 3. The Terminal in VS Code

- VS Code provides access to the Terminal (Command Line) right within the application.
- On Mac, this project uses the `zsh` shell in the VS Code Terminal.
- In VS Code, open it from `Terminal > New Terminal`.
- It appears in the lower part of the window.
- Run every command in this guide there.

## 4. Open the cloned repo in VS Code

1. In VS Code, click `File > Open Folder...`.
2. Select the `geobtaa.github.io` folder you cloned with GitHub Desktop.
3. Click **Open**.

## 5. Install project requirements

This project needs Node.js and its packages.

### Step A: Install Node.js (one-time setup)

Recommended for this project:

1. Install Volta: https://volta.sh/
2. In the VS Code Terminal (`zsh`), run:

```zsh
volta install node@24.13.1
```

### Step B: Install project packages

In the VS Code Terminal (`zsh`) inside the `geobtaa.github.io` folder, run:

```zsh
npm install
```

That installs all required project dependencies.

## 6. Run the project locally

When you are ready to run the site:

```zsh
npm run dev
```

Then open `http://localhost:4321` in your browser.
