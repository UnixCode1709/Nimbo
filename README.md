# Nimbo

**Nimbo** is a modern desktop application for downloading and converting online media on Windows.

It is my first major software project and currently my main development focus.

The goal of Nimbo is simple: provide a clean, convenient and understandable desktop interface for downloading media without unnecessary complexity.

---

## ✨ Features

* 🎬 Download video in MP4
* 🎵 Extract and download audio in MP3
* 📊 Download progress tracking
* 🎨 Modern desktop interface
* ⚙️ Simple workflow
* 🖥️ Windows support
* 📁 Easy access to downloaded files
* 🔄 Ongoing improvements and updates

---

## 🖥️ Interface

Nimbo is designed around a simple workflow:

1. Paste a media link
2. Choose the desired format
3. Select the available quality
4. Start the download
5. Wait for Nimbo to finish processing the file

Screenshots will be added here as the interface continues to improve.

<!--
Example:

![Nimbo Screenshot](docs/screenshot.png)
-->

---

## 🚀 Installation

The easiest way to use Nimbo is through the Windows installer.

### Windows

Download the latest version from the **Releases** section of this repository.

Then:

1. Download the Nimbo installer
2. Run the `.exe` file
3. Complete the installation
4. Launch Nimbo

> GitHub Releases will be used for distributing compiled versions of Nimbo.

---

## 🧑‍💻 Running from source

If you want to run Nimbo directly from the source code, you will need Node.js installed.

### 1. Clone the repository

```bash
git clone https://github.com/UnixCode1709/Nimbo.git
```

### 2. Open the project directory

```bash
cd Nimbo
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the application

```bash
npm run dev
```

Depending on the current version of the project, additional development commands may be available in `package.json`.

---

## 🛠️ Built With

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge\&logo=javascript\&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge\&logo=typescript\&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge\&logo=node.js\&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge\&logo=electron\&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge\&logo=vite\&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge\&logo=git\&logoColor=white)

---

## 📂 Project Structure

```text
Nimbo/
│
├── src/               # Main application source code
├── public/            # Static assets
├── build/             # Build resources
│
├── main.js            # Desktop application entry point
├── server.ts          # Backend / local server logic
├── index.html         # Main HTML entry
│
├── package.json       # Project configuration and dependencies
├── package-lock.json
│
├── vite.config.ts
├── tsconfig.json
│
├── .gitignore
└── README.md
```

Build folders, installers, downloaded media and dependencies are intentionally excluded from the repository.

---

## 🗺️ Roadmap

Nimbo is still actively being developed.

Planned improvements include:

* [ ] Improve download stability
* [ ] Improve error handling
* [ ] Improve download progress feedback
* [ ] Add better quality selection
* [ ] Improve application settings
* [ ] Improve file management
* [ ] Polish the interface
* [ ] Create stable Windows releases
* [ ] Improve installer experience
* [ ] Add automatic update support
* [ ] Continue optimizing performance

---

## 📦 Releases

Stable builds of Nimbo will be published through **GitHub Releases**.

Each release may include:

* Windows installer
* Version number
* Changelog
* Bug fixes
* New features

---

## 🐛 Bugs & Feedback

Nimbo is an early project and may still contain bugs.

If you find a problem, you can open an **Issue** in this repository and describe:

* What happened
* What you expected to happen
* Steps to reproduce the problem
* Your Windows version
* Screenshots or error messages if available

---

## 🔐 Repository Notes

The repository contains the source code required to develop Nimbo.

The following files are intentionally excluded:

```text
node_modules/
dist/
dist_installer/
downloaded media
temporary files
local environment files
compiled installers
```

Исполняемый файл появится в папке `dist/` или `dist_electron/`.
This keeps the repository clean and avoids storing unnecessary generated files.

---

## 👨‍💻 Author

Created by **Unix**

GitHub: [@UnixCode1709](https://github.com/UnixCode1709)

Nimbo is my first major software project and a project I use to improve my development skills while building something practical.

---

## 📋 Системные требования
- **OS**: Windows 10 / 11
- **Зависимости**: `yt-dlp` и `ffmpeg` (устанавливаются автоматически через `winget` или системные пакетировщики).
## ⚠️ Disclaimer

Nimbo is intended to be used only for content that you are legally permitted to download.

Users are responsible for complying with applicable laws, copyright rules and the terms of service of the platforms they use.

---

## 🚧 Project Status

**Active Development**

Nimbo is currently under active development. Features, interface elements and internal architecture may change between versions.
