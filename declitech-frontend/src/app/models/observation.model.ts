export type ObservationCategory =
  | 'difficultes'
  | 'participation'
  | 'autonomie'
  | 'comportement'
  | 'collaboration'
  | 'creativite';

export interface ObservationTag {
  id: string;
  label: string;
  emoji: string;
  category: ObservationCategory;
  color: string;
}

export interface ObservationCategoryMeta {
  id: ObservationCategory;
  label: string;
  emoji: string;
  color: string;
  index: number;
}

export interface Observation {
  v: 2;
  tags: string[];
  score: number;
  comment: string;
  updatedAt: string;
}

export const REQUIRED_TAG_COUNT = 5;
export const SCORE_MIN = 10;
export const SCORE_MAX = 100;
export const SCORE_STEP = 10;
export const SCORE_DEFAULT = 70;

export const OBSERVATION_CATEGORIES: ObservationCategoryMeta[] = [
  { id: 'difficultes',   label: 'Difficultés',   emoji: '🚧', color: '#ef4444', index: 1 },
  { id: 'participation', label: 'Participation', emoji: '🙋', color: '#06b6d4', index: 2 },
  { id: 'autonomie',     label: 'Autonomie',     emoji: '🎯', color: '#3b82f6', index: 3 },
  { id: 'comportement',  label: 'Comportement',  emoji: '🌟', color: '#a855f7', index: 4 },
  { id: 'collaboration', label: 'Collaboration', emoji: '🤝', color: '#10b981', index: 5 },
  { id: 'creativite',    label: 'Créativité',    emoji: '💡', color: '#f59e0b', index: 6 }
];

export const CATEGORY_INDEX: Record<ObservationCategory, ObservationCategoryMeta> =
  OBSERVATION_CATEGORIES.reduce(
    (acc, cat) => ({ ...acc, [cat.id]: cat }),
    {} as Record<ObservationCategory, ObservationCategoryMeta>
  );

const DIFFICULTES_LABELS = [
  'Plus de pratique',
  'Compréhension difficile',
  'Manque de confiance',
  'Aide individuelle',
  'Logique difficile',
  'Découragement rapide',
  'Rythme difficile',
  'Besoin de révision',
  'Compréhension partielle',
  'Pratique nécessaire'
];

const PARTICIPATION_LABELS = [
  'Participation active',
  'Très motivé',
  'Questions pertinentes',
  'Suit consignes',
  'Travail sérieux',
  'Montre intérêt',
  'Bonne participation',
  'Forte implication',
  'Prend initiatives',
  'Reste attentif'
];

const AUTONOMIE_LABELS = [
  'Bonne concentration',
  'Travail autonome',
  'Besoin encouragement',
  'Moments distraits',
  'Concentration difficile',
  'Tâches terminées',
  'Bonne gestion',
  'Étapes respectées',
  'Besoin assistance',
  'Autonomie progressive'
];

const COMPORTEMENT_LABELS = [
  'Comportement exemplaire',
  'Respectueux',
  'Poli et calme',
  'Bonne attitude',
  'Respect des règles',
  'Séance perturbée',
  'Comportement à améliorer',
  'Élève agité',
  'Écoute attentive',
  'Bonne coopération'
];

const COLLABORATION_LABELS = [
  'Bonne collaboration',
  'Aide camarades',
  'Bonne communication',
  'Travail en groupe',
  'Encourage autres',
  'Partage idées',
  'Difficulté équipe',
  'Respect des avis',
  'Participation collective',
  'Esprit d’équipe'
];

const CREATIVITE_LABELS = [
  'Esprit créatif',
  'Solutions rapides',
  'Bonne logique',
  'Très curieux',
  'Esprit analytique',
  'Idées originales',
  'Compréhension rapide',
  'Bonne réflexion',
  'Progression programmation',
  'Bon raisonnement'
];

function buildTags(
  category: ObservationCategory,
  prefix: string,
  emoji: string,
  color: string,
  labels: string[]
): ObservationTag[] {
  return labels.map((label, idx) => ({
    id: `${prefix}_${(idx + 1).toString().padStart(2, '0')}`,
    label,
    emoji,
    category,
    color
  }));
}

export const OBSERVATION_TAGS: ObservationTag[] = [
  ...buildTags('difficultes',   'dif', '🚧', '#ef4444', DIFFICULTES_LABELS),
  ...buildTags('participation', 'par', '🙋', '#06b6d4', PARTICIPATION_LABELS),
  ...buildTags('autonomie',     'aut', '🎯', '#3b82f6', AUTONOMIE_LABELS),
  ...buildTags('comportement',  'com', '🌟', '#a855f7', COMPORTEMENT_LABELS),
  ...buildTags('collaboration', 'col', '🤝', '#10b981', COLLABORATION_LABELS),
  ...buildTags('creativite',    'cre', '💡', '#f59e0b', CREATIVITE_LABELS)
];

export const TAG_INDEX: Record<string, ObservationTag> = OBSERVATION_TAGS.reduce(
  (acc, tag) => ({ ...acc, [tag.id]: tag }),
  {} as Record<string, ObservationTag>
);

export function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return SCORE_DEFAULT;
  if (n < SCORE_MIN) return SCORE_MIN;
  if (n > SCORE_MAX) return SCORE_MAX;
  return Math.round(n / SCORE_STEP) * SCORE_STEP;
}

export function emptyObservation(): Observation {
  return { v: 2, tags: [], score: SCORE_DEFAULT, comment: '', updatedAt: '' };
}

export function parseObservation(raw: string | null | undefined): Observation {
  if (!raw) return emptyObservation();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tags)) {
      const knownTags = parsed.tags.filter(
        (t: unknown): t is string => typeof t === 'string' && !!TAG_INDEX[t]
      );
      return {
        v: 2,
        tags: knownTags,
        score: clampScore(parsed.score),
        comment: typeof parsed.comment === 'string' ? parsed.comment : '',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
      };
    }
  } catch {
    return { ...emptyObservation(), comment: raw };
  }
  return emptyObservation();
}

export function stringifyObservation(obs: Observation): string {
  return JSON.stringify(obs);
}
