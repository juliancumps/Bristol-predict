import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getPortMoller } from "../services/api";
import { DISTRICTS, districtName, districtColor, isoShort, ago } from "../services/districts";
import "../styles/ToolsHub.css";
import "../styles/V4Tools.css";

const OTHER = { id: "other", name: "Other (N. Peninsula, Kuskokwim)", color: "#6b7280" };

function periodLabel(sc) {
  if (!sc?.periodStart) return "Unknown dates";
  return sc.periodStart === sc.periodEnd
    ? isoShort(sc.periodStart)
    : `${isoShort(sc.periodStart)}–${isoShort(sc.periodEnd)}`;
}

function IndexTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="v4-tooltip">
      <strong>{isoShort(p.date)}</strong> · Update #{p.number}
      <div>Daily index: {p.dailyIndex ?? "not reported"}</div>
      <div>Season total: {p.cumulative}</div>
    </div>
  );
}

/** Shares by district, as horizontal bars, with the 90% interval of each group. */
function StockBars({ sc }) {
  const rows = [...DISTRICTS, OTHER]
    .map((d) => ({ ...d, share: sc.byDistrict[d.id] || 0, groups: sc.groups.filter((g) => g.district === d.id) }))
    .filter((r) => r.groups.length);
  const max = Math.max(...rows.map((r) => r.share), 1);
  return (
    <div className="v4-stock">
      {rows.map((r) => (
        <div key={r.id} className="v4-stock-row">
          <div className="v4-stock-head">
            <strong>{r.name}</strong>
            <span className="v4-big-sm">{r.share.toFixed(1)}%</span>
          </div>
          <div className="v4-goalbar">
            <div className="v4-goalbar-fill" style={{ width: `${(r.share / max) * 100}%`, background: r.color }} />
          </div>
          <div className="v4-dim v4-small">
            {r.groups.map((g) => `${g.group} ${g.estimate}% (${g.lower}–${g.upper})`).join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortMoller({ onBack }) {
  const [year, setYear] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [periodId, setPeriodId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getPortMoller(year)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        if (year === null) setYear(d.year);
        setPeriodId(null);
      })
      .catch(() => !cancelled && setError("Could not load the Port Moller data."));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const chartData = useMemo(() => data?.cumulativeIndex || [], [data]);
  const updates = data?.catchUpdates || [];
  const latest = [...updates].reverse().find((u) => u.dailyIndex !== null && u.dailyIndex !== undefined);
  const lastUpdate = updates[updates.length - 1];
  const stock = data?.stockComposition || [];
  const selected = stock.find((s) => s.id === periodId) || stock[stock.length - 1];
  const latestCum = chartData[chartData.length - 1];

  return (
    <div className="tools-hub-container">
      <div className="tools-hub-background"></div>
      <div className="tools-hub-content v4-content">
        <div className="tools-hub-header v4-header">
          <button className="back-button-hub" onClick={onBack}>← Back</button>
          <div className="header-text-section">
            <h1 className="tools-hub-title">Port Moller</h1>
            <p className="tools-hub-subtitle">
              The test fishery samples the run 6 to 9 days before the fish reach the districts.
            </p>
          </div>
        </div>

        {data && data.years.length > 1 && (
          <div className="v4-chips">
            {data.years.map((y) => (
              <button key={y} className={`v4-chip ${year === y ? "active" : ""}`} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}

        <div className="v4-notice">
          Preliminary data from BBSRI (catch index) and ADF&G (stock composition). BBSRI can post late, and
          the index can change.
        </div>
        {error && <div className="v4-notice v4-notice-error">{error}</div>}

        {/* Latest index */}
        {data && (
          <div className="v4-card v4-pm-top">
            {latest ? (
              <>
                <div>
                  <span className="v4-label">Daily catch index · {isoShort(latest.date)}</span>
                  <div className="v4-big">
                    {latest.indexApprox ? "~" : ""}
                    {latest.dailyIndex}
                  </div>
                </div>
                <div>
                  <span className="v4-label">Season total</span>
                  <div className="v4-big">{latestCum ? Math.round(latestCum.cumulative) : "–"}</div>
                </div>
                <div className="v4-dim v4-small v4-pm-asof">
                  Catch Update #{lastUpdate.number} ({isoShort(lastUpdate.date)})
                  {lastUpdate.indexNote ? ` · index: “${lastUpdate.indexNote}”` : ""} · data checked{" "}
                  {ago(data.checkedAt)}
                  {lastUpdate.url && (
                    <>
                      {" "}· <a href={lastUpdate.url} target="_blank" rel="noreferrer">PDF ↗</a>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="v4-empty">
                <h3>No catch updates saved for {data.year}</h3>
                <p className="v4-dim">
                  The test fishery runs from about June 10 to July 15. To load a past season, run{" "}
                  <code>npm run update:portmoller -- {data.year}</code> in the backend folder.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Chart 1: index */}
        {chartData.length > 0 && (
          <>
            <h2 className="v4-section-title">Daily catch index · {data.year}</h2>
            <div className="v4-card">
              <div className="v4-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={isoShort} tick={{ fill: "#a9a9a5", fontSize: 11 }} minTickGap={24} />
                    <YAxis yAxisId="d" tick={{ fill: "#a9a9a5", fontSize: 11 }} />
                    <YAxis yAxisId="c" orientation="right" tick={{ fill: "#f4a460", fontSize: 11 }} />
                    <Tooltip content={<IndexTooltip />} />
                    <Bar yAxisId="d" dataKey="dailyIndex" fill="#3b9ff3" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Line yAxisId="c" dataKey="cumulative" stroke="#f4a460" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="v4-footnote">
                <span className="v4-key" style={{ background: "#3b9ff3" }} /> Daily index (bars, left axis) ·{" "}
                <span className="v4-key" style={{ background: "#f4a460" }} /> Season total (line, right axis). Days
                with no index add 0.
              </p>
            </div>
          </>
        )}

        {/* Chart 2: stock composition */}
        <h2 className="v4-section-title">Stock composition</h2>
        {stock.length === 0 && data && (
          <div className="v4-card v4-empty">
            <p className="v4-dim">No ADF&G stock composition saved for {data.year}.</p>
          </div>
        )}
        {stock.length > 0 && (
          <>
            <div className="v4-chips">
              {[...stock].reverse().map((s) => (
                <button
                  key={s.id}
                  className={`v4-chip ${selected?.id === s.id ? "active" : ""}`}
                  onClick={() => setPeriodId(s.id)}
                >
                  {periodLabel(s)}
                </button>
              ))}
            </div>
            {selected && (
              <div className="v4-card">
                <div className="v4-river-head">
                  <h3>Sampled {periodLabel(selected)}</h3>
                  {!selected.complete && <span className="v4-pill v4-pill-check">Check source</span>}
                </div>
                <p className="v4-dim v4-small">
                  {selected.analyzed ?? "?"} of {selected.sampled ?? "?"} fish analyzed · share in % (90% interval
                  of each group)
                </p>
                <StockBars sc={selected} />
                <p className="v4-footnote">
                  <a href={selected.url} target="_blank" rel="noreferrer">ADF&G PDF ↗</a>
                </p>
              </div>
            )}

            {/* Arrival windows */}
            {selected?.arrival && (
              <>
                <h2 className="v4-section-title">Arrival window</h2>
                <div className="v4-card">
                  <p>
                    Fish sampled {periodLabel(selected)} reach the districts about{" "}
                    <strong>
                      {isoShort(selected.arrival.from)}–{isoShort(selected.arrival.to)}
                    </strong>
                    .
                  </p>
                  <div className="v4-arrival">
                    {DISTRICTS.filter((d) => selected.byDistrict[d.id] !== undefined)
                      .sort((a, b) => selected.byDistrict[b.id] - selected.byDistrict[a.id])
                      .map((d) => (
                        <div key={d.id} className="v4-arrival-row" style={{ borderLeftColor: districtColor(d.id) }}>
                          <span>{districtName(d.id)}</span>
                          <strong>{selected.byDistrict[d.id].toFixed(1)}%</strong>
                        </div>
                      ))}
                  </div>
                </div>
                <p className="v4-footnote">
                  Arrival = sample dates + {data.travelDays.from} to {data.travelDays.to} days. Travel time changes
                  with wind and the year; this is a rough window, not a forecast of catch.
                </p>
              </>
            )}
          </>
        )}

        {data?.source && (
          <p className="v4-footnote">
            Sources: <a href={data.source} target="_blank" rel="noreferrer">BBSRI in-season data ↗</a> · ADF&G stock
            composition announcements.
          </p>
        )}
      </div>
    </div>
  );
}
