import { useState, useEffect, useMemo, useRef } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { GameSpeed, ActiveTab, RegulatoryStatus } from '@/types/market';
import { WebSocketClient } from '@/services/websocket';
import { Pause, Play, FastForward, Save, Settings, SkipForward, Search, Shield, BookOpen, Menu, Bell } from 'lucide-react';
import { getCareerTitle } from '@/data/careerTitles';
import { audio } from '@/services/audio';
import { useI18n } from '@/i18n/I18nContext';

const TAB_GROUPS: { tabs: { id: ActiveTab; shortcut: string }[] }[] = [
  { tabs: [
    { id: 'dashboard', shortcut: 'D' },
    { id: 'portfolio', shortcut: 'P' },
    { id: 'market', shortcut: 'M' },
  ]},
  { tabs: [
    { id: 'orders', shortcut: 'O' },
    { id: 'options', shortcut: 'X' },
  ]},
  { tabs: [
    { id: 'news', shortcut: 'N' },
    { id: 'analytics', shortcut: 'A' },
    { id: 'journal', shortcut: 'J' },
  ]},
];

const SPEED_TITLES = ['topbar.pause', 'topbar.realTime', 'topbar.fast', 'topbar.veryFast', 'topbar.maximum'] as const;

const SPEEDS = [
  { speed: GameSpeed.Paused, icon: Pause, label: '▐▐' },
  { speed: GameSpeed.Normal, icon: Play, label: '▶' },
  { speed: GameSpeed.Fast, icon: FastForward, label: '▶▶' },
  { speed: GameSpeed.VeryFast, icon: FastForward, label: '▶▶▶' },
  { speed: GameSpeed.Maximum, icon: FastForward, label: 'MAX' },
];

interface TopBarProps {
  wsClient: WebSocketClient;
  onOpenSettings?: () => void;
  onOpenCommandBar?: () => void;
  onOpenWiki?: () => void;
  onMainMenu?: () => void;
  onSave?: () => void;
}

function CareerBadge({ equity, trades }: { equity: number; trades: number }) {
  const { t } = useI18n();
  const approxDays = Math.max(trades, 1);
  const career = useMemo(() => getCareerTitle(equity, trades, approxDays), [equity, trades, approxDays]);
  const careerKey = career.id === 'fund_manager' ? 'fundManager' : career.id;
  const translatedTitle = t(`career.${careerKey}`);
  const displayTitle = translatedTitle !== `career.${careerKey}` ? translatedTitle : career.title;
  const [prevId, setPrevId] = useState(career.id);
  const [promoted, setPromoted] = useState(false);

  useEffect(() => {
    if (career.id !== prevId) {
      setPrevId(career.id);
      setPromoted(true);
      const timer = setTimeout(() => setPromoted(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [career.id, prevId]);

  return (
    <span
      className={promoted ? 'career-promoted' : ''}
      style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
        background: `${career.color}22`, color: career.color,
        border: `1px solid ${career.color}44`, letterSpacing: '0.04em',
        whiteSpace: 'nowrap' as const,
        transition: 'all 0.5s ease',
      }}
    >
      {career.icon} {displayTitle}
    </span>
  );
}

export function TopBar({ wsClient, onOpenSettings, onOpenCommandBar, onOpenWiki, onMainMenu, onSave }: TopBarProps) {
  const { t, formatGameTime, formatMoney, formatTime } = useI18n();
  const activeTab = useMarketStore((s) => s.activeTab);
  const setActiveTab = useMarketStore((s) => s.setActiveTab);
  const speed = useMarketStore((s) => s.speed);
  const gameTime = useMarketStore((s) => s.gameTime);
  const isMarketOpen = useMarketStore((s) => s.isMarketOpen);
  const portfolio = useMarketStore((s) => s.portfolio);
  const smaStatus = useMarketStore((s) => s.smaStatus);
  const smaData = useMarketStore((s) => s.smaData);
  const stockList = useMarketStore((s) => s.stockList);
  const economicData = useMarketStore((s) => s.economicData);

  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [autosaveFlash, setAutosaveFlash] = useState(false);
  const [showSMAPanel, setShowSMAPanel] = useState(false);
  const [showGameMenu, setShowGameMenu] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const newsItems = useMarketStore((s) => s.newsItems);
  const [milestoneHit, setMilestoneHit] = useState(false);
  const prevEquityRef = useRef(0);

  // Portfolio milestone detection ($100K, $250K, $500K, $1M, $5M)
  const MILESTONES = [100_000, 250_000, 500_000, 1_000_000, 5_000_000];
  useEffect(() => {
    if (portfolio) {
      const prev = prevEquityRef.current;
      const curr = portfolio.totalEquity;
      if (prev > 0 && MILESTONES.some(m => prev < m && curr >= m)) {
        setMilestoneHit(true);
        audio.milestone();
        const timer = setTimeout(() => setMilestoneHit(false), 1500);
        return () => clearTimeout(timer);
      }
      prevEquityRef.current = curr;
    }
  }, [portfolio?.totalEquity]);

  // ESC toggles game menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGameMenu(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSpeedChange = (newSpeed: GameSpeed) => {
    wsClient.send('SetSpeed', { speed: newSpeed });
  };

  const handleSave = () => {
    if (onSave) {
      onSave(); // Open save dialog
    } else {
      wsClient.send('SaveGame', {}); // Fallback: quicksave
      setSaveFlash(true);
    }
  };

  useEffect(() => {
    if (saveFlash) {
      const timer = setTimeout(() => setSaveFlash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [saveFlash]);

  useEffect(() => {
    if (autosaveFlash) {
      const timer = setTimeout(() => setAutosaveFlash(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [autosaveFlash]);

  useEffect(() => {
    const unsub = wsClient.on('Autosaved', () => {
      setAutosaveFlash(true);
    });
    return unsub;
  }, [wsClient]);

  useEffect(() => {
    const unsub = wsClient.on('GameSaved', (payload) => {
      const data = payload as { success: boolean; error?: string };
      if (!data.success) {
        setSaveFlash(false);
        setSaveError(true);
      }
    });
    return unsub;
  }, [wsClient]);

  useEffect(() => {
    if (saveError) {
      const timer = setTimeout(() => setSaveError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveError]);

  return (
    <header style={styles.topBar}>
      {/* Logo + Navigation */}
      <div style={styles.left}>
        <span style={styles.logo}>STOCKSIM</span>
        <div style={styles.divider} />
        <nav style={styles.tabs}>
          {TAB_GROUPS.map((group, gi) => (
            <div key={gi} style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
              {gi > 0 && <div style={{ width: '1px', height: '18px', background: 'var(--border)', margin: '0 4px' }} />}
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  style={{
                    ...styles.tab,
                    ...(activeTab === tab.id ? styles.tabActive : {}),
                  }}
                  onClick={() => setActiveTab(tab.id)}
                  title={`${t(`nav.${tab.id}`)} (${tab.shortcut})`}
                >
                  {t(`nav.${tab.id}`)}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Right: Time + Speed + Cash */}
      <div style={styles.right}>
        <div style={styles.timeSection}>
          <span style={styles.gameTime}>{formatGameTime(gameTime)}</span>
          {(() => {
            // Determine market phase from gameTime
            const d = new Date(gameTime);
            const h = d.getHours();
            const m = d.getMinutes();
            const totalMin = h * 60 + m;
            const day = d.getDay();
            const isWeekend = day === 0 || day === 6;

            let label = t('topbar.closed');
            let color = 'var(--red-primary)';
            let glow = 'none';
            let countdown = '';
            let phase: 'closed' | 'weekend' | 'live' | 'pre' | 'after' = 'closed';

            if (isWeekend) {
              label = t('topbar.weekend');
              phase = 'weekend';
            } else if (isMarketOpen) {
              label = t('topbar.live');
              phase = 'live';
              color = 'var(--green-primary)';
              glow = '0 0 8px var(--green-glow)';
              const closeMin = 16 * 60;
              const remaining = closeMin - totalMin;
              if (remaining > 0 && remaining <= 60) countdown = t('topbar.toClose', { mins: remaining });
            } else if (totalMin >= 7 * 60 && totalMin < 9 * 60 + 30) {
              label = t('topbar.preMarket');
              phase = 'pre';
              color = 'var(--warning)';
              const openMin = 9 * 60 + 30;
              const remaining = openMin - totalMin;
              countdown = t('topbar.toOpenHours', { hours: Math.floor(remaining / 60), mins: remaining % 60 });
            } else if (totalMin >= 16 * 60 && totalMin < 20 * 60) {
              label = t('topbar.afterHours');
              phase = 'after';
              color = 'var(--chart-purple)';
            }

            const badgeStyle: React.CSSProperties = {
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.5px',
              color,
              textShadow: glow,
              ...(isMarketOpen ? {
                background: 'color-mix(in srgb, var(--green-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--green-primary) 30%, transparent)',
              } : phase === 'pre' ? {
                background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                animation: 'pulse 2s ease-in-out infinite',
              } : phase === 'after' ? {
                background: 'color-mix(in srgb, var(--chart-purple) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--chart-purple) 30%, transparent)',
              } : {
                background: 'color-mix(in srgb, var(--red-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red-primary) 30%, transparent)',
              }),
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span style={badgeStyle}>
                  {isMarketOpen ? '●' : '○'} {label}
                </span>
                {countdown && (
                  <span className="mono" style={{ fontSize: '9px', color: 'var(--text-disabled)' }}>{countdown}</span>
                )}
              </div>
            );
          })()}
        </div>

        <div style={styles.speedGroup}>
          {SPEEDS.map((s, idx) => (
            <button
              key={s.speed}
              style={{
                ...styles.speedBtn,
                ...(speed === s.speed ? styles.speedBtnActive : {}),
              }}
              onClick={() => handleSpeedChange(s.speed)}
              title={t(SPEED_TITLES[idx])}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Market Index Ticker */}
        {(() => {
          const simx = stockList.find(s => s.symbol === 'SIMX');
          const vixVal = economicData?.fearGreedIndex;
          const oilVal = economicData?.indicators?.oilPrice;
          const goldVal = economicData?.indicators?.goldPrice;
          return (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              {simx && (
                <span style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-disabled)', fontWeight: 600, fontSize: '9px' }}>SIMX</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{simx.price.toFixed(2)}</span>
                  <span style={{ color: simx.changePercent >= 0 ? 'var(--green-primary)' : 'var(--red-primary)', fontWeight: 600, fontSize: '10px' }}>
                    {simx.changePercent >= 0 ? '+' : ''}{simx.changePercent.toFixed(2)}%
                  </span>
                </span>
              )}
              {vixVal !== undefined && (
                <span style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-disabled)', fontWeight: 600, fontSize: '9px' }}>F&G</span>
                  <span style={{ color: vixVal < 30 ? 'var(--red-primary)' : vixVal > 70 ? 'var(--green-primary)' : 'var(--text-primary)', fontWeight: 700 }}>{vixVal.toFixed(0)}</span>
                </span>
              )}
              {goldVal !== undefined && (
                <span style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-disabled)', fontWeight: 600, fontSize: '9px' }}>GOLD</span>
                  <span style={{ color: 'var(--warning)', fontWeight: 700 }}>${goldVal.toFixed(0)}</span>
                </span>
              )}
              {oilVal !== undefined && (
                <span style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-disabled)', fontWeight: 600, fontSize: '9px' }}>OIL</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>${oilVal.toFixed(2)}</span>
                </span>
              )}
            </div>
          );
        })()}

        {portfolio && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              className={milestoneHit ? 'portfolio-milestone' : ''}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderRadius: '6px', padding: '2px 6px' }}
            >
              <span className="mono" style={styles.cashDisplay}>
                {formatMoney(portfolio.totalEquity, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span className="mono" style={{
                fontSize: '10px', fontWeight: 600,
                color: 'var(--text-muted)',
              }}>
                {t('topbar.cash')}: {formatMoney(portfolio.cash, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}

        {/* Skip to Open (only when market is closed) */}
        {!isMarketOpen && (
          <button
            style={{ ...styles.iconBtn, color: 'var(--warning)' }}
            onClick={() => wsClient.send('SkipToOpen', {})}
            title={t('topbar.skipToOpen')}
          >
            <SkipForward size={16} />
            <span style={{ fontSize: '10px', marginLeft: '2px', fontWeight: 600 }}>{t('topbar.open')}</span>
          </button>
        )}

        {/* SMA Shield Icon (Spec 9.2) */}
        <div style={{ position: 'relative' }}>
          <button
            style={{
              ...styles.iconBtn,
              color: smaShieldColor(smaStatus),
              animation: smaStatus === 'UnderInvestigation' || smaStatus === 'EnforcementPending'
                ? 'smaPulse 2s ease-in-out infinite' : 'none',
            }}
            onClick={() => {
              wsClient.send('GetSMAStatus', {});
              setShowSMAPanel(!showSMAPanel);
            }}
            title={`${t('topbar.regulatoryStatus')}: ${smaStatusLabel(smaStatus, t)}`}
            aria-label={`${t('topbar.regulatoryStatus')}: ${smaStatusLabel(smaStatus, t)}`}
          >
            <Shield size={16} />
          </button>
          {showSMAPanel && (
            <SMAPanel
              smaData={smaData}
              smaStatus={smaStatus}
              onClose={() => setShowSMAPanel(false)}
            />
          )}
        </div>

        {saveError && (
          <span className="mono" style={{ fontSize: '11px', color: 'var(--red-primary)', fontWeight: 600 }}>{t('topbar.saveFailed')}</span>
        )}
        {!saveError && saveFlash && (
          <span className="mono" style={{ fontSize: '11px', color: 'var(--green-primary)', fontWeight: 600 }}>{t('topbar.saved')}</span>
        )}
        {!saveError && !saveFlash && autosaveFlash && (
          <span className="mono" style={{ fontSize: '11px', color: 'var(--green-primary)', fontWeight: 600, opacity: 0.8 }}>{t('topbar.autosaved')}</span>
        )}

        {/* Notification Center */}
        <div style={{ position: 'relative' }}>
          <button
            style={{ ...styles.iconBtn, color: showNotifPanel ? 'var(--text-accent)' : 'var(--text-secondary)' }}
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            title={t('topbar.notifications')}
          >
            <Bell size={16} />
            {newsItems.filter(n => n.severity === 'Major' || n.tier && n.tier >= 3).length > 0 && (
              <span style={{
                position: 'absolute', top: '-2px', right: '-2px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--red-primary)',
              }} />
            )}
          </button>
          {showNotifPanel && (
            <div style={{
              position: 'absolute', top: 'var(--topbar-height)', right: 0,
              width: '360px', maxHeight: '400px', overflowY: 'auto',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              zIndex: 1001,
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{t('topbar.notifications')}</span>
                <button onClick={() => setShowNotifPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', fontSize: '16px' }}>×</button>
              </div>
              {newsItems.filter(n => n.severity === 'Major' || (n.tier && n.tier >= 2)).slice(0, 15).map(n => (
                <div key={n.id} style={{
                  padding: '8px 14px', borderBottom: '1px solid color-mix(in srgb, var(--border) 30%, transparent)',
                  fontSize: '11px', cursor: 'pointer',
                }} onClick={() => { if (n.affectedSymbols[0]) { const selectStk = useMarketStore.getState().selectStock; selectStk(n.affectedSymbols[0]); } setShowNotifPanel(false); }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{
                      fontSize: '8px', fontWeight: 700, padding: '1px 4px', borderRadius: '2px',
                      background: n.tier && n.tier >= 4 ? 'color-mix(in srgb, var(--red-primary) 20%, transparent)' : n.tier && n.tier >= 3 ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : n.severity === 'Major' ? 'var(--red-dim)' : 'var(--bg-tertiary)',
                      color: n.tier && n.tier >= 4 ? 'var(--red-primary)' : n.tier && n.tier >= 3 ? 'var(--warning)' : n.severity === 'Major' ? 'var(--red-primary)' : 'var(--text-disabled)',
                    }}>{n.tier && n.tier >= 4 ? 'BLACK SWAN' : n.tier && n.tier >= 3 ? 'CRISIS' : n.severity}</span>
                    {n.affectedSymbols[0] && <span className="mono" style={{ fontWeight: 700, color: 'var(--text-accent)', fontSize: '10px' }}>{n.affectedSymbols[0]}</span>}
                    <span className="mono" style={{ color: 'var(--text-disabled)', fontSize: '9px', marginLeft: 'auto' }}>
                      {n.timestamp ? formatTime(n.timestamp) : ''}
                    </span>
                  </div>
                  <div style={{
                    color: n.sentiment > 0.1 ? 'var(--green-primary)' : n.sentiment < -0.1 ? 'var(--red-primary)' : 'var(--text-secondary)',
                    lineHeight: 1.3,
                  }}>{n.headline}</div>
                </div>
              ))}
              {newsItems.filter(n => n.severity === 'Major' || (n.tier && n.tier >= 2)).length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '12px' }}>
                  {t('topbar.noSignificantEvents')}
                </div>
              )}
            </div>
          )}
        </div>

        <button style={styles.iconBtn} title={t('topbar.searchTitle')} aria-label={t('topbar.openSearch')} onClick={onOpenCommandBar}>
          <Search size={16} />
        </button>

        <button
          style={{ ...styles.menuBtn, ...(showGameMenu ? { background: 'var(--bg-tertiary)', color: 'var(--text-accent)' } : {}) }}
          onClick={() => setShowGameMenu(!showGameMenu)}
          title={t('topbar.menu')}
          aria-label={t('topbar.openMenu')}
        >
          <Menu size={20} />
        </button>

        {showGameMenu && (
          <GameMenu
            onClose={() => setShowGameMenu(false)}
            onResume={() => setShowGameMenu(false)}
            onSettings={() => { setShowGameMenu(false); onOpenSettings?.(); }}
            onWiki={() => { setShowGameMenu(false); onOpenWiki?.(); }}
            onSave={() => { handleSave(); setShowGameMenu(false); }}
            onMainMenu={() => { setShowGameMenu(false); onMainMenu?.(); }}
            canRetire={!!portfolio && portfolio.totalEquity >= 1_000_000}
            onRetire={() => { setShowGameMenu(false); wsClient.send('Retire', {}); }}
            equity={portfolio?.totalEquity}
            trades={portfolio?.tradeCount}
          />
        )}
      </div>
    </header>
  );
}

function smaShieldColor(status: RegulatoryStatus): string {
  switch (status) {
    case 'Clear': return 'var(--text-disabled)';
    case 'UnderReview': return 'var(--text-secondary)';
    case 'UnderInvestigation': return 'var(--warning)';
    case 'EnforcementPending': return 'var(--red-primary)';
    default: return 'var(--text-disabled)';
  }
}

function smaStatusLabel(
  status: RegulatoryStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case 'Clear': return t('topbar.statusClear');
    case 'UnderReview': return t('topbar.statusUnderReview');
    case 'UnderInvestigation': return t('topbar.statusUnderInvestigation');
    case 'EnforcementPending': return t('topbar.statusEnforcementPending');
    default: return t('topbar.statusClear');
  }
}

function SMAPanel({ smaData, smaStatus, onClose }: {
  smaData: import('@/types/market').SMAStatusResponse | null;
  smaStatus: RegulatoryStatus;
  onClose: () => void;
}) {
  const { t, formatDate, formatMoney } = useI18n();
  return (
    <div style={smaPanelStyles.overlay} onClick={onClose}>
      <div style={smaPanelStyles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={smaPanelStyles.header}>
          <Shield size={18} style={{ color: smaShieldColor(smaStatus) }} />
          <span style={smaPanelStyles.title}>{t('topbar.smaTitle')}</span>
          <button style={smaPanelStyles.closeBtn} onClick={onClose} aria-label={t('topbar.closePanel')}>×</button>
        </div>

        <div style={smaPanelStyles.statusBar}>
          <span style={{ color: smaShieldColor(smaStatus), fontWeight: 600 }}>
            {smaStatusLabel(smaStatus, t)}
          </span>
          {smaData?.accountFrozen && (
            <span style={{ color: 'var(--red-primary)', fontWeight: 700 }}>{t('topbar.accountFrozen')}</span>
          )}
        </div>

        {smaData && (
          <>
            {/* Active Investigations */}
            {smaData.investigations.length > 0 && (
              <div style={smaPanelStyles.section}>
                <div style={smaPanelStyles.sectionTitle}>{t('topbar.activeInvestigations')}</div>
                {smaData.investigations.map((inv) => (
                  <div key={inv.id} style={smaPanelStyles.item}>
                    <span style={{ color: 'var(--warning)' }}>⚠</span>
                    <span>{inv.type.replace(/([A-Z])/g, ' $1').trim()} in {inv.symbol}</span>
                    <span className="mono" style={{ color: 'var(--text-disabled)', fontSize: '11px' }}>
                      {t('topbar.daysRemaining', { days: inv.daysRemaining })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Trading Restrictions */}
            {smaData.tradingRestrictions.length > 0 && (
              <div style={smaPanelStyles.section}>
                <div style={smaPanelStyles.sectionTitle}>{t('topbar.tradingRestrictions')}</div>
                {smaData.tradingRestrictions.map((r, i) => (
                  <div key={i} style={smaPanelStyles.item}>
                    <span style={{ color: 'var(--red-primary)' }}>🚫</span>
                    <span>{r.symbol}: {r.closeOnly ? t('topbar.closeOnly') : t('topbar.restricted')}</span>
                    <span className="mono" style={{ color: 'var(--text-disabled)', fontSize: '11px' }}>
                      {t('topbar.until', { date: formatDate(r.expiresAt) })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {smaData.tradingBanUntil && (
              <div style={{ ...smaPanelStyles.item, color: 'var(--red-primary)' }}>
                {t('topbar.tradingBanUntil', { date: formatDate(smaData.tradingBanUntil) })}
              </div>
            )}

            {smaData.marginBanUntil && (
              <div style={{ ...smaPanelStyles.item, color: 'var(--red-primary)' }}>
                {t('topbar.marginRevokedUntil', { date: formatDate(smaData.marginBanUntil) })}
              </div>
            )}

            {/* Past Penalties */}
            {smaData.penalties.length > 0 && (
              <div style={smaPanelStyles.section}>
                <div style={smaPanelStyles.sectionTitle}>{t('topbar.penalties')}</div>
                {smaData.penalties.map((p) => (
                  <div key={p.id} style={smaPanelStyles.item}>
                    <span style={{ color: 'var(--red-primary)' }}>💰</span>
                    <span>{p.description}</span>
                    <span className="mono" style={{ color: 'var(--red-primary)', fontSize: '12px', fontWeight: 600 }}>
                      -{formatMoney(p.fineAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Violation History */}
            {smaData.violations.length > 0 && (
              <div style={smaPanelStyles.section}>
                <div style={smaPanelStyles.sectionTitle}>{t('topbar.violationHistory')}</div>
                {smaData.violations.slice(-5).reverse().map((v) => (
                  <div key={v.id} style={{ ...smaPanelStyles.item, fontSize: '11px' }}>
                    <span>{v.description}</span>
                    <span className="mono" style={{ color: 'var(--text-disabled)' }}>
                      {formatDate(v.detectedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Clean state message */}
            {smaData.violations.length === 0 && smaData.investigations.length === 0 && smaData.penalties.length === 0 && (
              <div style={{ padding: '16px', color: 'var(--text-disabled)', textAlign: 'center' as const, fontSize: '13px' }}>
                {t('topbar.cleanState')}
              </div>
            )}
          </>
        )}

        {!smaData && (
          <div style={{ padding: '16px', color: 'var(--text-disabled)', textAlign: 'center' as const, fontSize: '13px' }}>
            {t('topbar.loadingRegData')}
          </div>
        )}
      </div>
    </div>
  );
}

function GameMenu({ onClose, onResume, onSettings, onWiki, onSave, onMainMenu, canRetire, onRetire, equity, trades }: {
  onClose: () => void;
  onResume: () => void;
  onSettings: () => void;
  onWiki: () => void;
  onSave: () => void;
  onMainMenu: () => void;
  canRetire: boolean;
  onRetire: () => void;
  equity?: number;
  trades?: number;
}) {
  const { t } = useI18n();
  const menuItems = [
    { label: t('topbar.resume'), icon: Play, action: onResume, shortcut: 'Esc' },
    { label: t('topbar.saveGame'), icon: Save, action: onSave, shortcut: 'Ctrl+S' },
    { label: t('topbar.settings'), icon: Settings, action: onSettings },
    { label: t('topbar.wiki'), icon: BookOpen, action: onWiki, shortcut: 'Ctrl+W' },
    ...(canRetire ? [{ label: t('topbar.retire'), icon: FastForward, action: onRetire, color: 'var(--gold-primary)' as string }] : []),
    { label: t('topbar.mainMenu'), icon: Menu, action: onMainMenu, color: 'var(--red-primary)' as string },
  ];

  return (
    <div style={gameMenuStyles.overlay} onClick={onClose}>
      <div style={gameMenuStyles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={gameMenuStyles.title}>STOCKSIM</h2>
        {equity !== undefined && trades !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <CareerBadge equity={equity} trades={trades} />
          </div>
        )}
        <div style={gameMenuStyles.divider} />
        <div style={gameMenuStyles.items}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              style={{
                ...gameMenuStyles.item,
                color: (item as { color?: string }).color || 'var(--text-primary)',
              }}
              onClick={item.action}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <item.icon size={18} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {(item as { shortcut?: string }).shortcut && (
                <span style={gameMenuStyles.shortcut}>{(item as { shortcut?: string }).shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const gameMenuStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '32px',
    width: '320px',
    boxShadow: '0 16px 64px rgba(0, 0, 0, 0.8)',
  },
  title: {
    fontFamily: 'var(--font-mono)',
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-accent)',
    letterSpacing: '4px',
    textAlign: 'center' as const,
    textShadow: '0 0 20px var(--accent-glow)',
    margin: 0,
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '16px 0',
  },
  items: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 500,
    fontFamily: 'var(--font-ui)',
    transition: 'background 150ms, border-color 150ms',
    width: '100%',
    textAlign: 'left' as const,
  },
  shortcut: {
    fontSize: '11px',
    color: 'var(--text-disabled)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 400,
  },
};

const smaPanelStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  panel: {
    position: 'absolute',
    top: 'var(--topbar-height)',
    right: '120px',
    width: '380px',
    maxHeight: '500px',
    overflowY: 'auto' as const,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    zIndex: 1001,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    flex: 1,
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  statusBar: {
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    fontSize: '13px',
  },
  section: {
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: {
    padding: '4px 16px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-disabled)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  item: {
    padding: '6px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-primary)',
  },
};

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    height: 'var(--topbar-height)',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 var(--space-4)',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
  },
  logo: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '16px',
    color: 'var(--text-accent)',
    letterSpacing: '2px',
    textShadow: '0 0 12px var(--accent-glow)',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'var(--border)',
  },
  tabs: {
    display: 'flex',
    gap: 'var(--space-1)',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid' as const,
    borderBottomColor: 'transparent',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 500,
    fontSize: '14px',
    padding: '12px 8px',
    cursor: 'pointer',
    transition: 'color 150ms, border-color 150ms',
    outline: 'none',
  },
  tabActive: {
    color: 'var(--text-accent)',
    borderBottomColor: 'var(--text-accent)',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
  },
  timeSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
  },
  gameTime: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  marketStatus: {
    fontSize: '10px',
    fontWeight: 600,
  },
  speedGroup: {
    display: 'flex',
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  speedBtn: {
    width: '36px',
    height: '32px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background 150ms, color 150ms',
  },
  speedBtnActive: {
    background: 'var(--bg-primary)',
    color: 'var(--text-accent)',
    textShadow: '0 0 8px var(--accent-glow)',
    boxShadow: 'inset 0 0 8px color-mix(in srgb, var(--text-accent) 10%, transparent)',
  },
  cashDisplay: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--green-primary)',
    textShadow: '0 0 10px color-mix(in srgb, var(--green-primary) 30%, transparent)',
    letterSpacing: '0.5px',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 'var(--space-1)',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 150ms',
  },
  menuBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 150ms',
  },
};
