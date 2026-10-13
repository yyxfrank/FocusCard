import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { fetchAccountOverview, registeredDays } from '../../lib/accountOverview.js';
import AISettings from './AISettings.jsx';

const actions = [
  ['browse', '查看闪卡信息', '☷'],
  ['add', '添加闪卡', '+'],
  ['review', '开始复习', '→'],
];
const formatNumber = (value) => value == null ? '—' : Number(value).toLocaleString('zh-CN');
const formatDate = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString('zh-CN') : '—';

export default function UserProfile({ user, onBack, onDeckAction, onOverviewLoaded, aiSettings, onSaveAISettings }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  const menuTrigger = useRef(null);
  const request = useRef({ version: 0 });

  const load = useCallback(async () => {
    const requests = request.current;
    const current = ++requests.version;
    setLoading(true);
    setError('');
    try {
      const next = await fetchAccountOverview(supabase);
      if (current !== requests.version) return;
      setOverview(next);
      onOverviewLoaded(next);
    } catch (failure) {
      if (current === requests.version) setError(failure.message);
    } finally {
      if (current === requests.version) setLoading(false);
    }
  }, [onOverviewLoaded]);

  useEffect(() => {
    const requests = request.current;
    void load();
    const channel = supabase.channel(`account-overview-${user.id}`);
    for (const table of ['decks', 'cards', 'check_ins']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void load(); });
    }
    channel.subscribe();
    // Refresh on returning to the tab, and across midnight / new due times.
    const visible = () => { if (!document.hidden) void load(); };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 60000);
    return () => {
      ++requests.version;
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(timer);
    };
  }, [load, user.id]);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector('button')?.focus();
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenu(null);
    };
    const close = () => setMenu(null);
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const openMenu = (event, deck, keyboard = false) => {
    event.preventDefault();
    menuTrigger.current = event.currentTarget.querySelector?.('.profile-deck-actions') || event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = keyboard ? rect.left : event.clientX;
    const y = keyboard ? rect.bottom : event.clientY;
    setMenu({ deck, x: Math.max(8, Math.min(x, window.innerWidth - 248)),
      y: Math.max(8, Math.min(y, window.innerHeight - 208)) });
  };

  const menuKeys = (event) => {
    const buttons = Array.from(menuRef.current.querySelectorAll('button'));
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault(); setMenu(null); menuTrigger.current?.focus();
    } else if (event.key === 'Tab') {
      setMenu(null);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  };

  const username = overview?.username || user.user_metadata?.username || '未设置用户名';
  const days = registeredDays(user.created_at);
  const stats = [
    ['卡包数量', overview?.decks.length, '个卡包'],
    ['闪卡总数', overview?.cardCount, '张闪卡'],
    ['注册天数', days, '天 · 注册当日计为第 1 天'],
    ['连续打卡', overview?.streak, '天 · 完成复习后打卡'],
  ];

  return <div className="user-profile-page" aria-label="用户信息">
    <div className="profile-container">
      <header className="profile-nav">
        <button className="profile-back" onClick={onBack}>← 返回闪卡界面</button>
        <span className="profile-wordmark">FOCUSCARDS / ACCOUNT</span>
        <button className="profile-refresh" onClick={() => { void load(); }} disabled={loading}>
          {loading ? '更新中…' : '刷新信息'}
        </button>
      </header>

      <section className="profile-identity" aria-labelledby="profile-title">
        <div className="profile-avatar" aria-hidden="true">{Array.from(username)[0].toUpperCase()}</div>
        <div className="profile-heading">
          <p className="profile-eyebrow">你的学习空间</p>
          <h1 id="profile-title">{username}</h1>
          <p>每一次复习，都是知识的积累。</p>
        </div>
        <span className={`profile-checkin ${overview?.checkedInToday ? 'is-complete' : ''}`}>
          <span className="status-dot" />{!overview ? loading ? '打卡状态加载中' : '打卡状态暂不可用' : overview.checkedInToday ? '今天已打卡' : '今天尚未打卡'}
        </span>
      </section>

      <dl className="profile-account-details">
        <div><dt>用户名</dt><dd>{username}</dd></div>
        <div><dt>绑定邮箱</dt><dd>{user.email || '未绑定邮箱'}
          {user.email && <span className="profile-email-status">{user.email_confirmed_at ? '已确认' : '未确认'}</span>}
        </dd></div>
        <div><dt>注册日期</dt><dd>{formatDate(user.created_at)}</dd></div>
      </dl>

      {error && <div className="profile-error" role="alert"><span>{error}{overview && ' 当前显示上次成功加载的数据。'}</span>
        <button onClick={() => { void load(); }} disabled={loading}>重试</button></div>}
      {loading && <p className="profile-loading" role="status">正在更新学习统计…</p>}

      <section className="profile-stat-grid" aria-label="学习统计" aria-busy={loading}>
        {stats.map(([label, value, caption]) => <div key={label} className="profile-stat">
          <h2>{label}</h2><strong>{formatNumber(value)}</strong><p>{caption}</p>
        </div>)}
      </section>

      <section className="profile-review-summary" aria-labelledby="profile-review-title">
        <div><p className="profile-eyebrow">下一次复习</p><h2 id="profile-review-title">明天待复习</h2>
          <p>截至明天结束到期的卡片，包含尚未完成的逾期卡片。<br />按本地日期和当前计划统计，不受每日复习上限限制；今天复习后数量会变化。</p>
        </div>
        <div className="profile-due-number"><strong>{formatNumber(overview?.tomorrowDueCount)}</strong><span>张闪卡</span></div>
        <div className="profile-due-today">当前到期 <strong>{formatNumber(overview?.dueCount)}</strong> 张</div>
      </section>

      <AISettings settings={aiSettings} onSave={onSaveAISettings} />

      <section className="profile-library" aria-labelledby="profile-library-title" aria-busy={loading}>
        <div className="profile-library-heading"><div><h2 id="profile-library-title">我的卡包 <span>{formatNumber(overview?.decks.length)}</span></h2>
          <p>点击名称查看闪卡；右键卡包或点击 ⋯，选择下一步。</p></div></div>
        {!overview ? <div className="profile-empty">{loading ? '正在加载卡包…' : '暂时无法加载卡包，请重试。'}</div>
          : !overview.decks.length ? <div className="profile-empty"><h3>你的第一个卡包，从这里开始</h3>
            <p>返回闪卡界面创建卡包，再添加想记住的知识。</p><button className="profile-back" onClick={onBack}>去创建卡包 →</button></div>
          : <div className="profile-deck-list">{overview.decks.map((deck, index) => <article className="profile-deck" key={deck.id}
            onContextMenu={(event) => openMenu(event, deck)}>
            <span className="profile-deck-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <button className="profile-deck-name" onClick={() => onDeckAction(deck, 'browse')}
              onKeyDown={(event) => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openMenu(event, deck, true); }}>
              <strong>{deck.name}</strong><span>创建于 {formatDate(deck.created_at)}</span>
            </button>
            <div className="profile-deck-count"><strong>{formatNumber(deck.card_count)}</strong><span>张闪卡</span></div>
            <div className="profile-deck-count"><strong>{formatNumber(deck.tomorrow_due_count)}</strong><span>明天待复习</span></div>
            <button className="profile-deck-actions" aria-label={`${deck.name}的卡包操作`} aria-haspopup="menu"
              aria-expanded={menu?.deck.id === deck.id} aria-controls={menu?.deck.id === deck.id ? 'profile-deck-menu' : undefined}
              onClick={(event) => openMenu(event, deck, true)}>⋯</button>
          </article>)}</div>}
      </section>
    </div>

    {menu && <div id="profile-deck-menu" ref={menuRef} className="profile-context-menu" role="menu"
      aria-label={`${menu.deck.name}的卡包操作`} style={{ left: menu.x, top: menu.y }} onKeyDown={menuKeys}>
      <p className="profile-menu-heading">{menu.deck.name}</p>
      {actions.map(([action, label, icon]) => <button key={action} role="menuitem" onClick={() => {
        const deck = menu.deck;
        setMenu(null);
        menuTrigger.current?.focus();
        onDeckAction(deck, action);
      }}><span aria-hidden="true">{icon}</span>{label}</button>)}
    </div>}
  </div>;
}
