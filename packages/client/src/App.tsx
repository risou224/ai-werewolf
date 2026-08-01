import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { SpectatorView } from './pages/spectator/SpectatorView.js';
import { ModelList } from './pages/admin/ModelList.js';
import { GameConfigPanel } from './pages/admin/GameConfigPanel.js';
import { ReplayViewer } from './pages/replay/ReplayViewer.js';
import { UISettingsModal } from './components/UISettingsModal.js';

const NAV_ITEMS = [
  { path: '/', label: '观战台' },
  { path: '/admin/models', label: '模型管理' },
  { path: '/admin/game', label: '游戏配置' },
  { path: '/replay', label: '回放' },
];

/** 狼头 logo（SVG） */
const WolfLogo: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
    <defs>
      <linearGradient id="wolf-logo-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffe9a8" />
        <stop offset="100%" stopColor="#f0a020" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#wolf-logo-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 10 L10.5 21 L16 17.4" />
      <path d="M34 10 L37.5 21 L32 17.4" />
      <path d="M12 18.5 C6.5 25 7 32.5 15 36 C20 38 28 38 33 36 C41 32.5 41.5 25 36 18.5 C31.6 20.6 16.4 20.6 12 18.5 Z" />
      <circle cx="18.4" cy="25.8" r="2.1" fill="url(#wolf-logo-g)" stroke="none" />
      <circle cx="29.6" cy="25.8" r="2.1" fill="url(#wolf-logo-g)" stroke="none" />
      <path d="M20.4 31.6 L24 34.4 L27.6 31.6" />
    </g>
  </svg>
);

const App: React.FC = () => {
  const location = useLocation();
  const isGamePage = location.pathname === '/' || location.pathname.startsWith('/replay/');
  const [showUISettings, setShowUISettings] = useState(false);

  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-40 px-4 py-2 flex items-center gap-1
        bg-night-900/75 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-2.5 mr-6">
          <WolfLogo size={26} />
          <span className="font-bold text-base gold-text tracking-wide">AI 狼人杀</span>
        </div>
        {NAV_ITEMS.map(item => {
          const active = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`px-3.5 py-1.5 rounded-badge text-xs font-medium transition-all ${
                active
                  ? 'bg-gold-500/15 text-gold-300 shadow-gold-glow ring-1 ring-gold-400/40'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.06]'
              }`}
            >
              {item.label}
            </NavLink>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {/* 外观设置 */}
          <button
            onClick={() => setShowUISettings(true)}
            title="壁纸与字体"
            className="w-8 h-8 rounded-full flex items-center justify-center text-base
              bg-white/[0.05] hover:bg-white/10 border border-white/10 hover:border-gold-400/40
              text-gray-300 hover:text-gold-300 transition-all"
          >
            🎨
          </button>
          <span className="text-[10px] text-gray-500 hidden md:inline">
            退出：右上角红钮，或关闭黑色控制台窗口
          </span>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm('确定退出软件吗？对局数据会先保存再退出。')) return;
              try {
                const res = await fetch('/api/admin/shutdown', { method: 'POST' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                alert('已保存数据并退出，可关闭本页面。');
              } catch {
                alert('退出指令发送失败，可直接关闭黑色控制台窗口退出。');
              }
            }}
            className="px-3 py-1.5 rounded-badge text-xs font-bold bg-wolfred-500 hover:bg-wolfred-400 text-white transition-colors shadow-[0_0_12px_rgba(233,69,96,0.35)]"
          >
            ⏻ 退出软件
          </button>
        </div>
      </nav>

      {/* 主内容 */}
      <main className={`flex-1 ${isGamePage ? '' : 'p-6 overflow-y-auto'}`}>
        <Routes>
          <Route path="/" element={<SpectatorView />} />
          <Route path="/admin/models" element={<ModelList />} />
          <Route path="/admin/game" element={<GameConfigPanel />} />
          <Route path="/replay" element={<ReplayViewer />} />
          <Route path="/replay/:id" element={<ReplayViewer />} />
        </Routes>
      </main>

      <UISettingsModal open={showUISettings} onClose={() => setShowUISettings(false)} />
    </div>
  );
};

export default App;
