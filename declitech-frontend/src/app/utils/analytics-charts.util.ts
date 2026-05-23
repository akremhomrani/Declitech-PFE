import { SessionHistory } from '../models/session';
import { Module } from '../models/module.model';

export interface MonthBar {
  label: string;
  count: number;
  heightPct: number;
  animatedPct: number;
  delay: number;
}

export interface StatusSlice {
  label: string;
  count: number;
  pct: number;
  color: string;
  bg: string;
  text: string;
}

export interface ModuleStat {
  id: number | null;
  name: string;
  count: number;
  animatedWidth: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_BARS_COUNT = 6;
const MAX_MODULE_STATS = 6;

export function buildStatusSlices(sessions: SessionHistory[]): StatusSlice[] {
  const total = sessions.length || 1;
  const counts = {
    ACTIVE: sessions.filter((x) => x.status === 'ACTIVE').length,
    ENDED: sessions.filter((x) => x.status === 'ENDED').length,
    CANCELLED: sessions.filter((x) => x.status === 'CANCELLED').length,
    EXPIRED: sessions.filter((x) => x.status === 'EXPIRED').length
  };
  const raw: StatusSlice[] = [
    { label: 'Active', count: counts.ACTIVE, pct: 0, color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { label: 'Ended', count: counts.ENDED, pct: 0, color: '#0097B2', bg: 'bg-primary/10', text: 'text-primary' },
    { label: 'Cancelled', count: counts.CANCELLED, pct: 0, color: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700' },
    { label: 'Expired', count: counts.EXPIRED, pct: 0, color: '#ef4444', bg: 'bg-red-100', text: 'text-red-700' }
  ];
  raw.forEach((r) => (r.pct = Math.round((r.count / total) * 100)));
  return raw;
}

export function buildMonthBars(sessions: SessionHistory[]): MonthBar[] {
  const map = new Map<string, number>();
  sessions.forEach((s) => {
    const d = new Date(s.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + 1);
  });

  const now = new Date();
  const bars: MonthBar[] = [];
  for (let i = MONTH_BARS_COUNT - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    bars.push({
      label: MONTH_LABELS[d.getMonth()],
      count: map.get(key) || 0,
      heightPct: 0,
      animatedPct: 0,
      delay: (MONTH_BARS_COUNT - 1 - i) * 80
    });
  }
  const max = Math.max(...bars.map((b) => b.count), 1);
  bars.forEach((b) => (b.heightPct = Math.round((b.count / max) * 100)));
  return bars;
}

export function buildModuleStats(sessions: SessionHistory[], modules: Module[]): ModuleStat[] {
  const map = new Map<number | null, number>();
  sessions.forEach((s) => {
    const key = s.moduleId ?? null;
    map.set(key, (map.get(key) || 0) + 1);
  });

  const stats: ModuleStat[] = [];
  map.forEach((count, id) => {
    const mod = id !== null ? modules.find((m) => m.id === id) : null;
    const name = mod ? mod.title : id !== null ? `Module #${id}` : 'No Module';
    stats.push({ id, name, count, animatedWidth: 0 });
  });

  stats.sort((a, b) => b.count - a.count);
  return stats.slice(0, MAX_MODULE_STATS);
}

export function buildDonutGradient(slices: StatusSlice[], revealedDeg: number): string {
  const visible = slices.filter((s) => s.count > 0);
  if (!visible.length) return 'conic-gradient(#e2e8f0 0deg 360deg)';
  const targets = visible.map((s) => (s.pct / 100) * 360);
  let deg = 0;
  const stops: string[] = [];
  for (let i = 0; i < visible.length; i++) {
    const sliceEnd = deg + targets[i];
    if (deg >= revealedDeg) break;
    const visibleEnd = Math.min(sliceEnd, revealedDeg);
    stops.push(`${visible[i].color} ${deg.toFixed(1)}deg ${visibleEnd.toFixed(1)}deg`);
    deg = sliceEnd;
  }
  if (revealedDeg < 360) stops.push(`#e2e8f0 ${revealedDeg.toFixed(1)}deg 360deg`);
  return `conic-gradient(${stops.join(', ')})`;
}
