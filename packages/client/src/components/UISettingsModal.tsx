import React, { useRef, useState } from 'react';
import { useUIPreferences, FONT_OPTIONS, type WallpaperId } from '../hooks/useUIPreferences.js';

interface UISettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const WALLPAPER_OPTIONS: { id: WallpaperId; label: string; desc: string; preview: string }[] = [
  {
    id: 'starry',
    label: '星夜',
    desc: '深蓝夜空 · 闪烁星点 · 流星',
    preview: 'linear-gradient(160deg,#05050d 0%,#0a0a16 45%,#14142a 100%)',
  },
  {
    id: 'moon',
    label: '月圆之夜',
    desc: '月光云海 · 蓝色夜幕',
    preview: 'linear-gradient(180deg,#0a0f24 0%,#101a38 55%,#161f3f 100%)',
  },
  {
    id: 'custom',
    label: '自定义上传',
    desc: '使用你自己的图片作背景',
    preview: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.06) 0 10px,transparent 10px 20px)',
  },
];

export const UISettingsModal: React.FC<UISettingsModalProps> = ({ open, onClose }) => {
  const { prefs, update, readImageFile } = useUIPreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReadError(null);
    const dataUrl = await readImageFile(file);
    if (!dataUrl) {
      setReadError('仅支持图片文件，且大小需 ≤ 5MB');
      return;
    }
    update({ customWallpaper: dataUrl, wallpaper: 'custom' });
    setPreview(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[min(520px,92vw)] max-h-[85vh] overflow-y-auto rounded-card p-5 space-y-5 animate-pop-in
          bg-night-900/95 border border-white/15 shadow-card-glow backdrop-blur-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold gold-text tracking-wider">界面外观</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1">✕</button>
        </div>

        {/* ── 壁纸选择 ── */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 mb-2 tracking-wider">动态壁纸</h3>
          <div className="grid grid-cols-3 gap-2">
            {WALLPAPER_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => update({ wallpaper: opt.id })}
                className={`group text-left rounded-lg overflow-hidden border-2 transition-all ${
                  prefs.wallpaper === opt.id
                    ? 'border-gold-400 shadow-gold-glow'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="h-16 w-full relative" style={{ background: opt.preview }}>
                  {/* 星点装饰 */}
                  {opt.id === 'starry' && (
                    <>
                      <span className="absolute top-2 left-3 w-0.5 h-0.5 rounded-full bg-white/90" />
                      <span className="absolute top-5 left-10 w-0.5 h-0.5 rounded-full bg-white/70" />
                      <span className="absolute top-2 right-6 w-0.5 h-0.5 rounded-full bg-white/80" />
                      <span className="absolute bottom-3 left-6 w-0.5 h-0.5 rounded-full bg-white/50" />
                    </>
                  )}
                  {opt.id === 'moon' && (
                    <span className="absolute top-2 right-4 w-5 h-5 rounded-full bg-gradient-to-br from-gold-300 to-gold-600
                      shadow-[0_0_12px_rgba(255,233,168,0.8)]" />
                  )}
                  {opt.id === 'custom' && prefs.customWallpaper && (
                    <img src={prefs.customWallpaper} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {prefs.wallpaper === opt.id && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gold-500 text-night-950
                      flex items-center justify-center text-[10px] font-bold">✓</span>
                  )}
                </div>
                <div className="px-2 py-1.5 bg-white/[0.04]">
                  <div className="text-xs font-medium text-gray-200">{opt.label}</div>
                  <div className="text-[10px] text-gray-500 truncate">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* 自定义上传 */}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/10 border border-white/10 text-gray-200 transition-colors"
            >
              📁 上传背景图片
            </button>
            {prefs.customWallpaper && (
              <button
                onClick={() => { update({ customWallpaper: null }); setPreview(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
              >
                移除已上传
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          {readError && <p className="text-[11px] text-wolfred-400 mt-1.5">{readError}</p>}
          <p className="text-[10px] text-gray-600 mt-1.5">提示：背景图保存在本机浏览器，仅此设备生效；上传 gif 可当作动态背景。</p>
        </div>

        {/* ── 字体选择 ── */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 mb-2 tracking-wider">界面字体</h3>
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.map(font => (
              <button
                key={font.value || '__default__'}
                onClick={() => update({ fontFamily: font.value })}
                className={`px-3 py-2 rounded-lg text-sm border transition-all text-left ${
                  prefs.fontFamily === font.value
                    ? 'border-gold-400 bg-gold-500/10 text-gold-300 shadow-gold-glow'
                    : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/30'
                }`}
                style={{ fontFamily: font.value || undefined }}
              >
                {font.label}
              </button>
            ))}
          </div>
          {/* 自定义字体 */}
          <div className="mt-2 flex items-center gap-2">
            <input
              value={prefs.fontFamily}
              onChange={e => update({ fontFamily: e.target.value })}
              placeholder="自定义 font-family，如: 'STKaiti', '楷体'"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-white/10
                text-gray-200 placeholder-gray-600 outline-none focus:border-gold-400/50 transition-colors"
            />
            <button
              onClick={() => update({ fontFamily: '' })}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors shrink-0"
            >
              恢复默认
            </button>
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-600 pt-1 border-t border-white/5">
          设置自动保存在本机浏览器（localStorage）
        </div>
      </div>
    </div>
  );
};
