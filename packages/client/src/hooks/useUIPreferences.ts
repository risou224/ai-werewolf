import { useState, useEffect, useCallback } from 'react';

export type WallpaperId = 'starry' | 'moon' | 'custom';

export interface UIPreferences {
  /** font-family 字符串；空字符串 = 默认字体 */
  fontFamily: string;
  /** 壁纸预设：星夜 / 月圆 / 自定义上传 */
  wallpaper: WallpaperId;
  /** 自定义壁纸（dataURL），仅在 wallpaper === 'custom' 时生效 */
  customWallpaper: string | null;
}

const STORAGE_KEY = 'ai-werewolf-ui-preferences';

const DEFAULTS: UIPreferences = {
  fontFamily: '',
  wallpaper: 'starry',
  customWallpaper: null,
};

/** 字体选择项（展示名 + font-family 值） */
export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: '默认字体', value: '' },
  { label: '微软雅黑', value: '"Microsoft YaHei", "微软雅黑", sans-serif' },
  { label: '苹方', value: '"PingFang SC", "苹方-简", sans-serif' },
  { label: '思源黑体', value: '"Source Han Sans SC", "Noto Sans SC", sans-serif' },
  { label: '楷体', value: '"KaiTi", "楷体", "STKaiti", serif' },
  { label: '宋体', value: '"SimSun", "宋体", "STSong", serif' },
  { label: '圆体', value: '"Yuanti SC", "幼圆", "YouYuan", sans-serif' },
];

function loadPrefs(): UIPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

/**
 * UI 偏好：字体 + 壁纸。
 * 字体写入 document.documentElement.style.fontFamily；
 * 壁纸通过 body 上的 class（wallpaper-starry/moon/custom）生效，见 index.css。
 */
export function useUIPreferences() {
  const [prefs, setPrefs] = useState<UIPreferences>(loadPrefs);

  // 应用字体
  useEffect(() => {
    document.documentElement.style.fontFamily = prefs.fontFamily || '';
  }, [prefs.fontFamily]);

  // 应用壁纸
  useEffect(() => {
    const body = document.body;
    body.classList.remove('wallpaper-starry', 'wallpaper-moon', 'wallpaper-custom');

    if (prefs.wallpaper === 'custom' && prefs.customWallpaper) {
      body.classList.add('wallpaper-custom');
      body.style.setProperty('--custom-wallpaper', `url("${prefs.customWallpaper}")`);
    } else if (prefs.wallpaper === 'starry' || prefs.wallpaper === 'moon') {
      body.classList.add(`wallpaper-${prefs.wallpaper}`);
      body.style.removeProperty('--custom-wallpaper');
    }
  }, [prefs.wallpaper, prefs.customWallpaper]);

  const update = useCallback((patch: Partial<UIPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage 满（大图）时静默失败，仅本次会话生效
      }
      return next;
    });
  }, []);

  /** 读取上传的图片文件 → dataURL，超限（5MB）返回 null */
  const readImageFile = useCallback((file: File): Promise<string | null> => {
    return new Promise(resolve => {
      if (!file.type.startsWith('image/')) return resolve(null);
      if (file.size > 5 * 1024 * 1024) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  return { prefs, update, readImageFile };
}
