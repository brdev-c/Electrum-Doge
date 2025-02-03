import React, { useState, useEffect, useRef } from 'react';
import { useWallet } from '../../context/WalletContext';
import { getDogeBalanceAll, fetchDogeMarketChart } from '../../services/apiService';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  zoomPlugin,
  annotationPlugin
);

export default function BalancePanel({ theme }) {
  const { wallet, setWallet, serverParam, fiatCurrency, dogePriceFiat } = useWallet();
  const [balanceDoge, setBalanceDoge] = useState(wallet?.currentBalanceDoge || 0);
  const [balanceFiat, setBalanceFiat] = useState(0);
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('24h');
  const [scaleMode, setScaleMode] = useState('linear');
  const [smoothing, setSmoothing] = useState(false);
  const [highlightExtremes, setHighlightExtremes] = useState(true);
  const [dogeStats, setDogeStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [localTime, setLocalTime] = useState(new Date().toLocaleTimeString());
  const chartRef = useRef(null);
  const lastBalanceFetchRef = useRef(0);
  
  useEffect(() => {
    loadCachedData();
    loadBalanceAll();
    loadMarketData(range, fiatCurrency);
    loadStats(fiatCurrency);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadMarketData(range, fiatCurrency);
  }, [range, fiatCurrency]);

  useEffect(() => {
    setBalanceFiat(balanceDoge * dogePriceFiat);
  }, [balanceDoge, dogePriceFiat]);

  useEffect(() => {
    if (!wallet) return;
    let changed = false;
    const newWallet = { ...wallet };
    if (newWallet.currentBalanceDoge !== balanceDoge) {
      newWallet.currentBalanceDoge = balanceDoge;
      changed = true;
    }
    if (changed) {
      setWallet(newWallet);
      localStorage.setItem('cachedDogeBalanceAll', String(balanceDoge));
    }
  }, [wallet, balanceDoge, setWallet]);

  useEffect(() => {
    if (wallet) {
      loadBalanceAll(true);
    }
  }, [wallet]);

  function loadCachedData() {
    const cachedBal = localStorage.getItem('cachedDogeBalanceAll');
    if (cachedBal !== null) {
      setBalanceDoge(parseFloat(cachedBal));
    }
    const cachedTime = localStorage.getItem('lastBalanceFetchTime');
    if (cachedTime) {
      lastBalanceFetchRef.current = parseInt(cachedTime, 10);
    }
    const cachedChart = localStorage.getItem(`cachedChart_${range}_${fiatCurrency}`);
    if (cachedChart) {
      try {
        const arr = JSON.parse(cachedChart);
        if (Array.isArray(arr)) {
          setValues(arr);
        }
      } catch (e) {}
    }
    const cachedStats = localStorage.getItem('cachedDogeStats');
    if (cachedStats) {
      try {
        const st = JSON.parse(cachedStats);
        setDogeStats(st);
      } catch (e) {}
    }
  }

  async function loadBalanceAll(force = false) {
    if (!wallet?.addresses?.length) return;
    const now = Date.now();
    const FIVE_MIN = 5 * 60 * 1000;
    if (!force && now - lastBalanceFetchRef.current < FIVE_MIN) {
      return;
    }
    try {
      const addressList = wallet.addresses.map((a) => a.address);
      const resp = await getDogeBalanceAll(addressList, serverParam);
      const dogeBal = resp?.totalConfirmed || 0;
      setBalanceDoge(dogeBal);
      lastBalanceFetchRef.current = now;
      localStorage.setItem('lastBalanceFetchTime', String(now));
    } catch (e) {
      console.warn('getDogeBalanceAll error:', e);
    }
  }

  async function loadStats(fiatSym) {
    try {
      setLoadingStats(true);
      const resp = await fetch('https://api.coingecko.com/api/v3/coins/dogecoin?market_data=true');
      setLoadingStats(false);
      if (!resp.ok) {
        console.warn('Coingecko Stats error', resp.status);
        return;
      }
      const data = await resp.json();
      const fiatSymLower = fiatSym.toLowerCase();
      const priceFiat = data.market_data.current_price[fiatSymLower] ?? 0;
      const marketCapFiat = data.market_data.market_cap[fiatSymLower] ?? 0;
      const volumeFiat = data.market_data.total_volume[fiatSymLower] ?? 0;
      const st = { priceFiat, marketCapFiat, volumeFiat };
      setDogeStats(st);
      localStorage.setItem('cachedDogeStats', JSON.stringify(st));
    } catch (e) {
      console.warn('fetch dogeStats error:', e);
      setLoadingStats(false);
    }
  }

  async function loadMarketData(r, fiatSym) {
    setLoading(true);
    setValues([]);
    const days = mapRangeToDays(r);
    try {
      const pricesArr = await fetchDogeMarketChart(days, fiatSym);
      if (!pricesArr || pricesArr.length < 1) {
        console.warn('Coingecko returned empty array for chart');
        setValues([]);
        setLoading(false);
        return;
      }
      const rawPrices = pricesArr.map((p) => p[1]);
      const needed = rawPrices.slice(-60);
      setValues(needed);
      setLoading(false);
      localStorage.setItem(`cachedChart_${r}_${fiatSym}`, JSON.stringify(needed));
    } catch (err) {
      console.error('Failed to fetch chart:', err);
      setLoading(false);
      const cached = localStorage.getItem(`cachedChart_${r}_${fiatSym}`);
      if (cached) {
        try {
          const arr = JSON.parse(cached);
          setValues(arr);
        } catch (e) {}
      }
    }
  }

  function mapRangeToDays(r) {
    switch (r) {
      case '24h':
        return 1;
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '1y':
        return 365;
      default:
        return 1;
    }
  }

  function applySmoothing(arr) {
    if (arr.length < 3) return arr;
    const out = [...arr];
    for (let i = 1; i < arr.length - 1; i++) {
      out[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3;
    }
    return out;
  }

  function handleResetZoom() {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }

  function handleExportCSV() {
    if (!values || values.length < 1) {
      alert('No data to export.');
      return;
    }
    const lines = [`Index,Price(${fiatCurrency})`];
    values.forEach((v, i) => {
      lines.push(`${i},${v}`);
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = csvUrl;
    link.download = `doge_${range}_${fiatCurrency}.csv`;
    link.click();
    URL.revokeObjectURL(csvUrl);
  }

  const finalData = smoothing ? applySmoothing(values) : values;
  const minVal = finalData.length ? Math.min(...finalData) : 0;
  const maxVal = finalData.length ? Math.max(...finalData) : 0;
  const sumVal = finalData.reduce((a, b) => a + b, 0);
  const avgVal = finalData.length ? sumVal / finalData.length : 0;
  const first = finalData[0] || 0;
  const last = finalData.length > 0 ? finalData[finalData.length - 1] : 0;
  const diff = last - first;
  const diffPct = first ? ((diff / first) * 100).toFixed(2) : '0';
  const minIdx = finalData.indexOf(minVal);
  const maxIdx = finalData.indexOf(maxVal);
  let annotationObj = {};
  if (highlightExtremes && finalData.length > 2) {
    annotationObj = {
      annotations: {
        minPoint: {
          type: 'point',
          xValue: minIdx,
          yValue: minVal,
          backgroundColor: 'blue',
          radius: 5,
          borderWidth: 2,
          borderColor: '#fff',
          label: {
            content: `Min: ${minVal.toFixed(5)}`,
            enabled: true,
            position: 'top'
          }
        },
        maxPoint: {
          type: 'point',
          xValue: maxIdx,
          yValue: maxVal,
          backgroundColor: 'red',
          radius: 5,
          borderWidth: 2,
          borderColor: '#fff',
          label: {
            content: `Max: ${maxVal.toFixed(5)}`,
            enabled: true,
            position: 'bottom'
          }
        }
      }
    };
  }

  return (
    <>
      <style>{`
        .balance-panel-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        @media (max-width: 768px) {
          .balance-panel-container {
            gap: 0.5rem;
            padding: 0.5rem;
          }
          .balance-card, .inline-stats, .chart-wrapper {
            padding: 0.5rem !important;
          }
          .balance-card {
            flex-direction: column; 
            align-items: flex-start;
          }
          .inline-stats {
            flex-direction: column; 
            align-items: flex-start;
          }
          .chart-wrapper {
            padding: 0.5rem;
          }
        }
        @media (max-width: 480px) {
          .balance-value {
            font-size: 1.1rem !important;
          }
          .usd-value {
            font-size: 1rem !important;
          }
        }
      `}</style>
      <div className="balance-panel-container" style={styles.container}>
        <div className="balance-card" style={styles.balanceCard}>
          <div style={styles.balanceBlock}>
            <p style={{ ...styles.labelTitle, color: theme.darkMode ? '#ccc' : '#555' }}>
              Total Balance
            </p>
            <p className="balance-value" style={{ ...styles.balanceValue, fontSize: '1.3rem', color: theme.color }}>
              {balanceDoge.toFixed(4)} <span style={{ fontSize: '0.95rem' }}>DOGE</span>
            </p>
          </div>
          <div style={styles.balanceBlock}>
            <p style={{ ...styles.labelTitle, color: theme.darkMode ? '#ccc' : '#555' }}>
              Fiat Value
            </p>
            <p className="usd-value" style={{ ...styles.usdValue, color: theme.color }}>
              {balanceFiat.toFixed(2)} {fiatCurrency}
            </p>
          </div>
          <div style={styles.balanceBlock}>
            <p style={{ ...styles.labelTitle, color: theme.darkMode ? '#ccc' : '#555' }}>
              Local Time
            </p>
            <p className="usd-value" style={{ ...styles.usdValue, color: theme.color }}>
              {localTime}
            </p>
          </div>
        </div>
        <div className="inline-stats" style={{ ...styles.inlineStatsContainer, backgroundColor: theme.panelBg, border: `1px solid ${theme.borderColor}` }}>
          <div style={{ ...styles.statItem, color: theme.color }}>
            <strong style={{ marginRight: '8px' }}>Min:</strong>
            {minVal.toFixed(5)}
          </div>
          <div style={{ ...styles.statItem, color: theme.color }}>
            <strong style={{ marginRight: '8px' }}>Max:</strong>
            {maxVal.toFixed(5)}
          </div>
          <div style={{ ...styles.statItem, color: theme.color }}>
            <strong style={{ marginRight: '8px' }}>Avg:</strong>
            {avgVal.toFixed(5)}
          </div>
          {loadingStats && (
            <div style={{ ...styles.statItem, color: theme.color }}>
              Loading stats...
            </div>
          )}
          {!loadingStats && dogeStats && (
            <>
              <div style={{ ...styles.statItem, color: theme.color }}>
                <strong style={{ marginRight: '8px' }}>Price ({fiatCurrency}):</strong>
                {dogeStats.priceFiat.toFixed(4)}
              </div>
              <div style={{ ...styles.statItem, color: theme.color }}>
                <strong style={{ marginRight: '8px' }}>M.Cap ({fiatCurrency}):</strong>
                {(dogeStats.marketCapFiat / 1e9).toFixed(2)} B
              </div>
              <div style={{ ...styles.statItem, color: theme.color }}>
                <strong style={{ marginRight: '8px' }}>Vol ({fiatCurrency}):</strong>
                {(dogeStats.volumeFiat / 1e6).toFixed(2)} M
              </div>
            </>
          )}
        </div>
        <div className="chart-wrapper" style={{ ...styles.chartWrapper, backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}>
          <div style={styles.headerRow}>
            <h4 style={{ ...styles.chartTitle, color: theme.color }}>
              Doge Price ({range})
            </h4>
            <div>
              {['24h', '7d', '30d', '1y'].map((rval) => {
                const isActive = range === rval;
                const btnStyle = {
                  ...styles.rangeBtn,
                  border: `1px solid ${theme.darkMode ? '#fff' : '#ccc'}`,
                  backgroundColor: theme.darkMode ? 'transparent' : isActive ? '#339af0' : '#f2f2f2',
                  color: theme.darkMode ? (isActive ? '#339af0' : '#fff') : isActive ? '#fff' : '#333'
                };
                return (
                  <button key={rval} style={btnStyle} onClick={() => setRange(rval)}>
                    {rval}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ ...styles.row, color: theme.color }}>
            <span style={styles.changeLabel}>
              Change: {diff >= 0 ? '+' : ''}{diff.toFixed(5)} ({diffPct}%)
            </span>
            <span style={styles.lastLabel}>
              Last: {finalData.length ? last.toFixed(5) : '0.00000'}
            </span>
          </div>
          <div style={styles.configRow}>
            <div style={styles.configItem}>
              <label style={{ color: theme.color }}>Scale: </label>
              <select
                style={{ ...styles.selectStyle, backgroundColor: 'transparent', border: `1px solid ${theme.darkMode ? '#fff' : theme.borderColor}`, color: theme.color }}
                value={scaleMode}
                onChange={(e) => setScaleMode(e.target.value)}
              >
                <option value="linear">Linear</option>
                <option value="logarithmic">Log</option>
              </select>
            </div>
            <label style={styles.configCheck}>
              <input type="checkbox" checked={smoothing} onChange={(e) => setSmoothing(e.target.checked)} />
              <span style={{ color: theme.color }}>Smoothing</span>
            </label>
            <label style={styles.configCheck}>
              <input type="checkbox" checked={highlightExtremes} onChange={(e) => setHighlightExtremes(e.target.checked)} />
              <span style={{ color: theme.color }}>Highlight Extremes</span>
            </label>
            <button
              style={{ ...styles.actionBtn, border: `1px solid ${theme.darkMode ? '#fff' : theme.borderColor}`, backgroundColor: 'transparent', color: theme.color }}
              onClick={handleExportCSV}
            >
              Export CSV
            </button>
            <button
              style={{ ...styles.actionBtn, border: `1px solid ${theme.darkMode ? '#fff' : theme.borderColor}`, backgroundColor: 'transparent', color: theme.color }}
              onClick={handleResetZoom}
            >
              Reset Zoom
            </button>
          </div>
          <div style={styles.chartContainer}>
            {loading && <div style={styles.loadingBox}>Loading data...</div>}
            {!loading && finalData.length === 0 && (
              <div style={styles.loadingBox}>No chart data (try changing range or check your internet).</div>
            )}
            {!loading && finalData.length > 0 && (
              <div style={{ width: '100%', height: '150px' }}>
                <Line
                  ref={chartRef}
                  data={{
                    labels: finalData.map((_, i) => i),
                    datasets: [
                      {
                        label: `DOGE Price in ${fiatCurrency}`,
                        data: finalData,
                        fill: true,
                        backgroundColor: 'rgba(255,153,0,0.15)',
                        borderColor: '#ff9900',
                        pointRadius: 0,
                        tension: smoothing ? 0.4 : 0
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    elements: { line: { borderWidth: 2 } },
                    interaction: { intersect: false, mode: 'index' },
                    scales: {
                      x: {
                        type: 'category',
                        ticks: { color: theme.darkMode ? '#ccc' : '#333' },
                        grid: { color: theme.darkMode ? '#555' : '#ccc' }
                      },
                      y: {
                        type: scaleMode,
                        ticks: { color: theme.darkMode ? '#ccc' : '#333' },
                        grid: { color: theme.darkMode ? '#555' : '#ccc' }
                      }
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: { intersect: false, mode: 'index' },
                      zoom: {
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
                        pan: { enabled: true, mode: 'x' }
                      },
                      annotation: annotationObj
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: { marginTop: '1rem' },
  balanceCard: { display: 'flex', justifyContent: 'space-between', padding: '0.7rem' },
  balanceBlock: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  labelTitle: { margin: 0, fontSize: '0.95rem' },
  balanceValue: { margin: 0, fontSize: '1.3rem', fontWeight: 'bold' },
  usdValue: { margin: 0, fontSize: '1.1rem', fontWeight: 'bold' },
  inlineStatsContainer: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', borderRadius: '8px', padding: '0.6rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  statItem: { fontSize: '0.9rem', display: 'flex', alignItems: 'center' },
  chartWrapper: { borderRadius: '8px', padding: '0.7rem' },
  headerRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' },
  chartTitle: { margin: 0, fontSize: '1.05rem' },
  rangeBtn: { padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '0.3rem' },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' },
  changeLabel: { fontWeight: 'bold' },
  lastLabel: { opacity: 0.85 },
  configRow: { display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.3rem', fontSize: '0.9rem', flexWrap: 'wrap' },
  configItem: { display: 'flex', gap: '0.3rem', alignItems: 'center' },
  selectStyle: { padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem', outline: 'none' },
  configCheck: { display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' },
  actionBtn: { padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' },
  chartContainer: { borderRadius: '6px', backgroundColor: 'transparent', position: 'relative' },
  loadingBox: { textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '1rem' }
};

function sortAddresses(a, b) {
  if (a.type === b.type) return a.index - b.index;
  return a.type === 'external' ? -1 : 1;
}

export { styles as getStyles };
