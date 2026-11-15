import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { getRegistrations, getSeasonDays, formatAkTime, formatNumber } from "../services/api";
import { DISTRICTS, districtName, districtColor, isoShort } from "../services/districts";
import "../styles/ToolsHub.css";
import "../styles/V4Tools.css";

/** "2026-07-01T12:00" -> "07-01-2026" (the run summary date format) */
const toMdy = (iso) => `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}`;

/**
 * Join each boat count with the district catch of the same day.
 * Catch per boat = district catch (all gear) / registered drift vessels. An estimate.
 */
function buildRows(series, days) {
  const catchByDay = {};
  (days || []).forEach((d) => {
    catchByDay[d.runDate] = Object.fromEntries((d.districts || []).map((x) => [x.id, x]));
  });
  const prev = {};
  return series.map((r) => {
    const day = r.issued.slice(0, 10);
    const dist = catchByDay[toMdy(r.issued)]?.[r.district];
    const before = prev[r.district];
    prev[r.district] = r;
    return {
      ...r,
      day,
      change: before && r.vessels != null && before.vessels != null ? r.vessels - before.vessels : null,
      catchDaily: dist ? dist.catchDaily : null,
      catchPerBoat: dist && dist.catchDaily > 0 && r.vessels ? Math.round(dist.catchDaily / r.vessels) : null,
    };
  });
}

/** One row per date, one column per district (for a multi-line chart). */
function pivot(rows, key) {
  const byDay = {};
  rows.forEach((r) => {
    if (r[key] == null) return;
    (byDay[r.day] ||= { day: r.day })[r.district] = r[key];
  });
  return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
}

function FleetTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="v4-tooltip">
      <strong>{isoShort(label)}</strong>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {districtName(p.dataKey)}: {formatNumber(p.value)} {unit}
        </div>
      ))}
    </div>
  );
}

function DistrictLines({ data, unit }) {
  const present = DISTRICTS.filter((d) => data.some((r) => r[d.id] != null));
  return (
    <div className="v4-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={isoShort} tick={{ fill: "#a9a9a5", fontSize: 11 }} minTickGap={20} />
          <YAxis tick={{ fill: "#a9a9a5", fontSize: 11 }} />
          <Tooltip content={<FleetTooltip unit={unit} />} />
          <Legend formatter={(v) => districtName(v)} wrapperStyle={{ fontSize: 12 }} />
          {present.map((d) => (
            <Line
              key={d.id}
              dataKey={d.id}
              stroke={d.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FleetTracker({ onBack }) {
  const [year, setYear] = useState(null);
  const [reg, setReg] = useState(null);
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getRegistrations(year)
      .then((r) => {
        if (cancelled) return;
        setReg(r);
        setError(null);
        if (year === null) setYear(r.year);
        return getSeasonDays(r.year).then((d) => !cancelled && setDays(d)).catch(() => !cancelled && setDays([]));
      })
      .catch(() => !cancelled && setError("Could not load the boat counts."));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const rows = useMemo(() => buildRows(reg?.series || [], days), [reg, days]);
  const latest = useMemo(() => {
    const out = {};
    rows.forEach((r) => (out[r.district] = r));
    return out;
  }, [rows]);
  const totalLatest = Object.values(latest).reduce((s, r) => s + (r.vessels || 0), 0);
  const boats = pivot(rows, "vessels");
  const perBoat = pivot(rows, "catchPerBoat");

  return (
    <div className="tools-hub-container">
      <div className="tools-hub-background"></div>
      <div className="tools-hub-content v4-content">
        <div className="tools-hub-header v4-header">
          <button className="back-button-hub" onClick={onBack}>← Back</button>
          <div className="header-text-section">
            <h1 className="tools-hub-title">Fleet</h1>
            <p className="tools-hub-subtitle">
              Drift boats registered in each district, from the ADF&G announcements, and the catch per boat.
            </p>
          </div>
        </div>

        {reg && reg.years.length > 1 && (
          <div className="v4-chips">
            {reg.years.map((y) => (
              <button key={y} className={`v4-chip ${year === y ? "active" : ""}`} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
        {error && <div className="v4-notice v4-notice-error">{error}</div>}

        <div className="v4-notice">
          Boat counts are not daily. ADF&G gives them in some announcements only: the Westside office for
          Nushagak, the Eastside office for one district at a time.
        </div>

        {reg && rows.length === 0 && (
          <div className="v4-card v4-empty">
            <h3>No boat counts for {reg.year}</h3>
            <p className="v4-dim">The announcements give boat counts from about late June.</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <h2 className="v4-section-title">Latest count by district</h2>
            <div className="v4-card v4-table-wrap">
              <table className="v4-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Boats</th>
                    <th>Share</th>
                    <th>Change</th>
                    <th>48 h</th>
                  </tr>
                </thead>
                <tbody>
                  {DISTRICTS.filter((d) => latest[d.id]).map((d) => {
                    const r = latest[d.id];
                    return (
                      <tr key={d.id}>
                        <td style={{ borderLeft: `4px solid ${d.color}` }}>
                          <strong>{d.name}</strong>
                          <div className="v4-dim v4-small">
                            <a href={r.sourceUrl} target="_blank" rel="noreferrer">{formatAkTime(r.issued)} ↗</a>
                          </div>
                        </td>
                        <td>
                          {formatNumber(r.vessels)}
                          {r.permits ? <div className="v4-dim v4-small">{formatNumber(r.permits)} permits</div> : null}
                        </td>
                        <td>{totalLatest ? `${Math.round((r.vessels / totalLatest) * 100)}%` : "–"}</td>
                        <td>{r.change == null ? "–" : r.change > 0 ? `+${r.change}` : r.change}</td>
                        <td>{r.vesselsIn48h ?? "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="v4-footnote">
                Each district shows its own newest count, so the dates can differ. "Share" is of the districts in
                this table only. "Change" is from the count before it in the same district.
              </p>
            </div>

            <h2 className="v4-section-title">Boats by date · {reg.year}</h2>
            <div className="v4-card">
              <DistrictLines data={boats} unit="boats" />
            </div>

            <h2 className="v4-section-title">Catch per boat · estimate</h2>
            {perBoat.length > 0 ? (
              <div className="v4-card">
                <DistrictLines data={perBoat} unit="fish / boat" />
                <p className="v4-footnote">
                  District sockeye catch for the day (all gear, from the ADF&G run summary) divided by the drift
                  boats in the announcement of that day. The catch includes set net fish, and not every
                  registered boat fishes each day, so this number is too high for drift boats. Use it to compare
                  districts and days, not as one boat's catch.
                </p>
              </div>
            ) : (
              <div className="v4-card v4-empty">
                <p className="v4-dim">No run summary days match the boat count dates for {reg.year}.</p>
              </div>
            )}
          </>
        )}

        <p className="v4-footnote">
          Source: ADF&G Bristol Bay announcements. The daily registration table on the ADF&G run summary page is
          added in June 2027, when the season opens again.
        </p>
      </div>
    </div>
  );
}
