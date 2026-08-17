import { useState, useEffect } from 'react';
import { 
  Download, 
  Video, 
  Music, 
  CheckCircle2, 
  Play,
  FolderOpen, 
  X, 
  Loader2,
  AlertCircle,
  Clock,
  User,
  Sparkles,
  ListVideo,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

type FormatType = 'mp4' | 'mp3';

interface VideoInfo {
  isPlaylist?: boolean;
  itemCount?: number;
  title: string;
  thumbnail: string;
  uploader: string;
  duration?: string;
  availableQualities?: string[];
}

interface VideoState {
  url: string;
  format: FormatType;
  quality: string;
  isDownloading: boolean;
  progress: number;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  statusText: string;
}

export function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<FormatType>('mp4');
  const [quality, setQuality] = useState('1080p');
  const [audioBitrate, setAudioBitrate] = useState('320');
  const [customPath, setCustomPath] = useState<string | null>(null);
  
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  const [videoState, setVideoState] = useState<VideoState>({
    url: '',
    format: 'mp4',
    quality: '1080p',
    isDownloading: false,
    progress: 0,
    status: 'idle',
    statusText: '',
  });

  // Automatically fetch video or playlist details & available qualities
  useEffect(() => {
    const fetchInfo = async () => {
      const trimmed = url.trim();
      if (!trimmed || (!trimmed.includes('youtube.com/') && !trimmed.includes('youtu.be/'))) {
        setVideoInfo(null);
        return;
      }

      setIsFetchingInfo(true);
      try {
        const firstUrl = trimmed.split('\n')[0].trim();
        const res = await fetch('http://localhost:3001/api/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: firstUrl })
        });
        if (res.ok) {
          const data: VideoInfo = await res.json();
          setVideoInfo(data);
          if (data.availableQualities && data.availableQualities.length > 0) {
            setQuality(data.availableQualities[0]); // Select max available quality automatically
          }
        } else {
          setVideoInfo(null);
        }
      } catch (e) {
        console.error('Failed to fetch video info', e);
        setVideoInfo(null);
      } finally {
        setIsFetchingInfo(false);
      }
    };

    const timer = setTimeout(fetchInfo, 600);
    return () => clearTimeout(timer);
  }, [url]);

  const selectFolder = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/select-folder', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        return data.selectedPath; // Returns selected folder path or null if canceled
      }
    } catch (e) {
      console.error('Failed to open folder dialog', e);
    }
    return null;
  };

  const handleDownloadClick = async () => {
    if (!url.trim()) return;

    // Open native Windows Folder Picker Dialog before download begins
    const selected = await selectFolder();
    if (!selected) {
      return; // User canceled folder selection
    }

    setCustomPath(selected);

    setVideoState({
      url,
      format,
      quality: format === 'mp4' ? quality : `${audioBitrate} kbps`,
      isDownloading: true,
      progress: 0,
      status: 'downloading',
      statusText: 'Подключение к серверу Nimbo...',
    });

    try {
      const response = await fetch('http://localhost:3001/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          format,
          quality,
          audioBitrate,
          savePath: selected
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Ошибка связи с бэкенд-сервером');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.status === 'downloading') {
                setVideoState(prev => ({
                  ...prev,
                  progress: data.progress,
                  statusText: data.message
                }));
              } else if (data.status === 'processing') {
                setVideoState(prev => ({
                  ...prev,
                  progress: 95,
                  statusText: data.message
                }));
              } else if (data.status === 'completed') {
                setVideoState(prev => ({
                  ...prev,
                  progress: 100,
                  isDownloading: false,
                  status: 'completed',
                  statusText: data.message
                }));

                confetti({
                  particleCount: 100,
                  spread: 80,
                  colors: ['#FFD1ED', '#D4B2FF', '#A2E3FF', '#FFF3C4'],
                  origin: { y: 0.6 }
                });
              } else if (data.status === 'error') {
                setVideoState(prev => ({
                  ...prev,
                  isDownloading: false,
                  status: 'error',
                  statusText: data.message
                }));
              }
            } catch (e) {
              console.error('Error parsing SSE data', e);
            }
          }
        }
      }
    } catch (err: any) {
      setVideoState(prev => ({
        ...prev,
        isDownloading: false,
        status: 'error',
        statusText: `Ошибка: ${err.message}`
      }));
    }
  };

  const isMultiUrl = url.trim().split('\n').filter(u => u.trim()).length > 1;

  return (
    <div className="glass-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-badge">
          <Sparkles size={14} className="sparkle-icon" />
          <span>Nimbo</span>
        </div>
        <h1 className="app-title">Nimbo</h1>
        <p className="app-subtitle">Элегантное скачивание видео и аудио с YouTube в выбранную папку</p>
      </header>

      {/* Format Selector Tabs */}
      <div className="format-tabs">
        <div 
          className="tab-slider" 
          style={{ transform: format === 'mp4' ? 'translateX(0%)' : 'translateX(100%)' }}
        />
        <button 
          className={`tab-btn ${format === 'mp4' ? 'active' : ''}`}
          onClick={() => setFormat('mp4')}
        >
          <Video size={18} />
          <span>Видео MP4</span>
        </button>
        <button 
          className={`tab-btn ${format === 'mp3' ? 'active' : ''}`}
          onClick={() => setFormat('mp3')}
        >
          <Music size={18} />
          <span>Аудио MP3</span>
        </button>
      </div>

      {/* URL Input */}
      <div className="input-group">
        {isMultiUrl ? (
          <textarea 
            className="url-input multi-url-input"
            placeholder="Вставьте ссылки на YouTube (по одной на строку)..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        ) : (
          <input 
            type="text"
            className="url-input single-url-input"
            placeholder="Вставьте ссылку на YouTube (видео или плейлист)..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        <Play className="input-icon" size={20} />
        {url && (
          <button className="clear-btn" onClick={() => { setUrl(''); setVideoInfo(null); }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading state for info */}
      {isFetchingInfo && (
        <div className="progress-card" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Loader2 className="animate-spin" size={20} color="var(--iridescent-purple)" />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Загрузка превью и доступных качеств ролика...</span>
        </div>
      )}

      {/* Video / Playlist Preview Card */}
      {videoInfo && !isFetchingInfo && (
        <div className="progress-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
          {videoInfo.thumbnail ? (
            <img 
              src={videoInfo.thumbnail} 
              alt={videoInfo.title} 
              style={{ width: '130px', height: '80px', borderRadius: '14px', objectFit: 'cover', border: '1px solid var(--border-holo)' }}
            />
          ) : (
            <div style={{ width: '130px', height: '80px', borderRadius: '14px', background: 'var(--iridescent-btn)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListVideo size={32} color="#121216" />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {videoInfo.title}
            </span>
            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} color="var(--iridescent-purple)" /> {videoInfo.uploader}
              </span>
              {videoInfo.isPlaylist ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--iridescent-yellow)', fontWeight: 600 }}>
                  <Layers size={14} /> Плейлист: {videoInfo.itemCount} элементов
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={14} color="var(--iridescent-blue)" /> {videoInfo.duration}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Options Selection Grid: Displayed ONLY after video info is loaded */}
      {videoInfo && !isFetchingInfo && (
        <div className="options-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
          {format === 'mp4' ? (
            <div className="option-card">
              <span className="option-label">Выберите качество видео (из доступных)</span>
              <select 
                className="option-select" 
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                {videoInfo.availableQualities && videoInfo.availableQualities.length > 0 ? (
                  videoInfo.availableQualities.map((q) => (
                    <option key={q} value={q}>
                      {q === '2160p' ? '4K Ultra HD (2160p)' :
                       q === '1440p' ? '2K Quad HD (1440p)' :
                       q === '1080p' ? 'Full HD (1080p)' :
                       q === '720p' ? 'HD (720p)' :
                       q === '480p' ? 'SD (480p)' :
                       q === '360p' ? '360p (SD)' :
                       `${q} (Доступно)`}
                    </option>
                  ))
                ) : (
                  <option value="1080p">Full HD (1080p)</option>
                )}
              </select>
            </div>
          ) : (
            <div className="option-card">
              <span className="option-label">Битрейт Аудио</span>
              <select 
                className="option-select" 
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value)}
              >
                <option value="320">320 kbps (Максимальное качество)</option>
                <option value="256">256 kbps (Высокое)</option>
                <option value="192">192 kbps (Стандартное)</option>
                <option value="128">128 kbps (Экономия места)</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Main Download Button with folder dialog trigger */}
      <button 
        className="download-btn"
        disabled={!url.trim() || isFetchingInfo || videoState.isDownloading}
        onClick={handleDownloadClick}
      >
        {videoState.isDownloading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Скачивание...</span>
          </>
        ) : (
          <>
            <FolderOpen size={20} />
            <span>Выбрать место и скачать {format.toUpperCase()}</span>
          </>
        )}
      </button>

      {/* Progress & Status Indicator */}
      {videoState.status !== 'idle' && (
        <div className="progress-card">
          <div className="progress-header">
            <div className="video-info">
              <div className="video-details">
                <span className="video-title">{videoInfo ? videoInfo.title : 'Загрузка...'}</span>
                <span className="video-meta">
                  Формат: {videoState.format.toUpperCase()} | Настройка: {videoState.quality}
                </span>
              </div>
            </div>
            {videoState.status === 'completed' && (
              <CheckCircle2 color="#A2E3FF" size={24} />
            )}
            {videoState.status === 'error' && (
              <AlertCircle color="#EF4444" size={24} />
            )}
          </div>

          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill"
              style={{ width: `${videoState.progress}%`, background: videoState.status === 'error' ? '#EF4444' : undefined }}
            ></div>
          </div>

          <div className="progress-status">
            <span>{videoState.statusText}</span>
            <span>{videoState.progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
