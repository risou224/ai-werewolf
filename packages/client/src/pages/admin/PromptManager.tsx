import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminAPI } from '../../hooks/useAdminAPI.js';

/* ─────────────────────────────────────────────────────────────
   提示词管理（设计参考「工作台窗口2」提示词说明.html）
   三层提示词架构 → 阶段×角色模板浏览/编辑 → 组装演练预览
   ───────────────────────────────────────────────────────────── */

interface PromptTemplateItem {
  id: string;
  stage: string;
  role_type: string;
  content: string;
  version: number;
  created_at: string;
}

type TabKey = 'overview' | 'editor' | 'live';

const STAGE_META: Record<string, { title: string; cat: string }> = {
  identity_confirm: { title: '身份确认', cat: '开局' },
  wolf_kill:        { title: '夜晚 · 狼人行动', cat: '夜晚' },
  seer_check:       { title: '夜晚 · 预言家行动', cat: '夜晚' },
  witch_action:     { title: '夜晚 · 女巫行动', cat: '夜晚' },
  sheriff_stand:    { title: '警长竞选 · 是否参选', cat: '警长' },
  sheriff_speech:   { title: '警长竞选发言', cat: '警长' },
  sheriff_vote:     { title: '警长投票', cat: '警长' },
  day_speech:       { title: '白天发言', cat: '白天' },
  day_vote:         { title: '白天放逐投票', cat: '白天' },
  last_words:       { title: '遗言', cat: '白天' },
  hunter_shot:      { title: '猎人开枪', cat: '死亡' },
  sheriff_transfer: { title: '警长移交', cat: '警长' },
};

const ROLE_META: Record<string, string> = {
  wolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', idiot: '白痴', villager: '平民',
};

const CAT_COLOR: Record<string, string> = {
  '开局': '#4f8ef7', '夜晚': '#a371f7', '警长': '#d29922', '白天': '#3fb950', '死亡': '#f85149',
};

// Layer1 兜底人设（游戏配置里每个座位可单独覆盖）
const L1_DEFAULT = '你是一名狼人杀玩家，请根据游戏规则进行推理和发言。';

// 组装演练的占位符示例值（可编辑）
const SAMPLE: Record<string, string> = {
  seatNumber: '3', roleName: '预言家', campInfo: '好人阵营',
  aliveList: '1号、2号、3号、4号、5号、6号',
  previousSpeeches: '1号发言：我觉得 2 号像狼。\n2号发言：我是好人，昨晚查验 3 号为好人。',
  speechOrder: '3', speechSummaries: '1号: 排 2 号。\n2号: 我预言家。',
  recentEvents: '1号被狼人袭击；预言家查验了 2 号',
  wolfBuddies: '4号', deathReason: '狼人刀杀或放逐', deathInfo: '你已死亡，请留下遗言。',
  nightInfo: '今晚 1 号被袭击了。',
  healStatus: '可用', healAvailable: '可以救', poisonStatus: '可用', poisonAvailable: '可以毒人',
  extraInfo: '你是好人阵营成员。', candidateSpeeches: '3号竞选宣言：请选我，我能带队。',
  decision: '参选', action: '枪杀 4号', target: '4', targetSeat: '4', voteContent: '投票给 4号',
};

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const findPlaceholders = (t: string) => Array.from(new Set((t.match(/\{[a-zA-Z_]+\}/g) || []).map(x => x.slice(1, -1))));
const highlight = (t: string) =>
  escHtml(t).replace(/\{([a-zA-Z_]+)\}/g, '<span class="text-amber-300 bg-amber-400/10 rounded px-0.5 font-semibold">{$1}</span>');
const fill = (tpl: string, vars: Record<string, string>) => {
  let out = tpl;
  Object.entries(vars).forEach(([k, v]) => { out = out.split(`{${k}}`).join(v || ''); });
  return out;
};

export const PromptManager: React.FC = () => {
  const { fetchPrompts, fetchPromptDefaults, updatePrompt, resetPrompts } = useAdminAPI();

  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stages, setStages] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [templates, setTemplates] = useState<PromptTemplateItem[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});

  // 编辑区
  const [stage, setStage] = useState('day_speech');
  const [role, setRole] = useState('wolf');
  const [edited, setEdited] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组装演练
  const [liveStage, setLiveStage] = useState('day_speech');
  const [liveVars, setLiveVars] = useState<Record<string, string>>({});

  const showFlash = useCallback((kind: 'ok' | 'err', text: string) => {
    setFlash({ kind, text });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([fetchPrompts(), fetchPromptDefaults()]);
      setStages(p.stages);
      setRoles(p.roles);
      setTemplates(p.templates);
      setDefaults(d);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [fetchPrompts, fetchPromptDefaults]);

  useEffect(() => { load(); }, [load]);

  // 选中模板（按 stage × role 的最新版本）
  const template = useMemo(
    () => templates.find(t => t.stage === stage && t.role_type === role) || null,
    [templates, stage, role]
  );

  const isModified = useMemo(
    () => !!template && defaults[stage] !== undefined && defaults[stage] !== template.content,
    [template, defaults, stage]
  );

  const modifiedCount = useMemo(() => {
    let n = 0;
    for (const t of templates) {
      if (defaults[t.stage] !== undefined && defaults[t.stage] !== t.content) n++;
    }
    return n;
  }, [templates, defaults]);

  // 切换 stage/role 时同步编辑框内容
  useEffect(() => {
    if (template) setEdited(template.content);
    else setEdited('');
  }, [template]);

  const placeholders = useMemo(() => findPlaceholders(edited), [edited]);

  const handleSave = async () => {
    if (!template) return;
    if (edited.trim().length === 0) { showFlash('err', '提示词内容不能为空'); return; }
    setSaving(true);
    try {
      const res = await updatePrompt(template.id, edited);
      if (res && res.ok === false) { showFlash('err', res.error || '保存失败'); return; }
      showFlash('ok', `已保存「${STAGE_META[template.stage]?.title || template.stage} × ${ROLE_META[template.role_type] || template.role_type}」，对局中立即生效`);
      await load();
    } catch (e: any) {
      showFlash('err', e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOne = async () => {
    if (!template) return;
    const def = defaults[template.stage];
    if (def === undefined) { showFlash('err', '没有该阶段的默认模板'); return; }
    if (!confirm(`确定把「${STAGE_META[template.stage]?.title || template.stage}」恢复为默认内容？当前修改将被覆盖。`)) return;
    setSaving(true);
    try {
      const res = await updatePrompt(template.id, def);
      if (res && res.ok === false) { showFlash('err', res.error || '恢复失败'); return; }
      showFlash('ok', '已恢复默认');
      await load();
    } catch (e: any) {
      showFlash('err', e.message || '恢复失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!confirm('确定把全部提示词模板恢复为出厂默认？所有自定义修改将被覆盖。')) return;
    setSaving(true);
    try {
      const res = await resetPrompts();
      if (res && res.ok === false) { showFlash('err', res.error || '恢复失败'); return; }
      showFlash('ok', '已恢复全部默认模板');
      await load();
    } catch (e: any) {
      showFlash('err', e.message || '恢复失败');
    } finally {
      setSaving(false);
    }
  };

  // ── 组装演练：切换阶段时生成占位符输入框 ──
  const liveTemplate = useMemo(
    () => templates.find(t => t.stage === liveStage && t.role_type === roles[0]) || templates.find(t => t.stage === liveStage) || null,
    [templates, liveStage, roles]
  );

  const initLiveVars = useCallback((s: string) => {
    const t = templates.find(x => x.stage === s) || null;
    const pls = t ? findPlaceholders(t.content) : [];
    const vars: Record<string, string> = {};
    pls.forEach(p => { vars[p] = SAMPLE[p] ?? ''; });
    setLiveVars(vars);
  }, [templates]);

  useEffect(() => {
    if (templates.length > 0) initLiveVars(liveStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, liveStage]);

  const liveSystem = useMemo(() => {
    const t = templates.find(x => x.stage === liveStage) || null;
    if (!t) return '';
    return fill(L1_DEFAULT + "\n\n" + t.content, liveVars);
  }, [templates, liveStage, liveVars]);

  const liveUser = useMemo(() => {
    const t = templates.find(x => x.stage === liveStage) || null;
    if (!t) return '';
    const vars = { ...liveVars };
    const parts = [
      '当前存活玩家：' + (vars.aliveList || '1号、2号、3号、4号、5号、6号'),
      '当前轮次：第 2 天',
    ];
    if (vars.wolfBuddies !== undefined && liveStage === 'wolf_kill') {
      parts.push('你的狼人同伴：' + (vars.wolfBuddies || '无（你已无同伴）'));
    }
    if (vars.recentEvents) parts.push('', '最近事件：', ...vars.recentEvents.split('；').map(x => '- ' + x));
    return parts.join('\n');
  }, [templates, liveStage, liveVars]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: '概览' },
    { key: 'editor', label: '模板编辑' },
    { key: 'live', label: '组装演练' },
  ];

  const selectCls = 'bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gold-400/50';

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── 头部 ── */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-lg font-bold gold-text">提示词管理</h2>
        <div className="flex items-center gap-2">
          {modifiedCount > 0 && (
            <span className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1">
              {modifiedCount} 个模板已自定义
            </span>
          )}
          <button
            onClick={handleResetAll}
            disabled={saving || loading}
            className="px-4 py-2 bg-wolfred-500/15 text-wolfred-400 border border-wolfred-500/40 rounded-lg hover:bg-wolfred-500/25 transition-colors text-sm font-medium disabled:opacity-50"
          >
            ↺ 恢复全部默认
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        🧠 每次 AI 发言 = <b className="text-gray-300">人设(Layer1)</b> + <b className="text-gray-300">阶段×角色模板(Layer2，本页可改)</b> + <b className="text-gray-300">本局上下文(Layer3)</b>。修改保存后对局中立即生效，重启不丢失。
      </p>

      {/* ── 标签页 ── */}
      <div className="flex gap-1 border-b border-white/10 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all border-b-2 ${
              tab === t.key
                ? 'text-gold-300 border-gold-400 bg-gold-500/[0.06]'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {flash && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
          flash.kind === 'ok'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {flash.text}
        </div>
      )}

      {loading && <div className="text-gray-500 text-sm py-16 text-center">加载中…</div>}
      {!loading && loadError && (
        <div className="text-red-300 text-sm py-16 text-center">
          加载失败：{loadError}
          <br />
          <button onClick={load} className="mt-2 text-blue-400 hover:text-blue-300">重试</button>
        </div>
      )}
      {!loading && !loadError && (
        <>
          {/* ══════════ 概览 ══════════ */}
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* 统计 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '阶段模板', value: stages.length, sub: 'defaults/*.md' },
                  { label: '角色类型', value: roles.length, sub: roles.map(r => ROLE_META[r] || r).join(' / ') },
                  { label: '模板总数', value: templates.length, sub: 'stage × role 入库' },
                  { label: '已自定义', value: modifiedCount, sub: '与默认不同的模板' },
                ].map(s => (
                  <div key={s.label} className="glass-card rounded-card p-4">
                    <div className="text-[11px] text-gray-500">{s.label}</div>
                    <div className="text-2xl font-bold gold-text my-1">{s.value}</div>
                    <div className="text-[11px] text-gray-600 truncate">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* 三层架构 */}
              <div className="glass-card rounded-card p-5">
                <h3 className="text-sm font-bold text-gray-300 mb-3">核心结论 · 三层提示词架构</h3>
                <div className="flex items-stretch gap-2 flex-wrap">
                  <div className="flex-1 min-w-[180px] bg-white/[0.03] border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-gray-500 mb-1">Layer 1 · 系统提示词</div>
                    <div className="font-bold text-gray-200 mb-1">人设底座</div>
                    <div className="text-xs text-gray-500 leading-relaxed">每座位可配，默认「你是一名狼人杀玩家…」</div>
                  </div>
                  <div className="self-center text-gray-600 text-lg">→</div>
                  <div className="flex-1 min-w-[180px] bg-gold-500/[0.05] border border-gold-400/25 rounded-lg p-3">
                    <div className="text-[11px] text-amber-300/80 mb-1">Layer 2 · 阶段×角色模板</div>
                    <div className="font-bold text-gold-300 mb-1">任务 + 规则 + 输出格式</div>
                    <div className="text-xs text-gray-500 leading-relaxed">DB 里按 (stage, role) 存的模板，<b className="text-amber-300">本页可编辑</b></div>
                  </div>
                  <div className="self-center text-gray-600 text-lg">→</div>
                  <div className="flex-1 min-w-[180px] bg-white/[0.03] border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-gray-500 mb-1">Layer 3 · 情境上下文</div>
                    <div className="font-bold text-gray-200 mb-1">本局动态信息</div>
                    <div className="text-xs text-gray-500 leading-relaxed">存活玩家 / 轮次 / 事件 — 放进 user</div>
                  </div>
                </div>
                <div className="mt-3 bg-black/30 border border-white/10 rounded-lg p-3 font-mono text-[12px] text-gray-400 leading-relaxed overflow-x-auto">
                  <span className="text-gray-600">// 拼装逻辑 prompt-engine.ts · buildMessages</span>
                  <br />[ &#123; role:'system', content: layer1 + "\n\n" + layer2 &#125;,
                  <br />&nbsp;&nbsp;&#123; role:'user', content: layer3 &#125; ]
                </div>
              </div>

              {/* 链路 */}
              <div className="glass-card rounded-card p-5">
                <h3 className="text-sm font-bold text-gray-300 mb-3">一次 AI 发言的完整链路</h3>
                <div className="space-y-2">
                  {[
                    ['① 取模板', 'getLayer2(stage, role) → DB prompt_templates（最新版本）'],
                    ['② 填变量', 'fillTemplate({seatNumber, aliveList, recentEvents, ...}) 替换 {占位符}'],
                    ['③ 组上下文', 'ContextAssembler.assemble() → layer3'],
                    ['④ 拼消息', 'buildMessages(systemPrompt, 模板, layer3)'],
                    ['⑤ 发给 LLM', 'info.client.chat(messages) → 拿 JSON'],
                  ].map(([t, d]) => (
                    <div key={t} className="flex items-center gap-3 text-sm bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5">
                      <span className="text-gold-300 font-semibold shrink-0">{t}</span>
                      <span className="text-gray-500 text-xs font-mono truncate">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ 模板编辑 ══════════ */}
          {tab === 'editor' && (
            <div className="space-y-4">
              {/* 选择器 */}
              <div className="glass-card rounded-card p-4 flex flex-wrap items-end gap-4">
                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">阶段</div>
                  <select value={stage} onChange={e => setStage(e.target.value)} className={selectCls}>
                    {stages.map(s => (
                      <option key={s} value={s}>
                        {STAGE_META[s] ? `[${STAGE_META[s].cat}] ${STAGE_META[s].title}` : s}（{s}）
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">角色</div>
                  <select value={role} onChange={e => setRole(e.target.value)} className={selectCls}>
                    {roles.map(r => (
                      <option key={r} value={r}>{ROLE_META[r] || r}（{r}）</option>
                    ))}
                  </select>
                </div>
                {template && (
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    <span className="text-gray-500">版本 v{template.version}</span>
                    {isModified
                      ? <span className="text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-0.5">已修改</span>
                      : <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5">默认</span>}
                    <span className="text-gray-500">{placeholders.length} 个占位符</span>
                  </div>
                )}
              </div>

              {!template ? (
                <div className="glass-card rounded-card p-10 text-center text-gray-600 text-sm">该组合暂无模板</div>
              ) : (
                <>
                  {/* 编辑 + 高亮预览 */}
                  <div className="glass-card rounded-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-gray-300">
                        模板内容
                        <span className="ml-2 font-normal text-xs text-gray-500">
                          占位符 <span className="text-amber-300 font-mono">&#123;xxx&#125;</span> 会被引擎替换；JSON 示例里的结构示意不会被填
                        </span>
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetOne}
                          disabled={saving}
                          className="px-3 py-1.5 text-xs bg-white/[0.06] hover:bg-white/10 border border-white/15 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
                        >
                          恢复该模板默认
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-1.5 text-xs font-semibold bg-gold-500/20 hover:bg-gold-500/35 border border-gold-400/40 text-gold-300 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? '保存中…' : '💾 保存修改'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={edited}
                      onChange={e => setEdited(e.target.value)}
                      spellCheck={false}
                      className="w-full h-72 bg-black/30 border border-white/10 rounded-lg p-3 font-mono text-[12.5px] leading-relaxed text-gray-200 focus:outline-none focus:border-gold-400/50 resize-y"
                    />
                    <div className="mt-3">
                      <div className="text-[11px] text-gray-500 mb-1.5">高亮预览（占位符金色标记）</div>
                      <pre
                        className="whitespace-pre-wrap break-words m-0 bg-black/30 border border-white/10 rounded-lg p-3 font-mono text-[12.5px] leading-relaxed text-gray-300 max-h-60 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: highlight(edited) }}
                      />
                    </div>
                  </div>

                  {/* 占位符清单 */}
                  <div className="glass-card rounded-card p-4">
                    <h3 className="text-sm font-bold text-gray-300 mb-2">占位符清单</h3>
                    <div className="flex flex-wrap gap-2">
                      {placeholders.map(p => (
                        <span key={p} className="inline-flex items-center gap-1.5 text-xs bg-white/[0.04] border border-white/10 rounded-full px-3 py-1">
                          <span className="text-amber-300 font-mono">&#123;{p}&#125;</span>
                          <span className="text-gray-500">{SAMPLE[p] !== undefined ? '示例可填' : '引擎/处理器填充'}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════ 组装演练 ══════════ */}
          {tab === 'live' && (
            <div className="space-y-4">
              <div className="glass-card rounded-card p-4 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400">选择一个阶段：</span>
                <select value={liveStage} onChange={e => setLiveStage(e.target.value)} className={selectCls}>
                  {stages.map(s => (
                    <option key={s} value={s}>
                      {STAGE_META[s] ? `[${STAGE_META[s].cat}] ${STAGE_META[s].title}` : s}（{s}）
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => initLiveVars(liveStage)}
                  className="px-3 py-2 text-xs bg-white/[0.06] hover:bg-white/10 border border-white/15 rounded-lg text-gray-300 transition-colors"
                >
                  重置示例
                </button>
              </div>

              <div className="glass-card rounded-card p-4">
                <h3 className="text-sm font-bold text-gray-300 mb-2">1 · 模板里的占位符（可编辑示例值）</h3>
                {liveTemplate ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {findPlaceholders(liveTemplate.content).map(p => (
                      <div key={p} className="bg-black/30 border border-white/10 rounded-lg p-2.5">
                        <label className="text-[11px] text-amber-300 font-mono">&#123;{p}&#125;</label>
                        <input
                          value={liveVars[p] ?? ''}
                          onChange={e => setLiveVars(v => ({ ...v, [p]: e.target.value }))}
                          className="w-full mt-1 bg-transparent border border-white/10 rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gold-400/50"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-600 text-sm py-4">该阶段无模板</div>
                )}
              </div>

              <div className="glass-card rounded-card p-4">
                <h3 className="text-sm font-bold text-gray-300 mb-2">2 · 拼装结果（模拟，含 Layer1 兜底人设）</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-gray-500 mb-2">system = Layer1 + Layer2（填后）</div>
                    <pre className="whitespace-pre-wrap break-words m-0 font-mono text-[12px] leading-relaxed text-gray-300 max-h-72 overflow-y-auto">{liveSystem || '（无）'}</pre>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] text-gray-500 mb-2">user = Layer3 上下文</div>
                    <pre className="whitespace-pre-wrap break-words m-0 font-mono text-[12px] leading-relaxed text-gray-300 max-h-72 overflow-y-auto">{liveUser || '（无）'}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
