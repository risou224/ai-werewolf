import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { SpectatorView } from './pages/spectator/SpectatorView.js';
import { ModelList } from './pages/admin/ModelList.js';
import { GameConfigPanel } from './pages/admin/GameConfigPanel.js';
import { ReplayViewer } from './pages/replay/ReplayViewer.js';

const NAV_ITEMS = [
  { path: '/', label: '观战台', icon: '🎮' },
  { path: '/admin/models', label: '模型管理', icon: '🤖' },
  { path: '/admin/game', label: '游戏配置', icon: '⚙️' },
  { path: '/replay', label: '回放', icon: '📺' },
];

const App: React.FC = () => {
  const location = useLocation();
  const isGamePage = location.pathname === '/' || location.pathname.startsWith('/replay/');

  return (
    <div className="min-h-screen bg-werewolf-bg text-white flex flex-col">
      {/* 顶部导航 */}
      <nav className="bg-gray-900/90 border-b border-gray-800 px-4 py-2 flex items-center gap-1 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-2 mr-6">
          <span className="text-xl">🐺</span>
          <span className="font-bold text-amber-400 text-sm">AI狼人杀</span>
        </div>
        {NAV_ITEMS.map(item => {
          const active = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                active
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {item.icon} {item.label}
            </NavLink>
          );
        })}

        {/* 退出软件（打包版用）：先保存数据库再退出 */}
        <div className="ml-auto flex items-center gap-2">
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
            className="px-3 py-1.5 rounded-md text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-colors"
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
    </div>
  );
};

export default App;
