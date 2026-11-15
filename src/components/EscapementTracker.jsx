import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { getEscapement, getForecasts, getSeasonDays, formatNumber } from "../services/api";
import "../styles/ToolsHub.css";
import "../styles/V4Tools.css";

const DISTRICTS = [
  { id: "naknek", name: "Naknek-Kvichak", color: "#3b82f6" },
  { id: "egegik", name: "Egegik", color: "#8b5cf6" },
  { id: "ugashik", name: "Ugashik", color: "#ec4899" },
  { id: "nushagak", name: "Nushagak", color: "#10b981" },
  { id: "togiak", name: "Togiak", color: "#f59e0b" },
];
const districtColor = (id) => DISTRICTS.find((d) => d.id === id)?.color || "#3b9ff3";

/** 1,234,567 -> "1.23 M"; 45,000 -> "45 K" */
function short(n) {
  if (n == null) return "–";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} K`;
  return String(n);
}

/** "07-01-2026" -> "Jul 1" */
function shortDate(mdY) {
  if (!mdY) return "";
  const [m, d, y] = mdY.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Bar with the ADF&G goal range shaded and the escapement as a fill. */
function GoalBar({ value, lower, upper, color }) {
  const top = upper || lower * 2;
  const max = Math.max(top * 1.15, value * 1.05, 1);
  const pct = (n) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div className="v4-goalbar" role="img" aria-label="Escapement against goal range">
      <div
        className="v4-goalbar-zone"
        style={{ left: pct(lower), width: `calc(${upper ? pct(upper) : "100%"} - ${pct(lower)})` }}
      />
      <div className="v4-goalbar-fill" style={{ width: pct(value), background: color }} />
      <div className="v4-goalbar-tick" style={{ left: pct(lower) }} />
      {upper && <div className="v4-goalbar-tick" style={{ left: pct(upper) }} />}
    </div>
  );
}

function RiverCard({ goal, series }) {
  const last = series[series.length - 1];
  const value = last?.cumulative || 0;
  const color = districtColor(goal.district);
  let status = { text: "Within goal range", cls: "v4-pill-open" };
  if (value < goal.lower) {
    status = { text: `Below goal · ${Math.round((value / goal.lower) * 100)}% of lower bound`, cls: "v4-pill-check" };
  } else if (goal.upper && value > goal.upper) {
    status = { text: "Above goal range", cls: "v4-pill-closed" };
  } else if (!goal.upper) {
    status = { text: "Above lower bound", cls: "v4-pill-open" };
  }

  return (
    <div className="v4-card v4-river" style={{ borderTopColor: color }}>
      <div className="v4-river-head">
        <h3>{goal.name}</h3>
        <span className={`v4-pill ${status.cls}`}>{status.text}</span>
      </div>
      <div className="v4-river-numbers">
        <div>
          <span className="v4-big">{short(value)}</span>
          <span className="v4-label"> escapement</span>
        </div>
        <div className="v4-dim">
          Goal {short(goal.lower)}{goal.upper ? ` – ${short(goal.upper)}` : " or more"}
        </div>
      </div>
      <GoalBar value={value} lower={goal.lower} upper={goal.upper} color={color} />
      <div className="v4-river-foot">
        <span>
          Last count <strong>{shortDate(last.date)}</strong>: +{formatNumber(last.daily)}
          {last.inRiver > 0 && <> · {formatNumber(last.inRiver)} in river</>}
        </span>
        <div className="v4-spark">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <YAxis hide domain={[0, "dataMax"]} />
              <Line type="monotone" dataKey="cumulative" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {goal.note && <p className="v4-footnote">{goal.note}</p>}
    </div>
  );
}

function ForecastRow({ name, color, actual, forecast, asOfLabel }) {
  const pct = forecast ? (actual / forecast) * 100 : 0;
  return (
    <div className="v4-fc-row">
      <div className="v4-fc-head">
        <strong>{name}</strong>
        <span>
          {actual ? `${short(actual)} of ` : "Forecast "}
          {short(forecast)}
          {actual ? <strong> · {Math.round(pct)}%</strong> : null}
        </span>
      </div>
      <div className="v4-goalbar">
        <div className="v4-goalbar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        {pct > 100 && <div className="v4-goalbar-over">+{Math.round(pct - 100)}%</div>}
      </div>
      {asOfLabel && <span className="v4-dim v4-small">{asOfLabel}</span>}
    </div>
  );
}

export default function EscapementTracker({ onBack }) {
  const [season, setSeason] = useState(null);
  const [data, setData] = useState(null);
  const [forecasts, setForecasts] = useState(null);
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getForecasts().then(setForecasts).catch(() => setForecasts({ years: {} }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDays(null);
    getEscapement(season)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        if (season === null) setSeason(d.season);
        return getSeasonDays(d.season).then((rows) => !cancelled && setDays(rows));
      })
      .catch(() => !cancelled && setError("Could not load the escapement data."));
    return () => {
      cancelled = true;
    };
  }, [season]);

  // Run to date by district = the largest "total run" in the season's saved days
  const runToDate = useMemo(() => {
    const out = { total: 0, lastDate: null };
    (days || []).forEach((day) => {
      (day.districts || []).forEach((d) => {
        if ((d.totalRun || 0) > (out[d.id] || 0)) out[d.id] = d.totalRun;
      });
      const t = day.totalRun?.totalRun || 0;
      if (t > out.total) {
        out.total = t;
        out.lastDate = day.runDate;
      }
    });
    return out;
  }, [days]);

  const forecastYears = Object.keys(forecasts?.years || {}).map(Number).sort((a, b) => b - a);
  const seasonForecast = forecasts?.years?.[season];
  const nextYear = forecastYears.find((y) => !(data?.seasons || []).includes(y));
  const hasRivers = data && Object.keys(data.rivers).length > 0;

  return (
    <div className="tools-hub-container">
      <div className="tools-hub-background"></div>
      <div className="tools-hub-content v4-content">
        <div className="tools-hub-header v4-header">
          <button className="back-button-hub" onClick={onBack}>← Back</button>
          <div className="header-text-section">
            <h1 className="tools-hub-title">Escapement & Forecast</h1>
            <p className="tools-hub-subtitle">
              River escapement against the ADF&G goal ranges, and the run against the preseason forecast.
            </p>
          </div>
        </div>

        {data && (
          <div className="v4-chips">
            {data.seasons.map((s) => (
              <button key={s} className={`v4-chip ${season === s ? "active" : ""}`} onClick={() => setSeason(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <div className="v4-notice v4-notice-error">{error}</div>}

        {/* Run vs forecast */}
        <h2 className="v4-section-title">Run against the preseason forecast · {season}</h2>
        {seasonForecast ? (
          <div className="v4-card">
            <ForecastRow
              name="Bristol Bay (inshore run)"
              color="linear-gradient(90deg, #3b9ff3, #f4a460)"
              actual={runToDate.total}
              forecast={seasonForecast.baywide.inshoreRun * 1e6}
              asOfLabel={runToDate.lastDate ? `Run through ${shortDate(runToDate.lastDate)}` : null}
            />
            {DISTRICTS.map((d) => (
              <ForecastRow
                key={d.id}
                name={d.name}
                color={d.color}
                actual={runToDate[d.id] || 0}
                forecast={seasonForecast.districts[d.id].inshoreRun * 1e6}
              />
            ))}
            <p className="v4-footnote">
              Forecast harvest {seasonForecast.baywide.harvest} M · forecast escapement {seasonForecast.baywide.escapement} M ·{" "}
              <a href={seasonForecast.sourceUrl} target="_blank" rel="noreferrer">ADF&G forecast PDF ↗</a>
            </p>
          </div>
        ) : (
          <div className="v4-card v4-empty">
            <p className="v4-dim">No forecast saved for {season}. Forecasts are saved for {forecastYears.join(", ") || "no years"}.</p>
          </div>
        )}

        {nextYear && (
          <>
            <h2 className="v4-section-title">Next season · {nextYear} forecast</h2>
            <div className="v4-card">
              <ForecastRow
                name="Bristol Bay (inshore run)"
                color="linear-gradient(90deg, #3b9ff3, #f4a460)"
                actual={0}
                forecast={forecasts.years[nextYear].baywide.inshoreRun * 1e6}
              />
              <div className="v4-fc-table">
                {DISTRICTS.map((d) => {
                  const f = forecasts.years[nextYear].districts[d.id];
                  return (
                    <div key={d.id} className="v4-fc-cell" style={{ borderLeftColor: d.color }}>
                      <strong>{d.name}</strong>
                      <span>Run {f.inshoreRun} M</span>
                      <span className="v4-dim">Harvest {f.harvest} M · Esc. {f.escapement} M</span>
                    </div>
                  );
                })}
              </div>
              <p className="v4-footnote">
                <a href={forecasts.years[nextYear].sourceUrl} target="_blank" rel="noreferrer">ADF&G {nextYear} forecast PDF ↗</a>
              </p>
            </div>
          </>
        )}

        {/* Escapement vs goal */}
        <h2 className="v4-section-title">Escapement against goal · {season}</h2>
        {data && !hasRivers && (
          <div className="v4-card v4-empty">
            <h3>No river data saved for {season}</h3>
            <p className="v4-dim">
              Run the backfill one time to load it: on GitHub open Actions → “Update fishery data” → Run workflow → backfill.
            </p>
          </div>
        )}
        {hasRivers && (
          <div className="v4-grid">
            {data.goals.rivers
              .filter((g) => data.rivers[g.name]?.length)
              .map((g) => (
                <RiverCard key={g.name} goal={g} series={data.rivers[g.name]} />
              ))}
          </div>
        )}

        <p className="v4-footnote">
          Sources: ADF&G daily run summary, escapement goal ranges, and sockeye forecast. Goal ranges are for the full season.
        </p>
      </div>
    </div>
  );
}
