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

const CENTER = 66;

// Angle 0 = 3 o'clock, growing clockwise; the SVG itself is rotated -90deg in
// CSS so the first slice visually starts at 12 o'clock.
const polarPoint = (radius: number, angleDeg: number) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
};

// Builds a filled pie-wedge path from the center out to the arc and back,
// so slices read as an actual pie chart rather than a stroked ring.
const buildWedgePath = (radius: number, startAngle: number, endAngle: number) => {
  const span = endAngle - startAngle;
  if (span <= 0) return '';
  if (span >= 359.99) {
    const p1 = polarPoint(radius, startAngle);
    const pMid = polarPoint(radius, startAngle + 180);
    return `M ${CENTER} ${CENTER} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 1 1 ${pMid.x} ${pMid.y} A ${radius} ${radius} 0 1 1 ${p1.x} ${p1.y} Z`;
  }
  const start = polarPoint(radius, startAngle);
  const end = polarPoint(radius, endAngle);
  const largeArcFlag = span > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
};

const createWedges = <T extends { percentage: number }>(items: T[], radius: number) => {
  let cumulative = 0;
  return items.map((item) => {
    const startAngle = (cumulative / 100) * 360;
    cumulative += item.percentage;
    const endAngle = (cumulative / 100) * 360;
    return { ...item, path: buildWedgePath(radius, startAngle, endAngle), endAngle };
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

  const { assets, breakdowns } = useMemo(() => {
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
  const assetWedges = createWedges(assets, 54);
  const breakdownWedges = createWedges(activeBreakdown, 36);
  const breakdownRemainder = breakdownWedges.length
    ? buildWedgePath(36, breakdownWedges[breakdownWedges.length - 1].endAngle, 360)
    : '';
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
            {assetWedges.map((wedge, index) => (
              <path
                key={wedge.name}
                className="donut-segment"
                data-drawn={drawn}
                data-dimmed={hoveredAsset !== null && hoveredAsset !== wedge.name}
                d={wedge.path}
                fill={wedge.color}
                style={{ transitionDelay: `${index * 100}ms` }}
                onMouseEnter={() => { setHoveredAsset(wedge.name); setHoveredBreakdown(null); }}
              />
            ))}
            {activeAsset && (
              <>
                {breakdownRemainder && <path d={breakdownRemainder} fill="var(--track)" />}
                {breakdownWedges.map((wedge) => (
                  <path
                    key={wedge.name}
                    className="donut-segment donut-subsegment"
                    data-dimmed={hoveredBreakdown !== null && hoveredBreakdown !== wedge.name}
                    d={wedge.path}
                    fill={wedge.color}
                    onMouseEnter={() => setHoveredBreakdown(wedge.name)}
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
            ) : null}
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
