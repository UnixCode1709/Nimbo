const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Internal Express Server inside Electron Main Process
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

const defaultDownloadsDir = path.join(os.homedir(), 'Downloads');

// Absolute paths to installed yt-dlp & ffmpeg
const YT_DLP_PATH = `C:\\Users\\Voyte\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`;
const FFMPEG_DIR = `C:\\Users\\Voyte\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-125875-g5d4d3bdc61-win64-gpl\\bin`;

let mainWindow = null;

// Select Folder Dialog Endpoint
expressApp.post('/api/select-folder', async (req, res) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Выберите папку для сохранения видео'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      res.json({ selectedPath: result.filePaths[0] });
    } else {
      res.json({ selectedPath: null });
    }
  } catch (err) {
    res.status(500).json({ error: 'Не удалось открыть проводник' });
  }
});

// Fetch metadata endpoint + available resolutions extraction
expressApp.post('/api/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL не указан' });

  const args = [
    '-J',
    '--no-warnings',
    url
  ];

  const proc = spawn(YT_DLP_PATH, args);
  let stdoutData = '';
  let stderrData = '';

  proc.stdout.on('data', (data) => stdoutData += data.toString());
  proc.stderr.on('data', (data) => stderrData += data.toString());

  proc.on('close', (code) => {
    if (code === 0 && stdoutData) {
      try {
        const info = JSON.parse(stdoutData);
        if (info._type === 'playlist' && info.entries) {
          res.json({
            isPlaylist: true,
            title: info.title || 'YouTube Playlist',
            uploader: info.uploader || info.channel || 'YouTube',
            itemCount: info.entries.length,
            thumbnail: info.entries[0]?.thumbnails?.[0]?.url || '',
            availableQualities: ['2160p', '1440p', '1080p', '720p', '480p']
          });
        } else {
          // Extract real available video heights/resolutions
          const availableHeights = new Set();
          if (info.formats && Array.isArray(info.formats)) {
            info.formats.forEach((f) => {
              if (f.height && typeof f.height === 'number') {
                availableHeights.add(f.height);
              }
            });
          }

          const sortedHeights = Array.from(availableHeights).sort((a, b) => b - a);
          const availableQualities = sortedHeights
            .filter(h => h >= 144)
            .map(h => `${h}p`);

          const finalQualities = availableQualities.length ? availableQualities : ['1080p', '720p', '480p', '360p'];

          res.json({
            isPlaylist: false,
            title: info.title || 'YouTube Video',
            thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : ''),
            uploader: info.uploader || info.channel || 'YouTube',
            duration: info.duration_string || `${Math.floor((info.duration || 0) / 60)}:${((info.duration || 0) % 60).toString().padStart(2, '0')}`,
            availableQualities: finalQualities
          });
        }
      } catch (e) {
        res.status(500).json({ error: 'Ошибка парсинга метаданных' });
      }
    } else {
      const isUnavailable = stderrData.includes('unavailable') || stderrData.includes('Private') || stderrData.includes('deleted');
      const errorMsg = isUnavailable 
        ? 'Видео недоступно или удалено с YouTube' 
        : 'Не удалось получить сведения о видео. Проверьте ссылку.';
      res.status(400).json({ error: errorMsg });
    }
  });
});

expressApp.post('/api/download', (req, res) => {
  const { url, format, quality, audioBitrate, savePath } = req.body;
  if (!url) return res.status(400).json({ error: 'URL не указан' });

  const targetDir = savePath && fs.existsSync(savePath) ? savePath : defaultDownloadsDir;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const rawUrls = url.split('\n').map((u) => u.trim()).filter((u) => u.length > 0);

  sendEvent({ status: 'started', message: 'Подготовка к скачиванию...', progress: 0 });

  const args = [
    '--newline',
    '--no-mtime',
    '--ffmpeg-location', FFMPEG_DIR,
    '-o', path.join(targetDir, '%(title)s.%(ext)s')
  ];

  if (format === 'mp3') {
    args.push('--extractor-args', 'youtube:player_client=android,web');
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', `${audioBitrate || 320}k`);
  } else {
    const targetRes = quality ? quality.replace('p', '') : '1080';
    args.push('-f', `bv*[height=${targetRes}]+ba/bv*[height<=${targetRes}]+ba/bestvideo+bestaudio/best`, '--merge-output-format', 'mp4');
  }

  args.push(...rawUrls);

  const proc = spawn(YT_DLP_PATH, args);
  let lastErrorText = '';

  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.includes('[download]') && line.includes('%')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) {
          sendEvent({
            status: 'downloading',
            progress: parseFloat(match[1]),
            message: `Загрузка с YouTube: ${match[1]}%`
          });
        }
      } else if (line.includes('[download] Downloading item')) {
        sendEvent({
          status: 'downloading',
          progress: 5,
          message: line.replace('[download]', '').trim()
        });
      } else if (line.includes('[ExtractAudio]') || line.includes('[Merger]')) {
        sendEvent({
          status: 'processing',
          progress: 95,
          message: 'Конвертация и сведение в MP4...'
        });
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    console.error('yt-dlp log:', text);
    if (text.includes('ERROR:') || text.includes('unavailable') || text.includes('Private')) {
      lastErrorText = text;
    }
  });

  proc.on('close', (code) => {
    if (code === 0) {
      sendEvent({
        status: 'completed',
        progress: 100,
        message: `Файл успешно сохранён в ${targetDir}!`,
        folder: targetDir
      });
    } else {
      let friendlyError = `Ошибка скачивания (Код ${code}).`;
      if (lastErrorText.includes('unavailable') || lastErrorText.includes('Video unavailable')) {
        friendlyError = 'Данное видео удалено или заблокировано на YouTube (18+/регион).';
      } else if (lastErrorText.includes('Private video')) {
        friendlyError = 'Это приватное видео автора.';
      }
      sendEvent({
        status: 'error',
        message: friendlyError
      });
    }
    res.end();
  });

  proc.on('error', (err) => {
    sendEvent({
      status: 'error',
      message: `Ошибка запуска yt-dlp: ${err.message}`
    });
    res.end();
  });
});

expressApp.listen(3001, () => {
  console.log('Internal Express server running on port 3001');
});

// Electron Window Creation
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 780,
    minWidth: 800,
    minHeight: 650,
    title: "Nimbo",
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
