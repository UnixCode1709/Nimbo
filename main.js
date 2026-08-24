const { app, BrowserWindow, dialog, Notification, shell, clipboard, globalShortcut } = require('electron');
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


// Helper: if URL has a specific video ID (v= or youtu.be/ID) AND playlist/radio params,
// strip the playlist params so yt-dlp downloads only the single video.
// Pure playlist URLs (no specific video) are left as-is for full playlist downloads.
function cleanVideoUrl(rawUrl) {
  try {
    const trimmed = rawUrl.trim();
    const u = new URL(trimmed);
    
    const isYouTuBe = u.hostname.includes('youtu.be') && u.pathname.length > 1;
    const isWatch = u.searchParams.has('v');
    
    if ((isWatch || isYouTuBe) && u.searchParams.has('list')) {
      u.searchParams.delete('list');
      u.searchParams.delete('index');
      u.searchParams.delete('start_radio');
      u.searchParams.delete('pp');
      u.searchParams.delete('si');
      console.log(`[Nimbo] Stripped playlist/radio params → ${u.toString()}`);
      return u.toString();
    }
    return trimmed;
  } catch {
    return rawUrl.trim();
  }
}

// YouTube Client Fallback Cascade (bypasses bot challenges, SABR, and login requirements while providing full 1080p/4K qualities)
const YOUTUBE_CLIENT_CASCADE = [
  'visionos',
  'android;player_skip=configs',
  'ios;player_skip=configs',
  'tv;player_skip=configs',
  'mweb;player_skip=configs'
];

// Fetch metadata endpoint + available resolutions extraction with automatic cascade
expressApp.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL не указан' });

  const cleanUrl = cleanVideoUrl(url);

  const fetchInfoWithClient = (clientConfig) => {
    return new Promise((resolve) => {
      const args = ['-J', '--no-warnings'];
      if (clientConfig) {
        args.push('--extractor-args', `youtube:player_client=${clientConfig}`);
      }
      args.push(cleanUrl);

      const proc = spawn(YT_DLP_PATH, args);
      let stdoutData = '';
      let stderrData = '';

      proc.stdout.on('data', (data) => stdoutData += data.toString());
      proc.stderr.on('data', (data) => stderrData += data.toString());

      proc.on('close', (code) => {
        resolve({ code, stdoutData, stderrData });
      });
    });
  };

  let result = null;
  for (const client of YOUTUBE_CLIENT_CASCADE) {
    result = await fetchInfoWithClient(client);
    if (result.code === 0 && result.stdoutData) {
      break;
    }
    console.log(`[Nimbo] Info fetch failed with client ${client}, trying next in cascade...`);
  }

  if (result && result.code === 0 && result.stdoutData) {
    try {
      const info = JSON.parse(result.stdoutData);
      if (info._type === 'playlist' && info.entries) {
        return res.json({
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

        return res.json({
          isPlaylist: false,
          title: info.title || 'YouTube Video',
          thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : ''),
          uploader: info.uploader || info.channel || 'YouTube',
          duration: info.duration_string || `${Math.floor((info.duration || 0) / 60)}:${((info.duration || 0) % 60).toString().padStart(2, '0')}`,
          availableQualities: finalQualities
        });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Ошибка парсинга метаданных' });
    }
  } else {
    const stderrText = result ? result.stderrData : '';
    const isUnavailable = stderrText.includes('unavailable') || stderrText.includes('Private') || stderrText.includes('deleted');
    const errorMsg = isUnavailable 
      ? 'Видео недоступно или удалено с YouTube' 
      : 'Не удалось получить сведения о видео. Проверьте ссылку.';
    return res.status(400).json({ error: errorMsg });
  }
});

expressApp.post('/api/download', (req, res) => {
  const { url, format, quality, audioBitrate, savePath } = req.body;
  if (!url) return res.status(400).json({ error: 'URL не указан' });

  const targetDir = savePath && fs.existsSync(savePath) ? savePath : defaultDownloadsDir;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const rawUrls = url.split('\n').map((u) => cleanVideoUrl(u)).filter((u) => u.length > 0);

  sendEvent({ status: 'started', message: 'Подготовка к скачиванию...', progress: 0 });

  const args = [
    '--newline',
    '--no-mtime',
    '--retries', '10',
    '--fragment-retries', '10',
    '--retry-sleep', 'linear=1::2',
    '--socket-timeout', '30',
    '--ffmpeg-location', FFMPEG_DIR,
    '--extractor-args', 'youtube:player_client=visionos,android;player_skip=configs',
    '-o', path.join(targetDir, '%(title)s.%(ext)s')
  ];

  if (format === 'mp3') {
    args.push(
      '-x', 
      '--audio-format', 'mp3', 
      '--audio-quality', `${audioBitrate || 320}k`,
      '--embed-thumbnail',
      '--embed-metadata'
    );
  } else {
    // Extract purely digits from quality (e.g. '1080p', '1080', 'Full HD (1080p)' -> '1080')
    const match = String(quality || '').match(/\d+/);
    const targetRes = match ? match[0] : '1080';
    
    // Format sorting guarantee: picks best stream up to target resolution and merges to MP4
    args.push(
      '-S', `res:${targetRes},ext:mp4:m4a`,
      '-f', 'bestvideo*+bestaudio/best',
      '--merge-output-format', 'mp4'
    );
  }


  args.push(...rawUrls);

  console.log('[Nimbo] Launching yt-dlp with args:', args.join(' '));

  const proc = spawn(YT_DLP_PATH, args);
  let stderrLines = [];

  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.includes('[download]') && line.includes('%')) {
        const match = line.match(/(\d+\.?\d*)%/);
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
          progress: 92,
          message: 'Конвертация и сведение в файл...'
        });
      } else if (line.includes('[EmbedThumbnail]') || line.includes('[Metadata]')) {
        sendEvent({
          status: 'processing',
          progress: 98,
          message: 'Вшивание обложки и аудио-тегов в MP3...'
        });
      } else if (line.includes('[download] Destination:')) {
        const dest = line.replace('[download] Destination:', '').trim();
        console.log('[Nimbo] Saving to:', dest);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) {
      stderrLines.push(text);
      console.error('[yt-dlp stderr]:', text);
    }
  });

  proc.on('close', (code) => {
    if (code === 0) {
      sendEvent({
        status: 'completed',
        progress: 100,
        message: `Файл успешно сохранён в: ${targetDir}`,
        folder: targetDir
      });

      // Native Windows Desktop Notification
      try {
        if (Notification.isSupported()) {
          const typeLabel = format === 'mp3' ? 'Аудио MP3' : 'Видео MP4';
          const notif = new Notification({
            title: 'Nimbo — Загрузка завершена! ✨',
            body: `${typeLabel} успешно сохранён в папку:\n${targetDir}`,
            icon: path.join(__dirname, 'build', 'icon.ico')
          });
          notif.on('click', () => {
            shell.openPath(targetDir);
          });
          notif.show();
        }
      } catch (notifErr) {
        console.error('[Nimbo] Notification error:', notifErr);
      }
    } else {
      const fullStderr = stderrLines.join('\n');
      console.error(`[Nimbo] yt-dlp exited with code ${code}. Full stderr:\n${fullStderr}`);

      let friendlyError = `Ошибка скачивания (Код ${code}).`;

      if (fullStderr.includes('Video unavailable') || fullStderr.includes('unavailable')) {
        friendlyError = 'Видео недоступно — возможно удалено или заблокировано в вашем регионе.';
      } else if (fullStderr.includes('Private video')) {
        friendlyError = 'Это приватное видео — автор закрыл доступ.';
      } else if (fullStderr.includes('confirm you’re not a bot') || fullStderr.includes("confirm you're not a bot") || (fullStderr.includes('Sign in') && fullStderr.includes('bot'))) {
        friendlyError = 'YouTube временно запросил проверку на бота (Anti-Bot Check) для этого ролика. Попробуйте повторить через 2-3 минуты или сменить сеть/VPN.';
      } else if (fullStderr.includes('confirm your age') || fullStderr.includes('age-restricted') || (fullStderr.includes('Sign in') && fullStderr.includes('age'))) {
        friendlyError = 'Видео с возрастным ограничением (18+).';
      } else if (fullStderr.includes('Sign in')) {
        friendlyError = 'YouTube требует авторизации для доступа к этому видео.';
      } else if (fullStderr.includes('HTTP Error 403')) {
        friendlyError = 'YouTube заблокировал запрос (403). Попробуйте снова через несколько секунд.';
      } else if (fullStderr.includes('HTTP Error 429')) {
        friendlyError = 'Слишком много запросов — YouTube временно ограничил скачивание. Подождите пару минут.';
      } else if (fullStderr.includes('network') || fullStderr.includes('timeout') || fullStderr.includes('Connection')) {
        friendlyError = 'Ошибка сети — проверьте подключение к интернету и попробуйте снова.';
      } else if (fullStderr.includes('Requested format is not available')) {
        friendlyError = 'Выбранное качество недоступно для этого видео. Попробуйте более низкое качество.';
      } else if (fullStderr.includes('ffmpeg')) {
        friendlyError = 'Ошибка объединения видео и аудио (ffmpeg). Проверьте, что ffmpeg установлен корректно.';
      } else if (fullStderr.length > 0) {
        // Show the actual error to help debug
        const lastError = stderrLines.filter(l => l.includes('ERROR:')).slice(-1)[0] || stderrLines.slice(-1)[0] || '';
        friendlyError = `Ошибка скачивания: ${lastError.replace('ERROR:', '').trim() || `Код ${code}`}`;
      }

      sendEvent({
        status: 'error',
        message: friendlyError
      });
    }
    res.end();
  });

  proc.on('error', (err) => {
    console.error('[Nimbo] Failed to start yt-dlp:', err);
    sendEvent({
      status: 'error',
      message: `Не удалось запустить yt-dlp: ${err.message}. Проверьте установку yt-dlp.`
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

  mainWindow.on('focus', () => {
    try {
      const text = clipboard.readText();
      if (text && (text.includes('youtube.com/') || text.includes('youtu.be/'))) {
        mainWindow.webContents.send('clipboard-url-detected', text.trim());
      }
    } catch (e) {}
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.nimbo.downloader');
  }
  createWindow();

  try {
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      try {
        const text = clipboard.readText();
        if (text && (text.includes('youtube.com/') || text.includes('youtu.be/'))) {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('clipboard-url-detected', text.trim());
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
