import { useState, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { OrderSide, OrderType, StockData } from '@/types/market';
import { WebSocketClient } from '@/services/websocket';
import { createLogger } from '@/services/logger';
import { audio } from '@/services/audio';
import { ConfirmOrderDialog } from './ConfirmOrderDialog';
import { useI18n } from '@/i18n/I18nContext';

const log = createLogger('OrderPanel');

interface OrderPanelProps {
  stock: StockData;
  wsClient: WebSocketClient;
}

/**
 * Order entry panel for buying and selling stocks.
 * Spec 3.5.2: Buy/Sell tabs, Market/Limit dropdown, quantity, estimated cost, place button.
 */
// Beginner mode: unlock thresholds
const UNLOCK_SHORT = 5;      // trades needed to unlock Short Selling
const UNLOCK_ADVANCED = 3;   // trades needed to unlock Stop/StopLimit/Trailing

export function OrderPanel({ stock, wsClient }: OrderPanelProps) {
  const { t, formatMoney } = useI18n();
  const { portfolio, lastOrderResult, setOrderResult, isMarketOpen, beginnerMode } = useMarketStore();

  const [side, setSide] = useState<OrderSide>('Buy');
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailAmount, setTrailAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Read confirmOrders setting from localStorage (persisted by App.tsx)
  const getConfirmOrders = (): boolean => {
    try {
      const raw = localStorage.getItem('stocksim-settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.confirmOrders !== false; // default true
      }
    } catch {}
    return true;
  };

  /** Show confirm dialog if enabled, otherwise execute immediately */
  const placeOrder = () => {
    if (getConfirmOrders()) {
      setShowConfirm(true);
    } else {
      handleSubmit();
    }
  };

  // Listen for trading shortcut keys (B=Buy, S=Sell, H=Short, C=Cover)
  useEffect(() => {
    const handler = (e: Event) => {
      const side = (e as CustomEvent).detail as OrderSide;
      setSide(side);
    };
    window.addEventListener('tradingShortcut', handler);
    return () => window.removeEventListener('tradingShortcut', handler);
  }, []);

  // Reset form when stock changes
  useEffect(() => {
    setQuantity('');
    setSide('Buy');
    setOrderType('Market');
    setToast(null);
  }, [stock.symbol]);

  // Pre-fill prices when switching order type
  useEffect(() => {
    if (orderType === 'Limit' || orderType === 'StopLimit') {
      setLimitPrice(stock.price.toFixed(2));
    }
    if (orderType === 'Stop' || orderType === 'StopLimit') {
      setStopPrice((stock.price * 0.95).toFixed(2));
    }
    if (orderType === 'TrailingStop') {
      setTrailAmount((stock.price * 0.05).toFixed(2));
    }
  }, [orderType, stock.symbol]);

  // Clear toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle order result
  useEffect(() => {
    if (lastOrderResult) {
      setSubmitting(false);
      if (lastOrderResult.success) {
        const order = lastOrderResult.order;
        if (order && order.status === 'Filled') {
          setToast({
            message: `${order.side} ${order.quantity} ${order.symbol} @ ${formatMoney(order.fillPrice ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            type: 'success',
          });
          setQuantity('');
        } else if (order && order.status === 'Pending') {
          setToast({ message: t('orderPanel.orderQueued'), type: 'success' });
          setQuantity('');
        } else if (order && order.status === 'Open') {
          setToast({ message: t('orderPanel.limitPlaced'), type: 'success' });
          setQuantity('');
        }
      } else {
        setToast({ message: lastOrderResult.error || t('orderPanel.orderFailed'), type: 'error' });
      }
      setOrderResult(null);
    }
  }, [lastOrderResult, setOrderResult, t, formatMoney]);

  // Beginner mode feature locks
  const tradeCount = portfolio?.tradeCount ?? 0;
  const shortLocked = beginnerMode && tradeCount < UNLOCK_SHORT;
  const advancedLocked = beginnerMode && tradeCount < UNLOCK_ADVANCED;

  const qty = Math.floor(parseFloat(quantity) || 0); // Integer shares only
  const lmtPrice = parseFloat(limitPrice) || 0;
  const stp = parseFloat(stopPrice) || 0;
  const trail = parseFloat(trailAmount) || 0;
  const estimatedPrice = side === 'Buy' ? stock.ask : stock.bid;
  const estimatedCost = qty * estimatedPrice;
  const commission = portfolio && portfolio.tradeCount > 0
    ? Math.round(((portfolio.totalCommissions ?? 0) / portfolio.tradeCount) * 100) / 100
    : 4.95;
  const totalCost = side === 'Buy' ? estimatedCost + commission : estimatedCost - commission;
  const cash = portfolio?.cash ?? 0;
  const buyingPower = (portfolio as unknown as Record<string, unknown>)?.buyingPower as number ?? cash;
  const marginEnabled = (portfolio as unknown as Record<string, unknown>)?.marginEnabled as boolean ?? false;
  const position = portfolio?.positions.find(p => p.symbol === stock.symbol);

  const hasRequiredPrices = (() => {
    switch (orderType) {
      case 'Market': return true;
      case 'Limit': return lmtPrice > 0;
      case 'Stop': return stp > 0;
      case 'StopLimit': return stp > 0 && lmtPrice > 0;
      case 'TrailingStop': return trail > 0;
    }
  })();

  const shortPosition = portfolio?.positions.find(p => p.symbol === stock.symbol && p.shares < 0);

  const canSubmit = qty > 0 && !submitting && hasRequiredPrices && (() => {
    switch (side) {
      case 'Buy': return totalCost <= (marginEnabled ? buyingPower : cash);
      case 'Sell': return position ? qty <= position.shares && position.shares > 0 : false;
      case 'Short': return totalCost <= (marginEnabled ? buyingPower : cash);
      case 'Cover': return shortPosition ? qty <= Math.abs(shortPosition.shares) : false;
    }
  })();

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      symbol: stock.symbol,
      side,
      type: orderType,
      quantity: qty,
    };

    if (orderType === 'Limit' || orderType === 'StopLimit') {
      payload.limitPrice = lmtPrice;
      payload.timeInForce = 'GTC';
    }
    if (orderType === 'Stop' || orderType === 'StopLimit') {
      payload.stopPrice = stp;
    }
    if (orderType === 'TrailingStop') {
      payload.trailAmount = trail;
    }

    log.info('Placing order', payload);
    audio.orderPlaced();
    wsClient.send('PlaceOrder', payload);
    window.dispatchEvent(new Event('tutorial:orderPlaced'));
  }, [canSubmit, stock.symbol, side, orderType, qty, lmtPrice, stp, trail, wsClient]);

  const isBuy = side === 'Buy' || side === 'Cover';

  const tabStyle = (active: boolean, color: string, dimColor: string) => ({
    flex: 1,
    height: '36px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontWeight: 700,
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    background: active ? dimColor : 'var(--bg-tertiary)',
    color: active ? color : 'var(--text-secondary)',
  });

  return (
    <div style={{ padding: '12px' }}>
      {/* Buy / Sell / Short Tabs (Spec 3.5.2) */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '12px' }}>
        <button onClick={() => setSide('Buy')}
          style={{ ...tabStyle(side === 'Buy', 'var(--green-primary)', 'var(--green-dim)'), borderRadius: '4px 0 0 4px' }}>
          {t('orderPanel.buy')}
        </button>
        <button onClick={() => setSide('Sell')}
          style={tabStyle(side === 'Sell', 'var(--red-primary)', 'var(--red-dim)')}>
          {t('orderPanel.sell')}
        </button>
        <button
          onClick={() => !shortLocked && setSide('Short')}
          style={{
            ...tabStyle(side === 'Short', 'var(--warning)', 'color-mix(in srgb, var(--warning) 15%, transparent)'),
            ...(shortLocked ? { opacity: 0.35, cursor: 'not-allowed' } : {}),
          }}
          title={shortLocked ? t('orderPanel.unlockShortTitle', { count: UNLOCK_SHORT }) : t('orderPanel.shortSellTitle')}
        >
          {t('orderPanel.short')}{shortLocked ? ` ${t('orderPanel.locked')}` : ''}
        </button>
        <button
          onClick={() => !shortLocked && setSide('Cover')}
          style={{
            ...tabStyle(side === 'Cover', 'var(--text-accent)', 'color-mix(in srgb, var(--text-accent) 15%, transparent)'),
            borderRadius: '0 4px 4px 0',
            ...(shortLocked ? { opacity: 0.35, cursor: 'not-allowed' } : {}),
          }}
          title={shortLocked ? t('orderPanel.unlockCoverTitle', { count: UNLOCK_SHORT }) : t('orderPanel.coverTitle')}
        >
          {t('orderPanel.cover')}{shortLocked ? ` ${t('orderPanel.locked')}` : ''}
        </button>
      </div>

      {/* Short Borrow Info */}
      {(side === 'Short' || side === 'Cover') && (() => {
        const fundamentals = useMarketStore.getState().stockFundamentals;
        const si = fundamentals?.symbol === stock.symbol ? fundamentals.shortInterest : 0;
        const siPct = si * 100;
        const isHighSI = siPct > 15;
        return si > 0 ? (
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '6px 10px', marginBottom: '8px',
            background: isHighSI ? 'color-mix(in srgb, var(--red-primary) 8%, transparent)' : 'var(--bg-tertiary)',
            border: `1px solid ${isHighSI ? 'color-mix(in srgb, var(--red-primary) 20%, transparent)' : 'var(--border)'}`,
            borderRadius: '4px', fontSize: '11px',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>{t('orderPanel.shortInterest')}</span>
            <span className="mono" style={{ fontWeight: 600, color: isHighSI ? 'var(--red-primary)' : 'var(--text-primary)' }}>
              {siPct.toFixed(1)}%{isHighSI ? ` ${t('orderPanel.high')}` : ''}
            </span>
          </div>
        ) : null;
      })()}

      {/* SSR Warning (Spec 4.4.2) */}
      {side === 'Short' && stock.isSSR && (
        <div style={{
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          borderRadius: '4px', padding: '6px 10px', marginBottom: '10px',
          fontSize: '11px', color: 'var(--warning)', lineHeight: 1.4,
        }}>
          <span style={{ fontWeight: 700 }}>{t('orderPanel.ssrActive')}</span> — {t('orderPanel.ssrDesc')}
        </div>
      )}

      {/* Order Type Dropdown */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          {t('orderPanel.orderType')}
        </label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as OrderType)}
          style={{
            width: '100%',
            height: '36px',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0 8px',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
          }}
        >
          <option value="Market">{t('orderPanel.market')}</option>
          <option value="Limit">{t('orderPanel.limit')}</option>
          <option value="Stop" disabled={advancedLocked}>{t('orderPanel.stop')}{advancedLocked ? t('orderPanel.lockedSuffix') : ''}</option>
          <option value="StopLimit" disabled={advancedLocked}>{t('orderPanel.stopLimit')}{advancedLocked ? t('orderPanel.lockedSuffix') : ''}</option>
          <option value="TrailingStop" disabled={advancedLocked}>{t('orderPanel.trailingStop')}{advancedLocked ? t('orderPanel.lockedSuffix') : ''}</option>
        </select>
        <div style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '3px' }}>
          {orderType === 'Market' && t('orderPanel.marketDesc')}
          {orderType === 'Limit' && t('orderPanel.limitDesc')}
          {orderType === 'Stop' && t('orderPanel.stopDesc')}
          {orderType === 'StopLimit' && t('orderPanel.stopLimitDesc')}
          {orderType === 'TrailingStop' && t('orderPanel.trailingDesc')}
        </div>
      </div>

      {/* Beginner unlock progress */}
      {beginnerMode && (shortLocked || advancedLocked) && (
        <div style={{
          background: 'color-mix(in srgb, var(--text-accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--text-accent) 20%, transparent)',
          borderRadius: '4px', padding: '6px 10px', marginBottom: '10px',
          fontSize: '10px', color: '#93c5fd', lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 700 }}>{t('orderPanel.beginnerMode')}</span> {t('orderPanel.tradesCompleted', { trades: tradeCount, needed: UNLOCK_SHORT })}
          {advancedLocked && t('orderPanel.unlockStop', { needed: UNLOCK_ADVANCED })}
          {shortLocked && t('orderPanel.unlockShort', { needed: UNLOCK_SHORT })}
        </div>
      )}

      {/* Quantity */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          {t('orderPanel.quantity')}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            min="0"
            step="1"
            style={{
              flex: 1,
              height: '36px',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '0 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('orderPanel.shares')}</span>
        </div>
        {/* Quick Size Buttons */}
        <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
          {[
            { label: '25%', pct: 0.25 },
            { label: '50%', pct: 0.50 },
            { label: '75%', pct: 0.75 },
            { label: 'MAX', pct: 0.99 },
          ].map(opt => {
            const price = side === 'Buy' ? stock.ask : stock.bid;
            const maxShares = price > 0 ? Math.floor((buyingPower * opt.pct) / price) : 0;
            return (
              <button key={opt.label} onClick={() => setQuantity(String(Math.max(1, maxShares)))} style={{
                flex: 1, padding: '3px', border: '1px solid var(--border)', borderRadius: '3px',
                background: 'var(--bg-tertiary)', cursor: 'pointer',
                fontSize: '10px', fontWeight: 600, fontFamily: 'var(--font-mono)',
                color: 'var(--text-disabled)',
              }} title={t('orderPanel.sharesOfBp', { shares: maxShares, label: opt.label })}>{opt.label}</button>
            );
          })}
        </div>
        {/* Position size info */}
        {qty > 0 && (
          <div className="mono" style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '3px' }}>
            {portfolio && portfolio.totalEquity > 0 && (
              <span>{t('orderPanel.positionPct', { pct: ((estimatedCost / portfolio.totalEquity) * 100).toFixed(1) })}</span>
            )}
          </div>
        )}
      </div>

      {/* Limit Price (only for Limit orders) */}
      {orderType === 'Limit' && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {t('orderPanel.limitPrice')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>$</span>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              style={{
                flex: 1,
                height: '36px',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '0 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
              }}
            />
          </div>
        </div>
      )}

      {/* Time in Force (for non-Market orders) */}
      {orderType !== 'Market' && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {t('orderPanel.timeInForce')}
          </label>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            {[
              { value: 'GTC', label: t('orderPanel.gtc'), title: t('orderPanel.gtcTitle') },
              { value: 'Day', label: t('orderPanel.day'), title: t('orderPanel.dayTitle') },
            ].map(opt => (
              <button key={opt.value} title={opt.title} style={{
                flex: 1, padding: '6px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)',
                background: 'var(--bg-primary)', color: 'var(--text-accent)',
                opacity: opt.value === 'GTC' ? 1 : 0.5,
              }}>{opt.label}</button>
            ))}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '3px' }}>
            {t('orderPanel.gtcDesc')}
          </div>
        </div>
      )}

      {/* Stop Price (for Stop, StopLimit) */}
      {(orderType === 'Stop' || orderType === 'StopLimit') && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {t('orderPanel.stopPrice')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>$</span>
            <input type="number" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              style={{ flex: 1, height: '36px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: '14px' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '4px' }}>
            {orderType === 'Stop'
              ? t('orderPanel.stopDescMarket')
              : t('orderPanel.stopDescLimit')}
          </div>
        </div>
      )}

      {/* Trail Amount (for TrailingStop) */}
      {orderType === 'TrailingStop' && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {t('orderPanel.trailAmount')}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>$</span>
            <input type="number" value={trailAmount} onChange={(e) => setTrailAmount(e.target.value)}
              placeholder="0.00" min="0" step="0.01"
              style={{ flex: 1, height: '36px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: '14px' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '4px' }}>
            {t('orderPanel.trailDesc')}
          </div>
        </div>
      )}

      {/* Estimated Cost */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          {isBuy ? t('orderPanel.estimatedCost') : t('orderPanel.estimatedProceeds')}
        </label>
        <span className="mono" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
          {formatMoney(qty > 0 ? totalCost : 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {qty > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-disabled)', marginLeft: '8px' }}>
            {t('orderPanel.inclCommission', { amount: commission.toFixed(2) })}
          </span>
        )}
      </div>

      {/* Available Funds / Position */}
      <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {isBuy ? (
          <div>
            <span style={{ color: totalCost > buyingPower && qty > 0 ? 'var(--red-primary)' : undefined }}>
              {marginEnabled ? t('orderPanel.buyingPower') : t('orderPanel.availableCash')}: <span className="mono">{formatMoney(marginEnabled ? buyingPower : cash, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </span>
            {marginEnabled && (
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', marginTop: '2px' }}>
                {t('orderPanel.cashAndMargin', { cash: formatMoney(cash, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin: formatMoney(buyingPower - cash, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
              </div>
            )}
          </div>
        ) : (
          <span>
            {t('orderPanel.position')}: <span className="mono">{position ? t('orderPanel.sharesAt', { shares: position.shares, price: position.averageCost.toFixed(2) }) : t('orderPanel.none')}</span>
          </span>
        )}
      </div>

      {/* Market status hint */}
      {!isMarketOpen && (
        <div style={{ marginBottom: '12px', fontSize: '11px', color: 'var(--text-disabled)' }}>
          {t('orderPanel.marketClosedHint')}
        </div>
      )}

      {/* Place Order Button */}
      <button
        onClick={() => placeOrder()}
        disabled={!canSubmit}
        style={{
          width: '100%',
          height: '44px',
          border: 'none',
          borderRadius: '6px',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: '14px',
          textTransform: 'uppercase',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.4,
          background: side === 'Buy' ? 'var(--green-primary)' :
                     side === 'Sell' ? 'var(--red-primary)' :
                     side === 'Short' ? 'var(--warning)' : 'var(--text-accent)',
          color: side === 'Short' ? '#000000' : 'var(--text-primary)',
        }}
      >
        {submitting ? t('orderPanel.placing') : t('orderPanel.placeOrder', { side: side.toUpperCase() })}
      </button>

      {/* Toast */}
      {toast && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            background: toast.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
            color: toast.type === 'success' ? 'var(--green-primary)' : 'var(--red-primary)',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Position Quick View (Spec 3.5.3) */}
      {position && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {t('orderPanel.yourPosition')}
          </div>
          <div className="mono" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {t('orderPanel.sharesAt', { shares: position.shares, price: position.averageCost.toFixed(2) })}
          </div>
          <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {t('orderPanel.value')} {formatMoney(position.marketValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            className="mono"
            style={{
              fontSize: '14px',
              color: position.unrealizedPnL >= 0 ? 'var(--green-primary)' : 'var(--red-primary)',
            }}
          >
            {t('orderPanel.pl')} {position.unrealizedPnL >= 0 ? '+' : ''}{formatMoney(position.unrealizedPnL, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}({position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
          </div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            {[25, 50, 75, 100].map(pct => {
              const sellQty = Math.max(1, Math.floor(position.shares * pct / 100));
              return (
                <button key={pct}
                  onClick={() => {
                    setSide('Sell');
                    setOrderType('Market');
                    setQuantity(sellQty.toString());
                    if (pct === 100) setTimeout(() => placeOrder(), 50);
                  }}
                  style={{
                    flex: 1, height: '30px', border: 'none', borderRadius: '4px',
                    background: pct === 100 ? 'var(--red-primary)' : 'var(--bg-input)',
                    color: pct === 100 ? 'var(--text-primary)' : 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  }}
                >{pct}%</button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmOrderDialog
        isOpen={showConfirm}
        symbol={stock.symbol}
        side={side}
        type={orderType}
        quantity={qty}
        estimatedPrice={estimatedPrice}
        commission={commission}
        cash={cash}
        totalEquity={portfolio?.totalEquity}
        onConfirm={() => { setShowConfirm(false); handleSubmit(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
