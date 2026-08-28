const { app, BrowserWindow, dialog, Notification, shell, clipboard, globalShortcut } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// Internal Express Server inside Electron Main Process
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

const defaultDownloadsDir = path.join(os.homedir(), 'Downloads');

// =============================================================================
// Smart Binary Discovery (inspired by Cliply)
// =============================================================================

function findBinary(name, extraPaths = []) {
  // 1. Next to app executable (bundled)
  const appDir = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : __dirname;

  const resourcesDir = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries')
    : path.join(appDir, 'binaries');

  const localCandidates = [
    path.join(resourcesDir, name),
    path.join(appDir, name),
    path.join(appDir, 'bin', name),
  ];

  for (const p of localCandidates) {
    if (fs.existsSync(p)) {
      console.log(`[Nimbo] Found ${name} at: ${p}`);
      return p;
    }
  }

  // 2. Extra paths provided (e.g. old hardcoded locations)
  for (const p of extraPaths) {
    if (fs.existsSync(p)) {
      console.log(`[Nimbo] Found ${name} at extra path: ${p}`);
      return p;
    }
  }

  // 3. System PATH (where / which)
  try {
    const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0].trim();
    if (result && fs.existsSync(result)) {
      console.log(`[Nimbo] Found ${name} in PATH: ${result}`);
      return result;
    }
  } catch {}

  console.warn(`[Nimbo] ⚠ Could not find ${name} — some features may not work`);
  return null;
}

// Discover yt-dlp
const YT_DLP_PATH = findBinary('yt-dlp.exe', [
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe'),
  'C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe',
]) || 'yt-dlp';

// Discover ffmpeg directory
const ffmpegExe = findBinary('ffmpeg.exe', [
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-N-125875-g5d4d3bdc61-win64-gpl', 'bin', 'ffmpeg.exe'),
  'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
]);
const FFMPEG_DIR = ffmpegExe ? path.dirname(ffmpegExe) : null;

console.log(`[Nimbo] yt-dlp: ${YT_DLP_PATH}`);
console.log(`[Nimbo] ffmpeg dir: ${FFMPEG_DIR || 'not found (will use system)'}`);

let mainWindow = null;

// =============================================================================
// Helpers
// =============================================================================

// Kill process tree on Windows (like Cliply does)
function killProcessTree(child) {
  if (!child || child.killed) return;

  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      return;
    } catch {}
  }

  try { child.kill('SIGKILL'); } catch {}
}

// Watchdog: kill process if silent for too long
function createWatchdog(child, timeoutMs = 120000) {
  let timer = null;

  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      console.warn(`[Nimbo] Watchdog: process silent for ${timeoutMs / 1000}s — killing`);
      killProcessTree(child);
    }, timeoutMs);
  };

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  reset(); // start immediately
  return { reset, clear };
}

// Strip playlist params from single video URLs
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

// =============================================================================
// Select Folder Dialog
// =============================================================================
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

// Open Folder or highlight File in Explorer
expressApp.post('/api/open-folder', async (req, res) => {
  const { folder, filePath } = req.body || {};
  try {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return res.json({ success: true });
    }
    const target = folder || (filePath ? path.dirname(filePath) : defaultDownloadsDir);
    if (fs.existsSync(target)) {
      await shell.openPath(target);
      return res.json({ success: true });
    }
    await shell.openPath(defaultDownloadsDir);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Не удалось открыть папку' });
  }
});

// Open File in default player
expressApp.post('/api/open-file', async (req, res) => {
  const { filePath } = req.body || {};
  try {
    if (filePath && fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Файл не найден' });
  } catch (err) {
    res.status(500).json({ error: 'Не удалось открыть файл' });
  }
});

// =============================================================================
// FAST Parallel Info Fetch with Full Quality Guarantee
// =============================================================================

const YOUTUBE_CLIENTS = [
  'visionos,android',
  'default'
];

expressApp.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL не указан' });

  const cleanUrl = cleanVideoUrl(url);

  const raceResult = await raceInfoFetch(cleanUrl, YOUTUBE_CLIENTS, 12000);

  if (raceResult && raceResult.stdoutData) {
    try {
      const info = JSON.parse(raceResult.stdoutData);
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
    const stderrText = raceResult ? raceResult.stderrData : '';
    const isUnavailable = stderrText.includes('unavailable') || stderrText.includes('Private') || stderrText.includes('deleted');
    const errorMsg = isUnavailable
      ? 'Видео недоступно или удалено с YouTube'
      : 'Не удалось получить сведения о видео. Проверьте ссылку.';
    return res.status(400).json({ error: errorMsg });
  }
});

/**
 * Fetch yt-dlp info prioritizing clients that provide full video resolutions (1080p/4K).
 */
function raceInfoFetch(url, clients, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const processes = [];
    let bestResult = null;
    let pendingCount = clients.length;

    const globalTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      processes.forEach(p => killProcessTree(p));
      if (bestResult) {
        resolve(bestResult);
      } else {
        console.warn(`[Nimbo] Info fetch timed out after ${timeoutMs}ms`);
        resolve(null);
      }
    }, timeoutMs);

    const tryClient = (clientConfig) => {
      const args = [
        '-J',
        '--no-warnings',
        '--no-playlist',
        '--socket-timeout', '10',
      ];

      if (clientConfig !== 'default') {
        args.push('--extractor-args', `youtube:player_client=${clientConfig}`);
      }

      args.push('--', url);

      const proc = spawn(YT_DLP_PATH, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      processes.push(proc);

      let stdoutData = '';
      let stderrData = '';

      proc.stdout.on('data', (data) => stdoutData += data.toString());
      proc.stderr.on('data', (data) => stderrData += data.toString());

      proc.on('close', (code) => {
        pendingCount--;
        if (settled) return;

        if (code === 0 && stdoutData.trim()) {
          try {
            const parsed = JSON.parse(stdoutData);
            let maxHeight = 0;
            if (parsed.formats && Array.isArray(parsed.formats)) {
              maxHeight = Math.max(0, ...parsed.formats.map(f => (typeof f.height === 'number' ? f.height : 0)));
            }

            const current = { code, stdoutData, stderrData, maxHeight };

            // If this response has high quality (>= 720p or playlist), resolve immediately!
            if (maxHeight >= 720 || parsed._type === 'playlist' || pendingCount === 0) {
              settled = true;
              clearTimeout(globalTimer);
              console.log(`[Nimbo] ✓ Full info fetched via client: ${clientConfig} (max height: ${maxHeight}p)`);
              processes.forEach(p => {
                if (p !== proc) killProcessTree(p);
              });
              return resolve(current);
            }

            // Otherwise save as best so far and wait for a higher quality client
            if (!bestResult || maxHeight > (bestResult.maxHeight || 0)) {
              bestResult = current;
            }
          } catch {
            if (!bestResult) {
              bestResult = { code, stdoutData, stderrData };
            }
          }
        }

        if (pendingCount === 0 && !settled) {
          settled = true;
          clearTimeout(globalTimer);
          resolve(bestResult || { code, stdoutData: '', stderrData });
        }
      });

      proc.on('error', () => {
        pendingCount--;
        if (pendingCount === 0 && !settled) {
          settled = true;
          clearTimeout(globalTimer);
          resolve(bestResult);
        }
      });
    };

    for (const client of clients) {
      tryClient(client);
    }
  });
}

// =============================================================================
// Download Endpoint (v1.1.9 — correct flag order + watchdog + tree kill)
// =============================================================================
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

  // Build args — Cliply-inspired correct order
  const args = [
    '--newline',
    '--no-mtime',
    '--no-colors',
    '--retries', '10',
    '--fragment-retries', '10',
    '--retry-sleep', 'linear=1::2',
    '--socket-timeout', '30',
    '--extractor-args', 'youtube:player_client=visionos,android;player_skip=configs',
  ];

  // ffmpeg location (if found)
  if (FFMPEG_DIR) {
    args.push('--ffmpeg-location', FFMPEG_DIR);
  }

  // Output template
  args.push('-o', path.join(targetDir, '%(title)s.%(ext)s'));

  if (format === 'mp3') {
    args.push(
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', `${audioBitrate || 320}k`,
      '--embed-thumbnail',
      '--embed-metadata'
    );
  } else {
    // *** CRITICAL: Cliply order — -t FIRST, then -S ***
    // Extract target resolution digits
    const match = String(quality || '').match(/\d+/);
    const targetRes = match ? match[0] : '1080';

    // -t mp4 expands into its own -S and format selector
    // -S res: AFTER -t overrides the resolution sort
    args.push(
      '-t', 'mp4',
      '-S', `res:${targetRes}`,
      '--no-playlist'
    );
  }

  // URLs go after -- to prevent injection
  args.push('--');
  args.push(...rawUrls);

  console.log('[Nimbo] Launching yt-dlp with args:', args.join(' '));

  const proc = spawn(YT_DLP_PATH, args, { windowsHide: true });
  let stderrLines = [];
  let lastDestinationFile = null;

  // Watchdog: kill if silent for 2 minutes
  const watchdog = createWatchdog(proc, 120000);

  proc.stdout.on('data', (chunk) => {
    watchdog.reset(); // Feed the watchdog

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
        watchdog.clear(); // Post-processing can be long — disable watchdog
        sendEvent({
          status: 'processing',
          progress: 92,
          message: 'Конвертация и сведение в файл...'
        });
        const mergerMatch = line.match(/Merging formats into "(.+)"/i);
        if (mergerMatch) {
          lastDestinationFile = mergerMatch[1].trim();
        }
      } else if (line.includes('[EmbedThumbnail]') || line.includes('[Metadata]')) {
        sendEvent({
          status: 'processing',
          progress: 98,
          message: 'Вшивание обложки и аудио-тегов в MP3...'
        });
      } else if (line.includes('[download] Destination:')) {
        const dest = line.replace('[download] Destination:', '').trim();
        lastDestinationFile = dest;
        console.log('[Nimbo] Saving to:', dest);
      } else if (line.includes('[ExtractAudio] Destination:')) {
        const dest = line.replace('[ExtractAudio] Destination:', '').trim();
        lastDestinationFile = dest;
      }
    }
  });

  proc.stderr.on('data', (data) => {
    watchdog.reset(); // stderr output also counts as alive
    const text = data.toString().trim();
    if (text) {
      stderrLines.push(text);
      console.error('[yt-dlp stderr]:', text);
    }
  });

  proc.on('close', (code) => {
    watchdog.clear();

    if (code === 0) {
      sendEvent({
        status: 'completed',
        progress: 100,
        message: `Файл успешно сохранён в: ${targetDir}`,
        folder: targetDir,
        filePath: lastDestinationFile || null
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
      } else if (fullStderr.includes("confirm you're not a bot") || fullStderr.includes('confirm you\'re not a bot') || (fullStderr.includes('Sign in') && fullStderr.includes('bot'))) {
        friendlyError = 'YouTube временно запросил проверку на бота. Попробуйте повторить через 2-3 минуты.';
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
        friendlyError = 'Ошибка обработки видео (ffmpeg). Проверьте, что ffmpeg установлен корректно.';
      } else if (fullStderr.length > 0) {
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
    watchdog.clear();
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

// =============================================================================
// Electron Window
// =============================================================================
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
