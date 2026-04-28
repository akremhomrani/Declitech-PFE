export type ObservationCategory = 'emotion' | 'engagement' | 'behavior';

export interface ObservationTag {
  id: string;
  label: string;
  emoji: string;
  category: ObservationCategory;
  color: string;
}

export interface Observation {
  v: 1;
  tags: string[];
  comment: string;
  updatedAt: string;
}

export const OBSERVATION_TAGS: ObservationTag[] = [
  { id: 'happy',      label: 'Happy',      emoji: '😊', category: 'emotion',    color: '#10b981' },
  { id: 'neutral',    label: 'Neutral',    emoji: '😐', category: 'emotion',    color: '#64748b' },
  { id: 'sad',        label: 'Sad',        emoji: '😔', category: 'emotion',    color: '#6366f1' },
  { id: 'angry',      label: 'Angry',      emoji: '😡', category: 'emotion',    color: '#ef4444' },
  { id: 'fearful',    label: 'Fearful',    emoji: '😨', category: 'emotion',    color: '#a855f7' },

  { id: 'focused',    label: 'Focused',    emoji: '🎯', category: 'engagement', color: '#0ea5e9' },
  { id: 'distracted', label: 'Distracted', emoji: '💤', category: 'engagement', color: '#f59e0b' },
  { id: 'helping',    label: 'Helping',    emoji: '🤝', category: 'engagement', color: '#14b8a6' },
  { id: 'asking',     label: 'Asking',     emoji: '🙋', category: 'engagement', color: '#06b6d4' },

  { id: 'quiet',      label: 'Quiet',      emoji: '🔇', category: 'behavior',   color: '#475569' },
  { id: 'working',    label: 'Working',    emoji: '💪', category: 'behavior',   color: '#16a34a' },
  { id: 'talking',    label: 'Talking',    emoji: '🗣️', category: 'behavior',   color: '#f97316' },
  { id: 'struggling', label: 'Struggling', emoji: '🚧', category: 'behavior',   color: '#dc2626' },
  { id: 'done',       label: 'Done',       emoji: '✅', category: 'behavior',   color: '#059669' },
];

export const TAG_INDEX: Record<string, ObservationTag> = OBSERVATION_TAGS.reduce(
  (acc, tag) => ({ ...acc, [tag.id]: tag }),
  {}
);

export function parseObservation(raw: string | null | undefined): Observation {
  const empty: Observation = { v: 1, tags: [], comment: '', updatedAt: '' };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1 && Array.isArray(parsed.tags)) {
      return {
        v: 1,
        tags: parsed.tags.filter((t: unknown): t is string => typeof t === 'string'),
        comment: typeof parsed.comment === 'string' ? parsed.comment : '',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
      };
    }
  } catch {
    return { ...empty, comment: raw };
  }
  return empty;
}

export function stringifyObservation(obs: Observation): string {
  return JSON.stringify(obs);
}
