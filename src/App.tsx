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
  Layers,
  Globe
} from 'lucide-react';
import confetti from 'canvas-confetti';

type FormatType = 'mp4' | 'mp3';
type Language = 'ru' | 'en';

const TRANSLATIONS = {
  ru: {
    slogan: 'Ваш контент — без ограничений и в лучшем качестве',
    tabVideo: 'Видео MP4',
    tabAudio: 'Аудио MP3',
    placeholderSingle: 'Вставьте ссылку на YouTube (видео или плейлист)...',
    placeholderMulti: 'Вставьте ссылки на YouTube (по одной на строку)...',
    fetchingInfo: 'Загрузка превью и доступных качеств ролика...',
    playlistVideos: 'видео в плейлисте',
    playlistQualityHeader: 'Качество для плейлиста',
    videoQualityHeader: 'Доступное качество видео',
    audioBitrateHeader: 'Битрейт звука MP3',
    btnDownload: (fmt: string) => `Выбрать место и скачать ${fmt}`,
    btnDownloading: 'Скачивание...',
    connecting: 'Подключение к серверу Nimbo...',
    formatLabel: 'Формат',
    settingLabel: 'Настройка',
    unknownTitle: 'Загрузка...',
    serverError: 'Ошибка связи с бэкенд-сервером',
    audioBitrateDesc: {
      '320': 'HQ звук',
      '256': 'Высокое',
      '192': 'Стандарт',
      '128': 'Компакт'
    } as Record<string, string>,
    qualityLabels: {
      '2160p': '4K Ultra HD',
      '1440p': '2K Quad HD',
      '1080p': 'Full HD (1080p)',
      '720p': 'HD (720p)',
      '480p': '480p (SD)',
      '360p': '360p (Компакт)'
    } as Record<string, string>
  },
  en: {
    slogan: 'Your content — without limits and in the best quality',
    tabVideo: 'Video MP4',
    tabAudio: 'Audio MP3',
    placeholderSingle: 'Paste YouTube link (video or playlist)...',
    placeholderMulti: 'Paste YouTube links (one per line)...',
    fetchingInfo: 'Fetching preview and available video qualities...',
    playlistVideos: 'videos in playlist',
    playlistQualityHeader: 'Playlist video quality',
    videoQualityHeader: 'Available video quality',
    audioBitrateHeader: 'MP3 audio bitrate',
    btnDownload: (fmt: string) => `Select folder & download ${fmt}`,
    btnDownloading: 'Downloading...',
    connecting: 'Connecting to Nimbo engine...',
    formatLabel: 'Format',
    settingLabel: 'Quality',
    unknownTitle: 'Loading...',
    serverError: 'Failed to connect to backend server',
    audioBitrateDesc: {
      '320': 'HQ Audio',
      '256': 'High',
      '192': 'Standard',
      '128': 'Compact'
    } as Record<string, string>,
    qualityLabels: {
      '2160p': '4K Ultra HD',
      '1440p': '2K Quad HD',
      '1080p': 'Full HD (1080p)',
      '720p': 'HD (720p)',
      '480p': '480p (SD)',
      '360p': '360p (Compact)'
    } as Record<string, string>
  }
};

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

interface QualityOption {
  value: string;
  tag: string;
  label: string;
  isUltra?: boolean;
}

const getQualityOption = (q: string, lang: Language): QualityOption => {
  const label = TRANSLATIONS[lang].qualityLabels[q] || q;
  if (q === '2160p') return { value: '2160p', tag: '4K', label, isUltra: true };
  if (q === '1440p') return { value: '1440p', tag: '2K', label, isUltra: true };
  if (q === '1080p') return { value: '1080p', tag: '1080p', label };
  if (q === '720p') return { value: '720p', tag: '720p', label };
  if (q === '480p') return { value: '480p', tag: '480p', label };
  if (q === '360p') return { value: '360p', tag: '360p', label };
  return { value: q, tag: q, label };
};

const AUDIO_BITRATE_KEYS = ['320', '256', '192', '128'];

export function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('nimbo_lang');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });
  const t = TRANSLATIONS[lang];

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
    const trimmed = url.trim();
    if (!trimmed) {
      setVideoInfo(null);
      setVideoState({
        url: '',
        format: 'mp4',
        quality: '1080p',
        isDownloading: false,
        progress: 0,
        status: 'idle',
        statusText: '',
      });
      return;
    }

    if (!trimmed.includes('youtube.com/') && !trimmed.includes('youtu.be/')) {
      setVideoInfo(null);
      return;
    }

    const fetchInfo = async () => {
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
            setQuality(prev => (data.availableQualities!.includes(prev) ? prev : data.availableQualities![0]));
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
      statusText: t.connecting,
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
        throw new Error(t.serverError);
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

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('nimbo_lang', newLang);
  };

  return (
    <div className="glass-container">
      {/* Top-Right Holographic Language Toggle */}
      <div className="lang-toggle-wrap">
        <div className="lang-toggle">
          <div 
            className="lang-slider" 
            style={{ transform: lang === 'ru' ? 'translateX(0%)' : 'translateX(100%)' }}
          />
          <button 
            type="button"
            className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('ru')}
            title="Русский язык"
          >
            RU
          </button>
          <button 
            type="button"
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('en')}
            title="English language"
          >
            EN
          </button>
        </div>
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="logo-badge">
          <Sparkles size={14} className="sparkle-icon" />
          <span>Nimbo</span>
        </div>
        <h1 className="app-title">Nimbo</h1>
        <p className="app-subtitle">{t.slogan}</p>
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
          <span>{t.tabVideo}</span>
        </button>
        <button 
          className={`tab-btn ${format === 'mp3' ? 'active' : ''}`}
          onClick={() => setFormat('mp3')}
        >
          <Music size={18} />
          <span>{t.tabAudio}</span>
        </button>
      </div>

      {/* URL Input */}
      <div className="input-group">
        {isMultiUrl ? (
          <textarea 
            className="url-input multi-url-input"
            placeholder={t.placeholderMulti}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        ) : (
          <input 
            type="text"
            className="url-input single-url-input"
            placeholder={t.placeholderSingle}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        <Play className="input-icon" size={20} />
        {url && (
          <button 
            className="clear-btn" 
            onClick={() => { 
              setUrl(''); 
              setVideoInfo(null);
              setVideoState({
                url: '',
                format: 'mp4',
                quality: '1080p',
                isDownloading: false,
                progress: 0,
                status: 'idle',
                statusText: '',
              });
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading state for info */}
      {isFetchingInfo && (
        <div className="progress-card" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Loader2 className="animate-spin" size={20} color="var(--iridescent-purple)" />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t.fetchingInfo}</span>
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
            <div style={{ width: '130px', height: '80px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListVideo size={28} color="var(--iridescent-purple)" />
            </div>
          )}

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {videoInfo.title}
            </h4>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {videoInfo.isPlaylist ? (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Layers size={13} color="var(--iridescent-purple)" /> {videoInfo.itemCount} {t.playlistVideos}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={13} /> {videoInfo.uploader}
                  </span>
                  {videoInfo.duration && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={13} /> {videoInfo.duration}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quality Selection - Ergonomic & Integrated into the Holographic UI */}
      {videoInfo && !isFetchingInfo && (
        <div className="quality-section">
          <div className="quality-header">
            <div className="quality-title-wrapper">
              {format === 'mp4' ? (
                <>
                  <Video size={15} color="var(--iridescent-purple)" />
                  <span>{videoInfo.isPlaylist ? t.playlistQualityHeader : t.videoQualityHeader}</span>
                </>
              ) : (
                <>
                  <Music size={15} color="var(--iridescent-blue)" />
                  <span>{t.audioBitrateHeader}</span>
                </>
              )}
            </div>
            <span className="quality-pill-badge">
              {format === 'mp4' ? quality : `${audioBitrate} kbps`}
            </span>
          </div>

          {format === 'mp4' ? (
            <div className="quality-grid">
              {(videoInfo.availableQualities && videoInfo.availableQualities.length > 0 
                ? videoInfo.availableQualities 
                : ['1080p', '720p', '480p', '360p']
              ).map((q) => {
                const opt = getQualityOption(q, lang);
                const isSelected = quality === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`quality-card-btn ${isSelected ? 'active' : ''} ${opt.isUltra ? 'ultra' : ''}`}
                    onClick={() => setQuality(opt.value)}
                  >
                    <span className="quality-badge">{opt.tag}</span>
                    <span className="quality-name">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="quality-grid">
              {AUDIO_BITRATE_KEYS.map((key) => {
                const isSelected = audioBitrate === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`quality-card-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => setAudioBitrate(key)}
                  >
                    <span className="quality-badge">{key}k</span>
                    <div className="quality-audio-info">
                      <span className="quality-name">{key} kbps</span>
                      <span className="quality-desc">{t.audioBitrateDesc[key]}</span>
                    </div>
                  </button>
                );
              })}
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
            <span>{t.btnDownloading}</span>
          </>
        ) : (
          <>
            <FolderOpen size={20} />
            <span>{t.btnDownload(format.toUpperCase())}</span>
          </>
        )}
      </button>

      {/* Progress & Status Indicator - strictly hidden when input URL is cleared */}
      {videoState.status !== 'idle' && url.trim() && (
        <div className="progress-card">
          <div className="progress-header">
            <div className="video-info">
              <div className="video-details">
                <span className="video-title">{videoInfo ? videoInfo.title : t.unknownTitle}</span>
                <span className="video-meta">
                  {t.formatLabel}: {videoState.format.toUpperCase()} | {t.settingLabel}: {videoState.quality}
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
