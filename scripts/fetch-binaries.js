const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const binariesDir = path.join(__dirname, '..', 'binaries');

if (!fs.existsSync(binariesDir)) {
  fs.mkdirSync(binariesDir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`[Download] Starting: ${url} -> ${destPath}`);
    const file = fs.createWriteStream(destPath);
    
    function makeRequest(currentUrl, redirectCount = 0) {
      if (redirectCount > 10) {
        return reject(new Error('Too many redirects'));
      }

      const client = currentUrl.startsWith('https') ? https : http;
      
      const req = client.get(currentUrl, {
        headers: {
          'User-Agent': 'Nimbo-Downloader/1.2.1'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).href;
          return makeRequest(redirectUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }

        let downloadedBytes = 0;
        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r[Download] Progress: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`);
          } else {
            process.stdout.write(`\r[Download] Downloaded: ${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB`);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => {
            console.log('\n[Download] ✓ Finished:', destPath);
            resolve();
          });
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    makeRequest(url);
  });
}

async function main() {
  try {
    const ytdlpPath = path.join(binariesDir, 'yt-dlp.exe');
    if (!fs.existsSync(ytdlpPath) || fs.statSync(ytdlpPath).size < 1000000) {
      console.log('--- Downloading latest yt-dlp.exe ---');
      await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', ytdlpPath);
    } else {
      console.log('✓ yt-dlp.exe already exists in binaries/');
    }

    const ffmpegPath = path.join(binariesDir, 'ffmpeg.exe');
    if (!fs.existsSync(ffmpegPath) || fs.statSync(ffmpegPath).size < 1000000) {
      console.log('--- Downloading ffmpeg standalone ---');
      const ffmpegZip = path.join(binariesDir, 'ffmpeg-release-essentials.zip');
      await downloadFile('https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip', ffmpegZip);
      
      console.log('--- Extracting ffmpeg ---');
      // Use powershell Expand-Archive on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${ffmpegZip}' -DestinationPath '${binariesDir}\\temp_ffmpeg' -Force"`, { stdio: 'inherit' });
      
      // Find ffmpeg.exe inside extracted folder
      const tempDir = path.join(binariesDir, 'temp_ffmpeg');
      const foundFiles = [];
      
      function scanDir(dir) {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) scanDir(full);
          else if (item.toLowerCase() === 'ffmpeg.exe' || item.toLowerCase() === 'ffprobe.exe') foundFiles.push(full);
        }
      }
      scanDir(tempDir);

      for (const f of foundFiles) {
        const dest = path.join(binariesDir, path.basename(f));
        fs.copyFileSync(f, dest);
        console.log(`Copied ${path.basename(f)} to binaries/`);
      }

      // Cleanup temp
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(ffmpegZip);
    } else {
      console.log('✓ ffmpeg.exe already exists in binaries/');
    }

    const denoPath = path.join(binariesDir, 'deno.exe');
    if (!fs.existsSync(denoPath) || fs.statSync(denoPath).size < 1000000) {
      console.log('--- Downloading Deno JS runtime (for YouTube JS challenge solving) ---');
      const denoZip = path.join(binariesDir, 'deno.zip');
      await downloadFile('https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip', denoZip);
      
      console.log('--- Extracting Deno ---');
      execSync(`powershell -Command "Expand-Archive -Path '${denoZip}' -DestinationPath '${binariesDir}' -Force"`, { stdio: 'inherit' });
      fs.unlinkSync(denoZip);
      console.log('✓ deno.exe ready in binaries/');
    } else {
      console.log('✓ deno.exe already exists in binaries/');
    }

    console.log('\n=== ALL BINARIES READY ===');
    console.log('Files in binaries:', fs.readdirSync(binariesDir));

    // Verify yt-dlp version
    const ver = execSync(`"${ytdlpPath}" --version`, { encoding: 'utf8' }).trim();
    console.log('yt-dlp version:', ver);
  } catch (err) {
    console.error('Error fetching binaries:', err);
    process.exit(1);
  }
}

main();
