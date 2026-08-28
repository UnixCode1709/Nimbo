import { useState, useEffect, useRef } from 'react';
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
  Globe,
  Clipboard,
  Palette,
  History,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';

type FormatType = 'mp4' | 'mp3';
type Language = 'ru' | 'en';
type Theme = 'obsidian-holo' | 'pearl-aurora' | 'midnight-cyber' | 'velvet-nebula' | 'emerald-minimal';

interface ThemeInfo {
  id: Theme;
  color: string;
}

const THEMES_LIST: ThemeInfo[] = [
  { id: 'obsidian-holo', color: '#D4B2FF' },
  { id: 'pearl-aurora', color: '#9333EA' },
  { id: 'midnight-cyber', color: '#00F0FF' },
  { id: 'velvet-nebula', color: '#C77DFF' },
  { id: 'emerald-minimal', color: '#34D399' },
];

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  uploader: string;
  format: FormatType;
  quality: string;
  timestamp: number;
  folder: string;
  filePath?: string;
  duration?: string;
}

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
    btnPaste: 'Вставить из буфера',
    clipboardToast: 'Ссылка обнаружена в буфере и вставлена!',
    themeLabel: 'Тема оформления',
    historyBtn: 'История',
    historyTitle: 'История загрузок',
    historyEmptyTitle: 'История загрузок пуста',
    historyEmptyDesc: 'Скачанные видео и аудио треки будут сохраняться здесь',
    historyClearAll: 'Очистить всё',
    historyClearConfirm: 'Вы действительно хотите очистить историю загрузок?',
    historyItemOpenFolder: 'Открыть папку',
    historyItemOpenFile: 'Воспроизвести файл',
    historyItemCopyLink: 'Скопировать ссылку',
    historyItemCopied: 'Ссылка скопирована!',
    historyItemReDownload: 'Загрузить снова',
    historyItemDelete: 'Удалить из списка',
    historyCount: (n: number) => `${n} ${n === 1 ? 'запись' : (n >= 2 && n <= 4 ? 'записи' : 'записей')}`,
    themes: {
      'obsidian-holo': 'Obsidian (Тёмная)',
      'pearl-aurora': 'Pearl (Светлая)',
      'midnight-cyber': 'Midnight (Киберпанк)',
      'velvet-nebula': 'Velvet (Небула)',
      'emerald-minimal': 'Emerald (Изумруд)'
    } as Record<Theme, string>,
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
    btnPaste: 'Paste from clipboard',
    clipboardToast: 'Link detected in clipboard and pasted!',
    themeLabel: 'Theme',
    historyBtn: 'History',
    historyTitle: 'Download History',
    historyEmptyTitle: 'History is empty',
    historyEmptyDesc: 'Your downloaded videos and music tracks will appear here',
    historyClearAll: 'Clear all',
    historyClearConfirm: 'Are you sure you want to clear your download history?',
    historyItemOpenFolder: 'Open folder',
    historyItemOpenFile: 'Play file',
    historyItemCopyLink: 'Copy link',
    historyItemCopied: 'Link copied!',
    historyItemReDownload: 'Download again',
    historyItemDelete: 'Remove from history',
    historyCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
    themes: {
      'obsidian-holo': 'Obsidian (Dark)',
      'pearl-aurora': 'Pearl (Light)',
      'midnight-cyber': 'Midnight (Cyber)',
      'velvet-nebula': 'Velvet (Nebula)',
      'emerald-minimal': 'Emerald (Minimal)'
    } as Record<Theme, string>,
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

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('nimbo_theme') as Theme;
    return saved || 'obsidian-holo';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [isNimbiHappy, setIsNimbiHappy] = useState(false);

  const handleNimbiClick = () => {
    setIsNimbiHappy(true);
    try {
      confetti({
        particleCount: 16,
        spread: 45,
        origin: { y: 0.22 },
        colors: ['#FFD1ED', '#D4B2FF', '#A2E3FF', '#FFF3C4'],
        scalar: 0.75,
        ticks: 100,
        shapes: ['star']
      });
    } catch (e) {}

    setTimeout(() => {
      setIsNimbiHappy(false);
    }, 1400);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nimbo_theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<FormatType>('mp4');
  const [quality, setQuality] = useState('1080p');
  const [audioBitrate, setAudioBitrate] = useState('320');
  const [customPath, setCustomPath] = useState<string | null>(null);
  
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lastPastedUrl, setLastPastedUrl] = useState<string>('');

  const [videoState, setVideoState] = useState<VideoState>({
    url: '',
    format: 'mp4',
    quality: '1080p',
    isDownloading: false,
    progress: 0,
    status: 'idle',
    statusText: '',
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('nimbo_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem('nimbo_history', JSON.stringify(items));
  };

  const handleClearHistory = () => {
    if (history.length === 0) return;
    if (window.confirm(t.historyClearConfirm)) {
      saveHistory([]);
    }
  };

  const handleRemoveHistoryItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistory(updated);
  };

  const handleOpenFolder = async (folder?: string, filePath?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch('http://localhost:3001/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, filePath })
      });
    } catch (err) {
      console.error('Failed to open folder', err);
    }
  };

  const handleOpenFile = async (filePath?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!filePath) return;
    try {
      const res = await fetch('http://localhost:3001/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (!res.ok) {
        // Fallback to opening containing folder
        handleOpenFolder(undefined, filePath);
      }
    } catch (err) {
      console.error('Failed to open file', err);
    }
  };

  const handleCopyUrl = (id: string, itemUrl: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      navigator.clipboard.writeText(itemUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const handleReDownload = (item: HistoryItem) => {
    setUrl(item.url);
    setFormat(item.format);
    if (item.format === 'mp4') {
      setQuality(item.quality);
    } else {
      const br = item.quality.replace(/\D/g, '');
      if (br && AUDIO_BITRATE_KEYS.includes(br)) {
        setAudioBitrate(br);
      }
    }
    setIsHistoryOpen(false);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const handleAutoPaste = (clipText: string) => {
    const trimmed = (clipText || '').trim();
    if (!trimmed) return;
    if (!trimmed.includes('youtube.com/') && !trimmed.includes('youtu.be/')) return;
    if (trimmed === url.trim() || trimmed === lastPastedUrl) return;

    setLastPastedUrl(trimmed);
    setUrl(trimmed);
    showToast(t.clipboardToast);
  };

  const handleManualPaste = async () => {
    try {
      let text = '';
      if ((window as any).require) {
        const { clipboard } = (window as any).require('electron');
        text = clipboard.readText();
      } else if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        const trimmed = text.trim();
        setUrl(trimmed);
        setLastPastedUrl(trimmed);
        showToast(t.clipboardToast);
      }
    } catch (e) {
      console.error('Failed to read clipboard', e);
    }
  };

  useEffect(() => {
    // Electron IPC listener for window focus & global hotkey Ctrl+Shift+D
    if ((window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        const listener = (_: any, clipUrl: string) => {
          handleAutoPaste(clipUrl);
        };
        ipcRenderer.on('clipboard-url-detected', listener);
        return () => {
          ipcRenderer.removeListener('clipboard-url-detected', listener);
        };
      } catch (e) {}
    }

    // Web / Window focus listener fallback
    const onFocus = async () => {
      try {
        if ((window as any).require) {
          const { clipboard } = (window as any).require('electron');
          const text = clipboard.readText();
          handleAutoPaste(text);
        } else if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          handleAutoPaste(text);
        }
      } catch (e) {}
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [url, lastPastedUrl, t]);

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

    // Immediately clear previous error or completed status when pasting/typing a new URL
    setVideoState(prev => {
      if (prev.isDownloading) return prev;
      return {
        url: trimmed,
        format: prev.format,
        quality: prev.quality,
        isDownloading: false,
        progress: 0,
        status: 'idle',
        statusText: '',
      };
    });

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

                const newItem: HistoryItem = {
                  id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  url: url.trim(),
                  title: videoInfo?.title || 'YouTube Video',
                  thumbnail: videoInfo?.thumbnail || '',
                  uploader: videoInfo?.uploader || 'YouTube',
                  format,
                  quality: format === 'mp4' ? quality : `${audioBitrate} kbps`,
                  timestamp: Date.now(),
                  folder: data.folder || selected,
                  filePath: data.filePath || undefined,
                  duration: videoInfo?.duration
                };

                setHistory(prev => {
                  const filtered = prev.filter(h => !(h.url === newItem.url && h.format === newItem.format && h.quality === newItem.quality));
                  const updated = [newItem, ...filtered].slice(0, 100);
                  localStorage.setItem('nimbo_history', JSON.stringify(updated));
                  return updated;
                });

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

  const formatTimestamp = (ts: number, currentLang: Language) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return currentLang === 'ru' ? `Сегодня, ${timeStr}` : `Today, ${timeStr}`;
    }
    return d.toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-container">
      {/* Top-Left Theme Selector */}
      <div className="top-left-controls-wrap" ref={themeMenuRef}>
        <div className="theme-selector-container">
          <button 
            type="button"
            className="theme-trigger-btn"
            onClick={() => setIsThemeMenuOpen(prev => !prev)}
            title={t.themeLabel}
          >
            <Palette size={14} />
            <span 
              className="theme-dot" 
              style={{ backgroundColor: THEMES_LIST.find(th => th.id === theme)?.color }} 
            />
          </button>

          {isThemeMenuOpen && (
            <div className="theme-menu">
              {THEMES_LIST.map(th => (
                <button
                  key={th.id}
                  type="button"
                  className={`theme-option-btn ${theme === th.id ? 'active' : ''}`}
                  onClick={() => {
                    setTheme(th.id);
                    setIsThemeMenuOpen(false);
                  }}
                >
                  <span className="theme-dot" style={{ backgroundColor: th.color }} />
                  <span>{t.themes[th.id]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top-Right Controls: History Button + Language Switcher */}
      <div className="top-right-controls-wrap">
        <button 
          type="button"
          className="history-trigger-btn"
          onClick={() => setIsHistoryOpen(true)}
          title={t.historyTitle}
        >
          <History size={14} />
          <span>{t.historyBtn}</span>
          {history.length > 0 && (
            <span className="history-badge">{history.length}</span>
          )}
        </button>

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

      {/* Header with 3D Mascot Logo (Nimbi) */}
      <header className="app-header">
        <div 
          className="mascot-header-wrap" 
          onClick={handleNimbiClick}
          title={lang === 'ru' ? 'Погладить Нимби ✨' : 'Pet Nimbi ✨'}
        >
          <img 
            src="./mascot_logo.png" 
            alt="Nimbi Open Eyes" 
            className={`mascot-header-img ${isNimbiHappy ? 'hidden' : 'visible'}`} 
          />
          <img 
            src="./mascot_happy.png" 
            alt="Nimbi Happy Eyes" 
            className={`mascot-header-img ${isNimbiHappy ? 'visible' : 'hidden'}`} 
          />
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
        {url ? (
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
        ) : (
          <button 
            className="paste-btn" 
            onClick={handleManualPaste}
            title={t.btnPaste}
          >
            <Clipboard size={14} />
            <span>{t.btnPaste}</span>
          </button>
        )}
      </div>

      {/* Smart Clipboard Auto-Paste Toast Banner */}
      {toastMsg && (
        <div className="clipboard-toast">
          <Sparkles size={14} color="var(--iridescent-cyan)" />
          <span>{toastMsg}</span>
        </div>
      )}

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
            {videoState.status !== 'error' && (
              <span>{videoState.progress}%</span>
            )}
          </div>
        </div>
      )}

      {/* Download History Modal */}
      {isHistoryOpen && (
        <div className="modal-backdrop" onClick={() => setIsHistoryOpen(false)}>
          <div className="modal-content history-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <History size={20} className="modal-icon" />
                <div className="modal-title-text">
                  <h3>{t.historyTitle}</h3>
                  <span className="modal-subtitle">{t.historyCount(history.length)}</span>
                </div>
              </div>
              <div className="modal-header-actions">
                {history.length > 0 && (
                  <button 
                    type="button" 
                    className="modal-clear-btn"
                    onClick={handleClearHistory}
                    title={t.historyClearAll}
                  >
                    <Trash2 size={14} />
                    <span>{t.historyClearAll}</span>
                  </button>
                )}
                <button 
                  type="button" 
                  className="modal-close-btn"
                  onClick={() => setIsHistoryOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="history-list-container">
              {history.length === 0 ? (
                <div className="history-empty-state">
                  <img src="./mascot_happy.png" alt="Nimbi Happy" className="history-empty-mascot" />
                  <h4>{t.historyEmptyTitle}</h4>
                  <p>{t.historyEmptyDesc}</p>
                </div>
              ) : (
                <div className="history-items-grid">
                  {history.map((item) => (
                    <div key={item.id} className="history-card">
                      <div className="history-card-thumb-wrap">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} className="history-card-thumb" />
                        ) : (
                          <div className="history-card-thumb-placeholder">
                            {item.format === 'mp3' ? <Music size={24} /> : <Video size={24} />}
                          </div>
                        )}
                        <span className={`history-format-badge ${item.format}`}>
                          {item.format.toUpperCase()}
                        </span>
                        <span className="history-quality-badge">
                          {item.quality}
                        </span>
                        {item.duration && (
                          <span className="history-duration-badge">
                            {item.duration}
                          </span>
                        )}
                      </div>

                      <div className="history-card-body">
                        <h4 className="history-card-title" title={item.title}>
                          {item.title}
                        </h4>
                        <div className="history-card-meta">
                          <span className="history-uploader">{item.uploader}</span>
                          <span className="history-dot">•</span>
                          <span className="history-time">{formatTimestamp(item.timestamp, lang)}</span>
                        </div>
                      </div>

                      <div className="history-card-actions">
                        <button
                          type="button"
                          className="history-action-btn"
                          onClick={(e) => handleOpenFolder(item.folder, item.filePath, e)}
                          title={t.historyItemOpenFolder}
                        >
                          <FolderOpen size={16} />
                        </button>
                        {item.filePath && (
                          <button
                            type="button"
                            className="history-action-btn"
                            onClick={(e) => handleOpenFile(item.filePath, e)}
                            title={t.historyItemOpenFile}
                          >
                            <Play size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="history-action-btn"
                          onClick={(e) => handleCopyUrl(item.id, item.url, e)}
                          title={copiedId === item.id ? t.historyItemCopied : t.historyItemCopyLink}
                        >
                          {copiedId === item.id ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                        </button>
                        <button
                          type="button"
                          className="history-action-btn"
                          onClick={() => handleReDownload(item)}
                          title={t.historyItemReDownload}
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          type="button"
                          className="history-action-btn delete"
                          onClick={(e) => handleRemoveHistoryItem(item.id, e)}
                          title={t.historyItemDelete}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
