/** Bristol Bay districts, in the order and colors the V4 screens use. */
export const DISTRICTS = [
  { id: "naknek", name: "Naknek-Kvichak", color: "#3b82f6" },
  { id: "egegik", name: "Egegik", color: "#8b5cf6" },
  { id: "ugashik", name: "Ugashik", color: "#ec4899" },
  { id: "nushagak", name: "Nushagak", color: "#10b981" },
  { id: "togiak", name: "Togiak", color: "#f59e0b" },
];

export const districtName = (id) => DISTRICTS.find((d) => d.id === id)?.name || id;
export const districtColor = (id) => DISTRICTS.find((d) => d.id === id)?.color || "#3b9ff3";

/** "2026-07-04" -> "Jul 4" (no time zone change) */
export function isoShort(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

/** "07-04-2026" -> "Jul 4" */
export function mdyShort(mdY) {
  if (!mdY) return "";
  const [m, d, y] = mdY.split("-");
  return isoShort(`${y}-${m}-${d}`);
}

/** Time since an ISO time stamp: "14 min ago", "3 h ago", "2 days ago". */
export function ago(isoTime, now = Date.now()) {
  if (!isoTime) return "never";
  const min = Math.round((now - new Date(isoTime).getTime()) / 60000);
  if (!isFinite(min)) return "";
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
