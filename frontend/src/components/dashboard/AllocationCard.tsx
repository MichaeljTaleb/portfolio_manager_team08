import { useEffect, useMemo, useState } from 'react';
import { fetchCash, fetchHoldings } from '../../api/client';
import { useLivePrices } from '../../contexts/LivePricesContext';
import type { AssetType, Holding } from '../../types/portfolio';
import { Card } from '../common/Card';

type AssetClass = AssetType;

interface BreakdownItem {
  name: string;
  value: number;
  percentage: number;
  shareOfClass: number;
  color: string;
}

const assetClasses: { name: AssetClass; color: string }[] = [
  { name: 'Stocks', color: '#3B82F6' },
  { name: 'Bonds', color: '#A78BFA' },
  { name: 'Cash', color: '#22C55E' },
];

const categoryColors = ['#60A5FA', '#34D399', '#FBBF24', '#F472B6', '#A78BFA', '#22D3EE', '#FB923C'];

const createSegments = <T extends { percentage: number }>(items: T[], radius: number) => {
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  return items.map((item) => {
    const length = (item.percentage / 100) * circumference;
    const offset = -(cumulative / 100) * circumference;
    cumulative += item.percentage;
    return { ...item, length, offset };
  });
};

export function AllocationCard() {
  const [drawn, setDrawn] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [hoveredAsset, setHoveredAsset] = useState<AssetClass | null>(null);
  const [hoveredBreakdown, setHoveredBreakdown] = useState<string | null>(null);
  const livePrices = useLivePrices();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const loadAllocation = async () => {
      const [nextHoldings, cashSummary] = await Promise.all([fetchHoldings(), fetchCash()]);
      setHoldings(nextHoldings);
      setCashBalance(cashSummary.balance);
    };

    void loadAllocation();
  }, []);

  const { assets, breakdowns, totalValue } = useMemo(() => {
    const holdingValues = holdings.map((holding) => ({
      ...holding,
      value: holding.type === 'Cash'
        ? holding.value
        : holding.quantity * (livePrices[holding.ticker] ?? holding.currentPrice),
    }));
    const values = new Map<AssetClass, number>(assetClasses.map(({ name }) => [name, name === 'Cash' ? cashBalance : 0]));

    holdingValues.forEach((holding) => {
      if (holding.type !== 'Cash') {
        values.set(holding.type, (values.get(holding.type) ?? 0) + holding.value);
      }
    });

    const total = Array.from(values.values()).reduce((sum, value) => sum + value, 0);
    const nextAssets = assetClasses
      .map(({ name, color }) => ({ name, color, value: values.get(name) ?? 0, percentage: total ? ((values.get(name) ?? 0) / total) * 100 : 0 }))
      .filter((asset) => asset.value > 0);

    const nextBreakdowns = new Map<AssetClass, BreakdownItem[]>();
    (['Stocks', 'Bonds'] as AssetClass[]).forEach((assetClass) => {
      const classHoldings = holdingValues.filter((holding) => holding.type === assetClass);
      const classValue = values.get(assetClass) ?? 0;
      const grouped = classHoldings.reduce<Map<string, number>>((groups, holding) => {
        const category = holding.sector?.trim() || 'Other';
        groups.set(category, (groups.get(category) ?? 0) + holding.value);
        return groups;
      }, new Map());
      nextBreakdowns.set(assetClass, Array.from(grouped, ([name, value], index) => ({
        name,
        value,
        percentage: total ? (value / total) * 100 : 0,
        shareOfClass: classValue ? (value / classValue) * 100 : 0,
        color: categoryColors[index % categoryColors.length],
      })));
    });

    return { assets: nextAssets, breakdowns: nextBreakdowns, totalValue: total };
  }, [cashBalance, holdings, livePrices]);

  const activeAsset = hoveredAsset && breakdowns.get(hoveredAsset)?.length ? hoveredAsset : null;
  const activeBreakdown = activeAsset ? breakdowns.get(activeAsset) ?? [] : [];
  const assetSegments = createSegments(assets, 54);
  const breakdownSegments = createSegments(activeBreakdown, 36);
  const activeAssetData = assets.find((asset) => asset.name === hoveredAsset) ?? null;
  const activeBreakdownData = activeBreakdown.find((item) => item.name === hoveredBreakdown) ?? null;

  return (
    <Card className="allocation-card">
      <span className="eyebrow">Asset allocation</span>
      <div className="allocation-content fade-slide-in">
        <div className="donut-wrap allocation-donut-wrap">
          <svg
            viewBox="0 0 132 132"
            role="img"
            aria-label="Asset allocation and category breakdown"
            onMouseLeave={() => { setHoveredAsset(null); setHoveredBreakdown(null); }}
          >
            <circle cx="66" cy="66" r="54" fill="none" stroke="var(--track)" strokeWidth="12" />
            {assetSegments.map((segment, index) => (
              <circle
                key={segment.name}
                className="donut-segment"
                data-dimmed={hoveredAsset !== null && hoveredAsset !== segment.name}
                cx="66" cy="66" r="54" fill="none" stroke={segment.color} strokeWidth="12"
                strokeDasharray={`${segment.length} ${2 * Math.PI * 54 - segment.length}`}
                strokeDashoffset={drawn ? segment.offset : segment.offset + segment.length}
                style={{ transitionDelay: `${index * 100}ms` }}
                onMouseEnter={() => { setHoveredAsset(segment.name); setHoveredBreakdown(null); }}
              />
            ))}
            {activeAsset && (
              <>
                <circle cx="66" cy="66" r="36" fill="none" stroke="var(--track)" strokeWidth="10" />
                {breakdownSegments.map((segment) => (
                  <circle
                    key={segment.name}
                    className="donut-segment donut-subsegment"
                    data-dimmed={hoveredBreakdown !== null && hoveredBreakdown !== segment.name}
                    cx="66" cy="66" r="36" fill="none" stroke={segment.color} strokeWidth="10"
                    strokeDasharray={`${segment.length} ${2 * Math.PI * 36 - segment.length}`}
                    strokeDashoffset={drawn ? segment.offset : segment.offset + segment.length}
                    onMouseEnter={() => setHoveredBreakdown(segment.name)}
                    onMouseLeave={() => setHoveredBreakdown(null)}
                  />
                ))}
              </>
            )}
          </svg>
          <div className="donut-label">
            {activeBreakdownData ? (
              <><span>{activeBreakdownData.name}</span><strong>{activeBreakdownData.shareOfClass.toFixed(1)}%</strong></>
            ) : activeAssetData ? (
              <><span>{activeAssetData.name}</span><strong>{activeAssetData.percentage.toFixed(1)}%</strong></>
            ) : (
              <><span>Total Value</span><strong>{totalValue ? `$${Math.round(totalValue).toLocaleString()}` : '—'}</strong></>
            )}
          </div>
          {(activeAssetData || activeBreakdownData) && (
            <div className="allocation-popover">
              <strong>{activeBreakdownData ? `${activeAsset} · ${activeBreakdownData.name}` : activeAssetData?.name}</strong>
              <span>{(activeBreakdownData?.percentage ?? activeAssetData?.percentage ?? 0).toFixed(1)}% of portfolio</span>
              {activeBreakdownData && <span>{activeBreakdownData.shareOfClass.toFixed(1)}% of {activeAsset}</span>}
            </div>
          )}
        </div>
        <div className="allocation-legend">
          {assets.map((asset) => {
            const children = breakdowns.get(asset.name) ?? [];
            return (
              <div
                key={asset.name}
                className="allocation-legend-group"
                onMouseEnter={() => { setHoveredAsset(asset.name); setHoveredBreakdown(null); }}
                onMouseLeave={() => { setHoveredAsset(null); setHoveredBreakdown(null); }}
              >
                <div className="legend-item" data-active={hoveredAsset === asset.name}>
                  <span className="legend-dot" style={{ background: asset.color }} />
                  <span>{asset.name}</span><strong>{asset.percentage.toFixed(1)}%</strong>
                </div>
                {hoveredAsset === asset.name && children.map((item) => (
                  <div key={item.name} className="legend-item allocation-sublegend" onMouseEnter={() => setHoveredBreakdown(item.name)} onMouseLeave={() => setHoveredBreakdown(null)}>
                    <span className="legend-dot" style={{ background: item.color }} />
                    <span>{item.name}</span><strong>{item.shareOfClass.toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
