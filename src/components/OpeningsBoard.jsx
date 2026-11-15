import { useEffect, useMemo, useState } from "react";
import {
  getOpenings,
  getAnnouncements,
  getAnnouncement,
  formatAkTime,
  durationBetween,
} from "../services/api";
import "../styles/ToolsHub.css";
import "../styles/V4Tools.css";

const DISTRICTS = [
  { id: "nushagak", name: "Nushagak", color: "#10b981" },
  { id: "naknek", name: "Naknek-Kvichak", color: "#3b82f6" },
  { id: "egegik", name: "Egegik", color: "#8b5cf6" },
  { id: "ugashik", name: "Ugashik", color: "#ec4899" },
  { id: "togiak", name: "Togiak", color: "#f59e0b" },
];

const KIND_LABELS = {
  eastside: "Eastside",
  westside: "Westside",
  portmoller: "Port Moller",
  forecast: "Forecast",
  outlook: "Outlook",
  summary: "Season summary",
  other: "Other",
};

const GEAR_LABELS = { drift: "Drift", set: "Set net", both: "Drift + set", all: "All gear" };

/** One gear line on a district card: OPEN until ... / CLOSED, next opening ... */
function GearStatus({ label, status, asOf }) {
  if (!status || status.state === "none") {
    return (
      <div className="v4-gear">
        <div className="v4-gear-head">
          <span className="v4-gear-label">{label}</span>
          <span className="v4-pill v4-pill-none">No announcement</span>
        </div>
      </div>
    );
  }
  const open = status.state === "open";
  const shown = open ? status.current : status.next;
  return (
    <div className="v4-gear">
      <div className="v4-gear-head">
        <span className="v4-gear-label">{label}</span>
        <span className={`v4-pill ${open ? "v4-pill-open" : "v4-pill-closed"}`}>
          {open ? "Open" : "Closed"}
        </span>
        {shown && !shown.confident && <span className="v4-pill v4-pill-check">Check source</span>}
      </div>

      {open && (
        <p className="v4-gear-line">
          {status.untilFurtherNotice || !status.until ? (
            <>Open <strong>until further notice</strong></>
          ) : (
            <>
              Closes <strong>{formatAkTime(status.until)}</strong>
              <span className="v4-dim"> (in {durationBetween(asOf, status.until)})</span>
            </>
          )}
          {status.current?.area && <span className="v4-dim"> · {status.current.area}</span>}
        </p>
      )}

      {status.next ? (
        <p className="v4-gear-line">
          {open ? "Then opens " : "Opens "}
          <strong>{formatAkTime(status.next.start)}</strong>
          <span className="v4-dim"> (in {durationBetween(asOf, status.next.start)})</span>
          {status.next.end && (
            <>
              {" "}until <strong>{formatAkTime(status.next.end)}</strong>
            </>
          )}
          {status.next.area && <span className="v4-dim"> · {status.next.area}</span>}
        </p>
      ) : (
        !open && <p className="v4-gear-line v4-dim">No next opening announced.</p>
      )}

      {shown && (
        <details className="v4-source">
          <summary>
            ADF&G text{shown.source?.number ? ` · Announcement #${shown.source.number}` : ""}, issued{" "}
            {formatAkTime(shown.source?.issued)}
          </summary>
          <blockquote>{shown.sentence}</blockquote>
          <a href={shown.source?.url} target="_blank" rel="noreferrer">Open the PDF ↗</a>
        </details>
      )}
    </div>
  );
}

function DistrictCard({ district, entry, asOf }) {
  const reg = entry?.registration;
  return (
    <div className="v4-card v4-district" style={{ borderTopColor: district.color }}>
      <h3>{district.name}</h3>
      <GearStatus label="Drift" status={entry?.drift} asOf={asOf} />
      <GearStatus label="Set net" status={entry?.set} asOf={asOf} />

      {reg && (
        <p className="v4-boats">
          🚤 <strong>{reg.vessels.toLocaleString()}</strong> boats
          {reg.permits ? <> · <strong>{reg.permits.toLocaleString()}</strong> permits</> : null}
          {reg.vesselsIn48h ? <> · {reg.vesselsIn48h.toLocaleString()} in 48 h</> : null}
          <span className="v4-dim"> (as of {formatAkTime(reg.issued, { withDay: false })})</span>
        </p>
      )}

      {entry?.periods?.length > 0 && (
        <details className="v4-source">
          <summary>All periods and notes ({entry.periods.length})</summary>
          <ul className="v4-periods">
            {entry.periods.map((p, i) => (
              <li key={i}>
                <span className="v4-period-time">
                  {p.type === "schedule"
                    ? "Schedule note"
                    : p.untilFurtherNotice
                    ? "Until further notice"
                    : p.start
                    ? `${formatAkTime(p.start)} → ${p.end ? formatAkTime(p.end) : "no end given"}`
                    : `${p.type === "close" ? "Closes" : "Open until"} ${formatAkTime(p.end)}`}
                </span>
                <span className="v4-dim"> · {GEAR_LABELS[p.gear]}{p.area ? ` · ${p.area}` : ""}</span>
                {!p.confident && <span className="v4-pill v4-pill-check">Check source</span>}
                <blockquote>{p.sentence}</blockquote>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AnnouncementRow({ item }) {
  const [text, setText] = useState(null);
  const [open, setOpen] = useState(false);

  const toggle = async () => {
    setOpen(!open);
    if (text === null) {
      try {
        setText((await getAnnouncement(item.id)).text || "(no text)");
      } catch {
        setText("Could not load the text. Open the PDF.");
      }
    }
  };

  return (
    <li className="v4-ann">
      <button className="v4-ann-head" onClick={toggle} aria-expanded={open}>
        <span className={`v4-pill v4-kind-${item.kind}`}>{KIND_LABELS[item.kind] || item.kind}</span>
        <span className="v4-ann-title">{item.title}</span>
        <span className="v4-dim v4-ann-date">{formatAkTime(item.issued, { withDay: false })}</span>
      </button>
      {open && (
        <div className="v4-ann-body">
          <p className="v4-ann-text">{text === null ? "Loading…" : text}</p>
          <a href={item.url} target="_blank" rel="noreferrer">Open the PDF ↗</a>
        </div>
      )}
    </li>
  );
}

export default function OpeningsBoard({ onBack }) {
  // null = now. A link with &asOf=2026-07-01T08:00 opens the replay directly.
  const [asOf, setAsOf] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("asOf");
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fromUrl || "") ? fromUrl : null;
  });
  const [board, setBoard] = useState(null);
  const [feed, setFeed] = useState(null);
  const [kind, setKind] = useState("all");
  const [error, setError] = useState(null);

  // Status board: load, and refresh every 5 minutes when it shows "now"
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getOpenings(asOf)
        .then((data) => !cancelled && (setBoard(data), setError(null)))
        .catch(() => !cancelled && setError("Could not load the openings data."));
    load();
    const timer = asOf ? null : setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [asOf]);

  // Announcement feed for the year on the board
  const year = board?.year;
  useEffect(() => {
    if (!year) return;
    getAnnouncements(year).then(setFeed).catch(() => setFeed({ items: [] }));
  }, [year]);

  const kinds = useMemo(
    () => ["all", ...new Set((feed?.items || []).map((i) => i.kind))],
    [feed]
  );
  const items = (feed?.items || []).filter((i) => kind === "all" || i.kind === kind);
  const lastIssued = feed?.items?.find((i) => ["eastside", "westside"].includes(i.kind))?.issued;

  return (
    <div className="tools-hub-container">
      <div className="tools-hub-background"></div>
      <div className="tools-hub-content v4-content">
        <div className="tools-hub-header v4-header">
          <button className="back-button-hub" onClick={onBack}>← Back</button>
          <div className="header-text-section">
            <h1 className="tools-hub-title">Openings & Announcements</h1>
            <p className="tools-hub-subtitle">
              District status read from the ADF&G fishery announcements. All times are Alaska time.
            </p>
          </div>
        </div>

        <div className="v4-notice">
          ⚠️ This board is read by a program from ADF&G PDF files, and it can be wrong or late.
          Confirm each opening with the official announcement (VHF 07A, KDLG, or the PDF) before you fish.
        </div>

        {/* As-of bar: now, or replay a past moment */}
        <div className="v4-card v4-asof">
          <div>
            <span className="v4-label">Showing</span>
            <strong> {asOf ? formatAkTime(asOf) : `Now · ${formatAkTime(board?.asOf)}`}</strong>
            {board?.checkedAt && (
              <span className="v4-dim">
                {" "}· ADF&G list last read {new Date(board.checkedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="v4-asof-controls">
            <label className="v4-label" htmlFor="asof-input">Replay a past moment</label>
            <input
              id="asof-input"
              type="datetime-local"
              className="v4-input"
              value={asOf || ""}
              onChange={(e) => setAsOf(e.target.value || null)}
            />
            {asOf && (
              <button className="v4-btn" onClick={() => setAsOf(null)}>Back to now</button>
            )}
          </div>
        </div>

        {error && <div className="v4-notice v4-notice-error">{error}</div>}

        {board && !board.inSeason && (
          <div className="v4-card v4-empty">
            <h3>No announcements in the 10 days before this time</h3>
            <p className="v4-dim">
              The season is closed, or the data is not loaded yet. Use the replay control to see the board at a past moment.
            </p>
            {!asOf && lastIssued && (
              <button className="v4-btn" onClick={() => setAsOf(lastIssued)}>
                Go to the last announcement ({formatAkTime(lastIssued, { withDay: false })})
              </button>
            )}
          </div>
        )}

        {board && (
          <div className="v4-grid">
            {DISTRICTS.map((d) => (
              <DistrictCard key={d.id} district={d} entry={board.districts[d.id]} asOf={board.asOf} />
            ))}
          </div>
        )}

        {/* Feed */}
        <h2 className="v4-section-title">Announcement feed {year ? `· ${year}` : ""}</h2>
        {feed && feed.items.length === 0 ? (
          <div className="v4-card v4-empty">
            <h3>No announcements saved yet</h3>
            <p className="v4-dim">
              The update job fills this list. On GitHub open Actions → “Update fishery data” → Run workflow.
            </p>
          </div>
        ) : (
          <>
            <div className="v4-chips">
              {kinds.map((k) => (
                <button
                  key={k}
                  className={`v4-chip ${kind === k ? "active" : ""}`}
                  onClick={() => setKind(k)}
                >
                  {k === "all" ? "All" : KIND_LABELS[k] || k}
                </button>
              ))}
            </div>
            <ul className="v4-ann-list">
              {items.map((item) => (
                <AnnouncementRow key={item.id} item={item} />
              ))}
            </ul>
          </>
        )}

        <p className="v4-footnote">
          Source: ADF&G Division of Commercial Fisheries, Bristol Bay advisory announcements.
        </p>
      </div>
    </div>
  );
}
