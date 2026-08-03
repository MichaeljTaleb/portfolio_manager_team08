import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { fetchQuantAdvisorSummary } from '../api/client';

type ChatMessage = { role: 'user' | 'assistant'; text: string };

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const palette = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f97316', '#2dd4bf'];

const linePath = (values: number[], min: number, max: number, width = 680, height = 180) => values
  .map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / Math.max(max - min, 1)) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join(' ');

const areaPath = (forecast: Array<{ day: number; low: number; likely: number; high: number }>, min: number, max: number) => {
  const upper = linePath(forecast.map((point) => point.high), min, max);
  const lower = forecast.map((point, index) => {
    const reverseIndex = forecast.length - 1 - index;
    const x = (reverseIndex / Math.max(forecast.length - 1, 1)) * 680;
    const y = 180 - ((forecast[reverseIndex].low - min) / Math.max(max - min, 1)) * 180;
    return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return `${upper} ${lower} Z`;
};

const plainEnglishSummary = (healthScore: number, risk: number) =>
  `Your portfolio health score is ${healthScore}/100. It has an estimated ${percent.format(risk)}% concentration-based risk, so spreading money across more sectors can make its ride smoother.`;

/**
 * Quant Advisor dashboard.
 */
export function QuantAdvisorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalValue: number;
    healthScore: number;
    metrics: { risk: number; efficiency: number; maxDip: number; beta: number };
    forecast: Array<{ day: number; low: number; likely: number; high: number }>;
    sectorRisk: Array<{ name: string; value: number; moneyWeight: number; riskWeight: number }>;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const nextSummary = await fetchQuantAdvisorSummary();
        setSummary(nextSummary);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Portfolio data could not be loaded. Start the backend and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const requestGemini = async (prompt: string) => {
    const response = await fetch('http://127.0.0.1:5001/api/quant-advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? 'Gemini could not generate a response right now.');
    }
    const payload = await response.json() as { answer?: string };
    if (!payload.answer) throw new Error('Gemini returned an empty response.');
    return payload.answer;
  };

  const generateReview = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      const answer = await requestGemini('Write a compact portfolio health review. Include the largest concentration risk, one diversification consideration, and what the 30-day forecast means.');
      setChat((current) => [...current, { role: 'assistant', text: answer }]);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to generate the review.');
    } finally {
      setIsGenerating(false);
    }
  };

  const submitQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || isGenerating) return;
    setQuestion('');
    setError(null);
    setChat((current) => [...current, { role: 'user', text: prompt }]);
    setIsGenerating(true);
    try {
      const answer = await requestGemini(prompt);
      setChat((current) => [...current, { role: 'assistant', text: answer }]);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to send that question.');
    } finally {
      setIsGenerating(false);
    }
  };

  const chartMin = summary ? Math.min(...summary.forecast.map((point) => point.low)) * 0.995 : 0;
  const chartMax = summary ? Math.max(...summary.forecast.map((point) => point.high)) * 1.005 : 1;
  const likelyPath = summary ? linePath(summary.forecast.map((point) => point.likely), chartMin, chartMax) : '';
  const lowerPath = summary ? linePath(summary.forecast.map((point) => point.low), chartMin, chartMax) : '';
  const upperPath = summary ? linePath(summary.forecast.map((point) => point.high), chartMin, chartMax) : '';
  const monthlyRisk = summary?.metrics.risk ?? 0;
  const endForecast = summary?.forecast[summary.forecast.length - 1];
  const forecastRange = endForecast ? [endForecast.low, endForecast.likely, endForecast.high] : [];
  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: chartMin + (chartMax - chartMin) * ratio,
  }));

  if (isLoading) return <div className="quant-advisor-loading"><span className="quant-advisor-spinner" /><span>Building your Quant Advisor…</span></div>;

  if (!summary) return <div className="quant-advisor-loading"><span>Unable to load the Quant Advisor summary.</span></div>;

  const suggestedPrompts = [
    'Explain the portfolio health score in simple terms.',
    'What does the concentration metric mean for my holdings?',
    'How should I think about the 30-day forecast?',
  ];

  const kpis = [
    { key: 'health', label: 'Health score', value: `${summary.healthScore}/100`, tone: '#34d399', caption: 'Overall portfolio health', tip: 'A higher score suggests a more balanced and resilient portfolio.' },
    { key: 'concentration', label: 'Diversification Index', value: summary.metrics.risk ? `${percent.format(summary.metrics.risk)}%` : '0.0%', tone: '#fbbf24', caption: 'Portfolio concentration proxy', tip: 'This is a concentration-based measure of how concentrated the portfolio is across holdings.' },
    { key: 'efficiency', label: 'Investement Efficiency', value: summary.metrics.efficiency.toFixed(2), tone: '#38bdf8', caption: 'Risk-adjusted return proxy', tip: 'This is a simple efficiency proxy that compares expected return potential with portfolio concentration risk.' },
    { key: 'pnl', label: 'Net Account Value', value: currency.format(summary.totalValue), tone: '#a78bfa', caption: 'Current portfolio value', tip: 'This shows the current portfolio value based on the latest available price data.' },
  ];

  return (
    <div className="quant-advisor-page">
      <section className="quant-advisor-hero">
        <div>
          <h1 className="quant-advisor-title">AI Advisor &amp; Risk Analytics</h1>
        </div>
        <div className="quant-advisor-hero-controls">
          <button type="button" onClick={() => void generateReview()} disabled={isGenerating} className="quant-advisor-review-button"> {isGenerating ? 'Generating…' : 'Generate AI Review'}</button>
        </div>
      </section>

      <section className="quant-advisor-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.key} className="quant-advisor-kpi-card" onMouseEnter={() => setTooltip(kpi.key)} onMouseLeave={() => setTooltip(null)}>
            <div className="quant-advisor-kpi-label">{kpi.label}<button type="button" aria-label={`Explain ${kpi.label}`} onClick={() => setTooltip(tooltip === kpi.key ? null : kpi.key)} className="quant-advisor-info-button">?</button></div>
            <strong className="quant-advisor-kpi-value" style={{ color: kpi.tone }}>{kpi.value}</strong>
            <p className="quant-advisor-kpi-caption">{kpi.caption}</p>
            {tooltip === kpi.key && <div className="quant-advisor-tooltip">{kpi.tip}</div>}
          </article>
        ))}
      </section>

      <section className="quant-advisor-content-grid">
        <article className="quant-advisor-panel">
          <div className="quant-advisor-panel-header"><div><h2 className="quant-advisor-panel-title">30-Day Future Growth Forecast</h2><p className="quant-advisor-panel-subtitle">500 possible market paths based on your current mix</p></div><span className="quant-advisor-nav-badge">Current NAV: {currency.format(summary.totalValue)}</span></div>
          <div className="quant-advisor-forecast-layout">
            <svg viewBox="0 0 700 210" className="quant-advisor-chart" role="img" aria-label="Thirty-day Monte Carlo portfolio growth forecast">
              {yAxisTicks.map((tick) => {
                const y = 180 - ((tick.value - chartMin) / Math.max(chartMax - chartMin, 1)) * 180;
                return (
                  <line key={tick.ratio} x1="0" x2="700" y1={y} y2={y} stroke="rgba(148,163,184,.28)" strokeDasharray="5 6" />
                );
              })}
              <path d={areaPath(summary.forecast, chartMin, chartMax)} fill="rgba(56,189,248,.18)" />
              <path d={upperPath} fill="none" stroke="#34d399" strokeWidth="2" />
              <path d={likelyPath} fill="none" stroke="#38bdf8" strokeWidth="3" />
              <path d={lowerPath} fill="none" stroke="#fb7185" strokeWidth="2" />
            </svg>
            <div className="quant-advisor-forecast-summary-stack">
              <div className="quant-advisor-forecast-summary-card">
                <span className="quant-advisor-forecast-label">Current</span>
                <strong>{currency.format(summary.totalValue)}</strong>
              </div>
              <div className="quant-advisor-forecast-summary-card">
                <span className="quant-advisor-forecast-label">30-day estimate</span>
                <strong>{forecastRange.length ? currency.format(forecastRange[1]) : '—'}</strong>
              </div>
              <div className="quant-advisor-forecast-summary-card">
                <span className="quant-advisor-forecast-label">Min to max</span>
                <strong>{forecastRange.length ? `${currency.format(forecastRange[0])} – ${currency.format(forecastRange[2])}` : '—'}</strong>
              </div>
            </div>
          </div>
          <div className="quant-advisor-legend"><span><i className="quant-advisor-legend-dot" style={{ background: '#34d399' }} />Best case (90th)</span><span><i className="quant-advisor-legend-dot" style={{ background: '#38bdf8' }} />Most likely</span><span><i className="quant-advisor-legend-dot" style={{ background: '#fb7185' }} />Lower case (10th)</span></div>
        </article>

        <article className="quant-advisor-panel quant-advisor-risk-panel">
          <h2 className="quant-advisor-panel-title">Where is Your Risk Coming From?</h2>
          <p className="quant-advisor-panel-subtitle">This shows the current dollar weight of each sector in the portfolio.</p>
          <div className="quant-advisor-risk-list">
            {summary.sectorRisk.length ? summary.sectorRisk.map((sector, index) => (
              <div key={sector.name} className="quant-advisor-risk-item">
                <div className="quant-advisor-risk-title"><strong>{sector.name}</strong><span>{currency.format(sector.value)}</span></div>
                <div className="quant-advisor-risk-label"><span>Sector weight</span><span>{percent.format(sector.moneyWeight)}%</span></div>
                <div className="quant-advisor-track"><span className="quant-advisor-bar" style={{ width: `${Math.min(sector.moneyWeight, 100)}%`, background: palette[index % palette.length] }} /></div>
              </div>
            )) : <p className="quant-advisor-empty">Add holdings to see your sector risk breakdown.</p>}
          </div>
        </article>
      </section>

      <section className="quant-advisor-copilot">
        <div className="quant-advisor-copilot-intro"><h2><strong>AI Portfolio Advisor</strong></h2><p>{plainEnglishSummary(summary.healthScore, monthlyRisk)}</p></div>
        <div className="quant-advisor-prompt-suggestions">
          {suggestedPrompts.map((prompt) => (
            <button key={prompt} type="button" className="quant-advisor-prompt-pill" onClick={() => setQuestion(prompt)}>{prompt}</button>
          ))}
        </div>
        <div className="quant-advisor-chat-log" aria-live="polite">
          {chat.length === 0 && <p className="quant-advisor-empty">Ask about concentration, forecast scenarios, or the risk metrics above.</p>}
          {chat.map((message, index) => <div key={`${message.role}-${index}`} className={`quant-advisor-message ${message.role === 'user' ? 'quant-advisor-user-message' : 'quant-advisor-assistant-message'}`}>{message.text}</div>)}
        </div>
        {error && <p className="quant-advisor-error">{error}</p>}
        <form onSubmit={submitQuestion} className="quant-advisor-chat-form">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask Gemini about your portfolio…" className="quant-advisor-chat-input" disabled={isGenerating} />
          <button type="submit" disabled={isGenerating || !question.trim()} className="quant-advisor-send-button">Send</button>
        </form>
      </section>
    </div>
  );
}

