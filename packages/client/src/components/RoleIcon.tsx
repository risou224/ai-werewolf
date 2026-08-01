import React from 'react';

/** 身份角色统一图腾（线性 SVG，stroke 风格，viewBox 24×24） */
const TOTEMS: Record<string, React.ReactNode> = {
  // 狼人：尖耳狼头
  wolf: (
    <>
      <path d="M8.2 4.6 L6.6 9.4 L9 7.8" />
      <path d="M15.8 4.6 L17.4 9.4 L15 7.8" />
      <path d="M7 9.2 C4.8 12.4 5 16.4 8.6 18.2 C10.9 19.4 13.1 19.4 15.4 18.2 C19 16.4 19.2 12.4 17 9.2 C15.2 10.2 8.8 10.2 7 9.2 Z" />
      <circle cx="9.4" cy="13.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="13.2" r="1" fill="currentColor" stroke="none" />
      <path d="M10.4 16.4 L12 17.6 L13.6 16.4" />
    </>
  ),
  // 预言家：水晶球 + 底座
  seer: (
    <>
      <circle cx="12" cy="10.6" r="5.8" />
      <path d="M7.6 16.8 L16.4 16.8 M9.2 19.4 L14.8 19.4" />
      <path d="M12 7.6 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 Z" fill="currentColor" stroke="none" />
    </>
  ),
  // 女巫：魔药瓶
  witch: (
    <>
      <path d="M10.4 2.8 h3.2 M11.6 2.8 v3.4 M12.4 2.8 v3.4" />
      <path d="M9.4 6.2 h5.2 l1 11.2 a2 2 0 0 1 -2 2.4 h-3.2 a2 2 0 0 1 -2 -2.4 Z" />
      <circle cx="12" cy="12.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="15.4" r="0.65" fill="currentColor" stroke="none" />
    </>
  ),
  // 猎人：瞄准准星
  hunter: (
    <>
      <circle cx="12" cy="12" r="6.4" />
      <path d="M12 3.6 v3.2 M12 17.2 v3.2 M3.6 12 h3.2 M17.2 12 h3.2" />
      <path d="M6.2 6.2 L8.2 8.2 M17.8 6.2 L15.8 8.2 M6.2 17.8 L8.2 15.8 M17.8 17.8 L15.8 15.8" />
    </>
  ),
  // 白痴：傻帽 + 铃铛
  idiot: (
    <>
      <path d="M8.2 15.4 L12 4.2 L15.8 15.4 Z" />
      <path d="M6.4 16.6 h11.2" />
      <path d="M12 16.6 v2.2" />
      <circle cx="12" cy="20" r="1.3" />
      <circle cx="12" cy="4.2" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  // 平民：人形
  villager: (
    <>
      <circle cx="12" cy="7.6" r="3.2" />
      <path d="M5.8 19.4 C6.6 15.6 9.4 14 12 14 c2.6 0 5.4 1.6 6.2 5.4" />
    </>
  ),
  // 匿名/隐藏：问号（观众视角统一显示，不泄露身份）
  unknown: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9.5 9.3 a2.7 2.7 0 0 1 5.1 1 c0 1.9 -2.6 2.1 -2.6 4" />
      <circle cx="12" cy="16.9" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

/** 身份中文名 */
export const ROLE_LABELS: Record<string, string> = {
  wolf: '狼人', seer: '预言家', witch: '女巫',
  hunter: '猎人', idiot: '白痴', villager: '平民',
};

/** 身份色（CSS color 值，用于内联样式/渐变） */
export const ROLE_COLORS: Record<string, string> = {
  wolf: '#ff5c6c',
  seer: '#a78bfa',
  witch: '#34d399',
  hunter: '#fb923c',
  idiot: '#38bdf8',
  villager: '#94a3b8',
};

/** 身份色（Tailwind class，用于文字/描边） */
export const ROLE_TEXT_CLASS: Record<string, string> = {
  wolf: 'text-role-wolf',
  seer: 'text-role-seer',
  witch: 'text-role-witch',
  hunter: 'text-role-hunter',
  idiot: 'text-role-idiot',
  villager: 'text-role-villager',
};

/**
 * 警长王冠徽章（SVG，替代 emoji 👑）
 */
export const SheriffCrown: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M3 17 L4.2 7.2 L8.4 11.4 L12 4.6 L15.6 11.4 L19.8 7.2 L21 17 Z" />
    <rect x="3.6" y="18.4" width="16.8" height="2.2" rx="1.1" />
  </svg>
);

interface RoleIconProps {
  role: string;
  /** 图腾主体颜色 */
  color?: string;
  /** 圆形底色（默认 identity 色 22% 透明度） */
  bg?: string;
  size?: number;
  /** 是否显示圆形底 */
  withBg?: boolean;
}

/**
 * 角色图腾：圆形渐变底 + 线性 SVG 图腾。
 * 无 emoji，全矢量。
 */
export const RoleIcon: React.FC<RoleIconProps> = ({
  role,
  color,
  bg,
  size = 40,
  withBg = true,
}) => {
  const c = color || ROLE_COLORS[role] || '#94a3b8';
  const icon = TOTEMS[role] || TOTEMS.villager;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: withBg
          ? (bg || `radial-gradient(circle at 32% 28%, ${c}38 0%, ${c}1a 60%, transparent 100%)`)
          : 'transparent',
        boxShadow: withBg ? `inset 0 0 0 1px ${c}55, 0 0 10px ${c}22` : undefined,
        color: c,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </svg>
    </span>
  );
};
