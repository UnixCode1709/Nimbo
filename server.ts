import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const app = express();
app.use(cors());
app.use(express.json());

const downloadsDir = path.join(os.homedir(), 'Downloads', 'YouTube_Downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Absolute paths to installed yt-dlp & ffmpeg
const YT_DLP_PATH = `C:\\Users\\Voyte\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`;
const FFMPEG_DIR = `C:\\Users\\Voyte\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-125875-g5d4d3bdc61-win64-gpl\\bin`;

// Fetch metadata endpoint + available resolutions extraction
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  const args = [
    '-J',
    '--no-warnings',
    url
  ];

  const process = spawn(YT_DLP_PATH, args);
  let stdoutData = '';

  process.stdout.on('data', (data) => {
    stdoutData += data.toString();
  });

  process.on('close', (code) => {
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
          const availableHeights = new Set<number>();
          if (info.formats && Array.isArray(info.formats)) {
            info.formats.forEach((f: any) => {
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
        res.status(500).json({ error: 'Ошибка парсинга данных' });
      }
    } else {
      res.status(400).json({ error: 'Не удалось получить информацию по ссылке' });
    }
  });
});

app.post('/api/download', async (req, res) => {
  const { url, format, quality, audioBitrate } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL не указан' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const rawUrls = url.split('\n').map((u: string) => u.trim()).filter((u: string) => u.length > 0);

  sendEvent({ status: 'started', message: 'Подготовка к скачиванию...', progress: 0 });

  const args: string[] = [
    '--newline',
    '--no-mtime',
    '--ffmpeg-location', FFMPEG_DIR,
    '-o', path.join(downloadsDir, '%(title)s.%(ext)s'),
    '-o', 'playlist:' + path.join(downloadsDir, '%(playlist_title)s', '%(title)s.%(ext)s')
  ];

  if (format === 'mp3') {
    args.push('--extractor-args', 'youtube:player_client=android,web');
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', `${audioBitrate || 320}k`);
  } else {
    const targetRes = quality ? quality.replace('p', '') : '1080';
    // STRICT FORMAT SELECTOR: Select exact height format, force video+audio merging without 360p fallback
    args.push('-f', `bv*[height=${targetRes}]+ba/bv*[height<=${targetRes}]+ba/bestvideo+bestaudio/best`, '--merge-output-format', 'mp4');
  }

  args.push(...rawUrls);

  console.log('Running:', YT_DLP_PATH, args.join(' '));

  const process = spawn(YT_DLP_PATH, args);

  process.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.includes('[download]') && line.includes('%')) {
        const match = line.match(/(\d+\.\d+)%/);
        if (match) {
          const percent = parseFloat(match[1]);
          sendEvent({
            status: 'downloading',
            progress: percent,
            message: `Загрузка с YouTube: ${percent}%`
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

  process.stderr.on('data', (data) => {
    console.error('yt-dlp log:', data.toString());
  });

  process.on('close', (code) => {
    if (code === 0) {
      sendEvent({
        status: 'completed',
        progress: 100,
        message: `Успешно скачано в Загрузки / YouTube_Downloads!`,
        folder: downloadsDir
      });
    } else {
      sendEvent({
        status: 'error',
        message: `Ошибка скачивания (Код ${code}). Проверьте ссылки.`
      });
    }
    res.end();
  });

  process.on('error', (err) => {
    sendEvent({
      status: 'error',
      message: `Ошибка запуска yt-dlp: ${err.message}`
    });
    res.end();
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend Express server running on http://localhost:${PORT}`);
});
