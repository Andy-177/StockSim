import { useState } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useI18n } from '@/i18n/I18nContext';

// --- Keybindings ---

export interface KeyBindings {
  pauseResume: string;
  speed1: string; speed2: string; speed3: string; speed4: string;
  tabDashboard: string; tabPortfolio: string; tabMarket: string;
  tabOrders: string; tabNews: string; tabAnalytics: string;
  quickSave: string; help: string;
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
  pauseResume: 'Space',
  speed1: '1', speed2: '2', speed3: '3', speed4: '4',
  tabDashboard: 'D', tabPortfolio: 'P', tabMarket: 'M',
  tabOrders: 'O', tabNews: 'N', tabAnalytics: 'A',
  quickSave: 'Ctrl+S', help: '?',
};

// --- Settings ---

export interface GameSettings {
  // Gameplay
  autosave: boolean;
  autosaveInterval: number;
  showAutosaveNotification: boolean;
  showTooltips: boolean;
  confirmOrders: boolean;
  autoPauseOnNews: boolean;
  autoPauseOnAlert: boolean;
  autoPauseOnMarketOpen: boolean;
  autoPauseOnMarginCall: boolean;
  autoPauseOnShortSqueeze: boolean;
  autoPauseOnOrderExecution: boolean;
  skipWeekends: boolean;
  language: string;
  // Simulation (Spec 16.3)
  tradingCommission: boolean;
  commissionAmount: number;
  marginInterest: boolean;
  shortBorrowFees: boolean;
  enableTaxes: boolean;
  taxRateMode: 'realistic' | 'flat' | 'off';
  smaEnforcement: boolean;
  smaStrictness: 'lenient' | 'normal' | 'strict';
  // Display (Spec 16.5)
  defaultChartTimeframe: string;
  defaultChartType: 'candle' | 'line' | 'area';
  numberFormat: 'us' | 'eu';
  showSparklines: boolean;
  // Video
  windowMode: 'windowed' | 'fullscreen' | 'borderless';
  resolution: string;
  vsync: boolean;
  fpsLimit: number;
  showFps: boolean;
  uiScale: number;
  theme: 'default' | 'slate' | 'amber';
  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  marketBellSound: boolean;
  tradeSound: boolean;
  newsAlertSound: boolean;
  // Accessibility
  reducedAnimations: boolean;
  highContrast: boolean;
  colorblindMode: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  largeText: boolean;
  newsTickerSpeed: number;
  // Controls
  keyBindings: KeyBindings;
}

export const DEFAULT_SETTINGS: GameSettings = {
  autosave: true,
  autosaveInterval: 5,
  showAutosaveNotification: true,
  showTooltips: true,
  confirmOrders: true,
  autoPauseOnNews: false,
  autoPauseOnAlert: false,
  autoPauseOnMarketOpen: false,
  autoPauseOnMarginCall: true,
  autoPauseOnShortSqueeze: false,
  autoPauseOnOrderExecution: false,
  skipWeekends: false,
  language: 'en',
  tradingCommission: true,
  commissionAmount: 4.95,
  marginInterest: true,
  shortBorrowFees: true,
  enableTaxes: true,
  taxRateMode: 'realistic',
  smaEnforcement: true,
  smaStrictness: 'normal',
  defaultChartTimeframe: '1D',
  defaultChartType: 'candle',
  numberFormat: 'us',
  showSparklines: true,
  windowMode: 'windowed',
  resolution: 'native',
  vsync: true,
  fpsLimit: 60,
  showFps: false,
  uiScale: 100,
  theme: 'default',
  masterVolume: 80,
  sfxVolume: 70,
  musicVolume: 50,
  marketBellSound: true,
  tradeSound: true,
  newsAlertSound: true,
  reducedAnimations: false,
  highContrast: false,
  colorblindMode: 'off',
  largeText: false,
  newsTickerSpeed: 60,
  keyBindings: { ...DEFAULT_KEYBINDINGS },
};

const APP_VERSION = '0.2.0';

// --- Component ---

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState('gameplay');
  const trapRef = useFocusTrap<HTMLDivElement>();
  if (!isOpen) return null;

  const TABS = [
    { id: 'gameplay', label: t('settings.gameplay') },
    { id: 'simulation', label: t('settings.simulation') },
    { id: 'video', label: t('settings.video') },
    { id: 'audio', label: t('settings.audio') },
    { id: 'controls', label: t('settings.controls') },
    { id: 'accessibility', label: t('settings.accessibility') },
  ] as const;

  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div ref={trapRef} style={S.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.title}>{t('settings.title')}</span>
          <span role="button" tabIndex={0} style={S.closeBtn} onClick={onClose} onKeyDown={e => e.key === 'Enter' && onClose()} aria-label={t('settings.closeSettings')}>x</span>
        </div>

        <div style={S.body}>
          {/* Sidebar */}
          <div style={S.sidebar}>
            {TABS.map((tabItem) => (
              <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
                style={{ ...S.tab, ...(tab === tabItem.id ? S.tabActive : {}) }}>
                {tabItem.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={S.content}>

            {tab === 'gameplay' && <>
              <H>{t('settings.general')}</H>
              <Toggle k="autosave" label={t('settings.autosave')} v={settings.autosave} set={set} />
              {settings.autosave && (
                <Select k="autosaveInterval" label={t('settings.autosaveInterval')} v={String(settings.autosaveInterval)}
                  opts={[['1', t('settings.min1')],['5', t('settings.min5')],['10', t('settings.min10')],['15', t('settings.min15')],['30', t('settings.min30')]]}
                  set={(_, val) => set('autosaveInterval', Number(val))} />
              )}
              {settings.autosave && (
                <Toggle k="showAutosaveNotification" label={t('settings.showAutosaveNotification')} v={settings.showAutosaveNotification} set={set} />
              )}
              <Toggle k="showTooltips" label={t('settings.showTooltips')} v={settings.showTooltips} set={set} />
              <Toggle k="confirmOrders" label={t('settings.confirmOrders')} v={settings.confirmOrders} set={set} />
              <Toggle k="skipWeekends" label={t('settings.skipWeekends')} v={settings.skipWeekends} set={set} />
              <Select k="language" label={t('settings.language')} v={settings.language}
                opts={[['en', 'English'],['de', 'Deutsch'],['zh', '简体中文'],['tw', '繁體中文']]} set={set} />
              <H>{t('settings.autoPause')}</H>
              <Toggle k="autoPauseOnNews" label={t('settings.onBreakingNews')} v={settings.autoPauseOnNews} set={set} />
              <Toggle k="autoPauseOnAlert" label={t('settings.onPriceAlert')} v={settings.autoPauseOnAlert} set={set} />
              <Toggle k="autoPauseOnMarginCall" label={t('settings.onMarginCall')} v={settings.autoPauseOnMarginCall} set={set} />
              <Toggle k="autoPauseOnShortSqueeze" label={t('settings.onShortSqueeze')} v={settings.autoPauseOnShortSqueeze} set={set} />
              <Toggle k="autoPauseOnOrderExecution" label={t('settings.onOrderExecution')} v={settings.autoPauseOnOrderExecution} set={set} />
              <Toggle k="autoPauseOnMarketOpen" label={t('settings.onMarketOpen')} v={settings.autoPauseOnMarketOpen} set={set} />
            </>}

            {tab === 'simulation' && <>
              <H>{t('settings.tradingCosts')}</H>
              <Toggle k="tradingCommission" label={t('settings.tradingCommission')} v={settings.tradingCommission} set={set} />
              {settings.tradingCommission && (
                <div style={S.row}>
                  <span style={S.label}>{t('settings.commissionAmount')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>$</span>
                    <input type="number" min={0} max={50} step={0.05}
                      value={settings.commissionAmount}
                      onChange={e => set('commissionAmount', parseFloat(e.target.value) || 0)}
                      style={{ ...S.select, width: '80px', textAlign: 'right' }} />
                  </div>
                </div>
              )}
              <Toggle k="marginInterest" label={t('settings.marginInterest')} v={settings.marginInterest} set={set} />
              <Toggle k="shortBorrowFees" label={t('settings.shortBorrowFees')} v={settings.shortBorrowFees} set={set} />
              <H>{t('settings.taxes')}</H>
              <Toggle k="enableTaxes" label={t('settings.enableTaxes')} v={settings.enableTaxes} set={set} />
              {settings.enableTaxes && (
                <Select k="taxRateMode" label={t('settings.taxRateMode')} v={settings.taxRateMode}
                  opts={[['realistic', t('settings.realistic')],['flat', t('settings.flat')],['off', t('settings.off')]]} set={set} />
              )}
              <H>{t('settings.regulation')}</H>
              <Toggle k="smaEnforcement" label={t('settings.smaEnforcement')} v={settings.smaEnforcement} set={set} />
              {settings.smaEnforcement && (
                <Select k="smaStrictness" label={t('settings.smaStrictness')} v={settings.smaStrictness}
                  opts={[['lenient', t('settings.lenient')],['normal', t('settings.normal')],['strict', t('settings.strict')]]} set={set} />
              )}
            </>}

            {tab === 'video' && <>
              <H>{t('settings.theme')}</H>
              <Select k="theme" label={t('settings.colorTheme')} v={settings.theme}
                opts={[['default', t('settings.classicBlue')],['slate', t('settings.slateNeutral')],['amber', t('settings.amberTerminal')]]} set={set} />
              <H>{t('settings.interface')}</H>
              <Slider k="uiScale" label={t('settings.uiScale')} v={settings.uiScale} min={80} max={150} step={10}
                fmt={v => `${v}%`} set={set} />
              <Select k="defaultChartTimeframe" label={t('settings.defaultChartTimeframe')} v={settings.defaultChartTimeframe}
                opts={[['1D', t('settings.oneDay')],['1W', t('settings.oneWeek')],['1M', t('settings.oneMonth')],['ALL', t('settings.allTime')]]} set={set} />
              <Select k="defaultChartType" label={t('settings.defaultChartType')} v={settings.defaultChartType}
                opts={[['candle', t('settings.candlestick')],['line', t('settings.line')],['area', t('settings.area')]]} set={set} />
              <Select k="numberFormat" label={t('settings.numberFormat')} v={settings.numberFormat}
                opts={[['us', t('settings.usFormat')],['eu', t('settings.euFormat')]]} set={set} />
              <Toggle k="showSparklines" label={t('settings.showSparklines')} v={settings.showSparklines} set={set} />
            </>}

            {tab === 'audio' && <>
              <H>{t('settings.volume')}</H>
              <Slider k="masterVolume" label={t('settings.master')} v={settings.masterVolume} min={0} max={100} step={5}
                fmt={v => `${v}%`} set={set} />
              <Slider k="musicVolume" label={t('settings.music')} v={settings.musicVolume} min={0} max={100} step={5}
                fmt={v => `${v}%`} set={set} />
              <Slider k="sfxVolume" label={t('settings.soundEffects')} v={settings.sfxVolume} min={0} max={100} step={5}
                fmt={v => `${v}%`} set={set} />
              <H>{t('settings.notifications')}</H>
              <Toggle k="marketBellSound" label={t('settings.marketBell')} v={settings.marketBellSound} set={set} />
              <Toggle k="tradeSound" label={t('settings.tradeExecution')} v={settings.tradeSound} set={set} />
              <Toggle k="newsAlertSound" label={t('settings.newsAlerts')} v={settings.newsAlertSound} set={set} />
            </>}

            {tab === 'controls' && <>
              <H>{t('settings.time')}</H>
              <KB label={t('settings.pauseResume')} bk="pauseResume" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('settings.oneX')} bk="speed1" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('settings.twoX')} bk="speed2" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('settings.fiveX')} bk="speed3" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('settings.tenX')} bk="speed4" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <H>{t('settings.navigation')}</H>
              <KB label={t('nav.dashboard')} bk="tabDashboard" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('nav.portfolio')} bk="tabPortfolio" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('nav.market')} bk="tabMarket" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('nav.orders')} bk="tabOrders" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('nav.news')} bk="tabNews" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('nav.analytics')} bk="tabAnalytics" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <H>System</H>
              <KB label={t('settings.quickSave')} bk="quickSave" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <KB label={t('settings.help')} bk="help" b={settings.keyBindings}
                onChange={b => set('keyBindings', { ...settings.keyBindings, ...b })} />
              <div style={{ marginTop: '8px' }}>
                <button onClick={() => set('keyBindings', { ...DEFAULT_KEYBINDINGS })}
                  style={S.resetBtn}>{t('settings.resetToDefaults')}</button>
              </div>
            </>}

            {tab === 'accessibility' && <>
              <H>{t('settings.visual')}</H>
              <Toggle k="reducedAnimations" label={t('settings.reducedAnimations')} v={settings.reducedAnimations} set={set} />
              <Toggle k="highContrast" label={t('settings.highContrast')} v={settings.highContrast} set={set} />
              <Toggle k="largeText" label={t('settings.largeText')} v={settings.largeText} set={set} />
              <Select k="colorblindMode" label={t('settings.colorblindMode')} v={settings.colorblindMode}
                opts={[['off', t('settings.off')],['deuteranopia', t('settings.deuteranopia')],['protanopia', t('settings.protanopia')],['tritanopia', t('settings.tritanopia')]]} set={set} />
              <H>{t('settings.reading')}</H>
              <Slider k="newsTickerSpeed" label={t('settings.tickerSpeed')} v={settings.newsTickerSpeed} min={20} max={120} step={5}
                fmt={v => `${v}`} set={set} />
            </>}

          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={{ ...S.footerBtn, color: 'var(--text-disabled)' }}
            onClick={() => onSettingsChange(DEFAULT_SETTINGS)}>{t('settings.resetAll')}</button>
          <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>v{APP_VERSION}</span>
          <button style={{ ...S.footerBtn, color: 'var(--text-accent)' }} onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function H({ children }: { children: string }) {
  return <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-accent)', letterSpacing: '1.5px', padding: '14px 0 4px' }}>{children.toUpperCase()}</div>;
}

function Toggle<K extends keyof GameSettings>({ label, k, v, set }: { label: string; k: K; v: boolean; set: (k: K, v: GameSettings[K]) => void }) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <button onClick={() => set(k, !v as GameSettings[K])}
        style={{ ...S.toggle, background: v ? 'var(--green-primary)' : 'var(--bg-tertiary)' }}>
        <div style={{ ...S.knob, transform: v ? 'translateX(16px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

function Slider<K extends keyof GameSettings>({ label, k, v, min, max, step, fmt, set }: {
  label: string; k: K; v: number; min: number; max: number; step: number; fmt: (v: number) => string;
  set: (k: K, v: GameSettings[K]) => void;
}) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="range" min={min} max={max} step={step} value={v}
          onChange={e => set(k, parseFloat(e.target.value) as GameSettings[K])}
          style={{ width: '100px', accentColor: 'var(--text-accent)' }} />
        <span className="mono" style={{ fontSize: '12px', color: 'var(--text-primary)', width: '44px', textAlign: 'right' }}>{fmt(v)}</span>
      </div>
    </div>
  );
}

function Select<K extends keyof GameSettings>({ label, k, v, opts, set }: {
  label: string; k: K; v: string; opts: string[][]; set: (k: K, v: GameSettings[K]) => void;
}) {
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <select value={v} onChange={e => set(k, e.target.value as GameSettings[K])} style={S.select}>
        {opts.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}

function KB({ label, bk, b, onChange }: { label: string; bk: keyof KeyBindings; b: KeyBindings; onChange: (p: Partial<KeyBindings>) => void }) {
  const [listening, setListening] = useState(false);
  const listen = () => {
    setListening(true);
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      let key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (e.ctrlKey && key !== 'Control') key = 'Ctrl+' + key;
      if (e.altKey && key !== 'Alt') key = 'Alt+' + key;
      onChange({ [bk]: key });
      setListening(false);
      window.removeEventListener('keydown', h, true);
    };
    window.addEventListener('keydown', h, true);
  };
  return (
    <div style={S.row}>
      <span style={S.label}>{label}</span>
      <button onClick={listen} style={{
        ...S.kbd, cursor: 'pointer',
        ...(listening ? { background: 'var(--text-accent)', color: 'var(--text-primary)', borderColor: 'var(--text-accent)' } : {}),
      }}>{listening ? '...' : b[bk]}</button>
    </div>
  );
}

// --- Styles ---

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 },
  modal: { width: '620px', height: '460px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--border)' },
  title: { fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' },
  closeBtn: { color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer', padding: '2px 6px' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: '130px', borderRight: '1px solid var(--border)', padding: '4px 0', display: 'flex', flexDirection: 'column' },
  tab: { background: 'transparent', border: 'none', borderLeft: '2px solid transparent', padding: '7px 12px', textAlign: 'left', fontSize: '13px', fontFamily: 'var(--font-ui)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 100ms' },
  tabActive: { color: 'var(--text-accent)', borderLeftColor: 'var(--text-accent)', background: 'color-mix(in srgb, var(--text-accent) 6%, transparent)' },
  content: { flex: 1, padding: '2px 18px 12px', overflowY: 'auto' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid color-mix(in srgb, var(--border) 15%, transparent)', minHeight: '32px' },
  label: { fontSize: '13px', color: 'var(--text-primary)' },
  toggle: { width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer', position: 'relative', padding: 0, transition: 'background 150ms', flexShrink: 0 },
  knob: { width: '16px', height: '16px', borderRadius: '50%', background: 'var(--text-primary)', position: 'absolute', top: '2px', left: '2px', transition: 'transform 150ms' },
  select: { background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 6px', fontSize: '12px', fontFamily: 'var(--font-ui)', cursor: 'pointer', width: '170px' },
  kbd: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)', minWidth: '50px', textAlign: 'center' },
  resetBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-disabled)', padding: '3px 10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-ui)' },
  footer: { display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid var(--border)' },
  footerBtn: { background: 'transparent', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)' },
};
