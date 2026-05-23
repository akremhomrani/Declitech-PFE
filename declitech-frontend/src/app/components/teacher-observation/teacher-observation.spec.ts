import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeacherObservationComponent } from './teacher-observation.component';
import { EmotionReport } from '../../models/emotion-report.model';
import { Observation } from '../../models/observation.model';

interface StudentRow { report: EmotionReport; observation: Observation; }

function makeRow(login: string, opts: Partial<{ tags: string[]; comment: string; emotion: string }> = {}): StudentRow {
  return {
    report: {
      id: Math.floor(Math.random() * 10_000),
      sessionCode: 'ABC123',
      sessionId: 1,
      studentLoginIdentity: login,
      dominantEmotion: opts.emotion ?? 'neutral',
      generatedAt: '2026-05-04T12:00:00Z',
      instructorNote: '',
    } as unknown as EmotionReport,
    observation: {
      v: 2,
      tags: opts.tags ?? [],
      score: 70,
      comment: opts.comment ?? '',
      updatedAt: '2026-05-04T12:00:00Z',
    },
  };
}

function makeComponent(): TeacherObservationComponent {
  const emotionService: any = { getReportsBySessionCode: vi.fn(), updateInstructorNote: vi.fn() };
  const sessionService: any = { sessionData$: { subscribe: vi.fn() }, joinByCode: vi.fn() };
  const router: any = { navigate: vi.fn(), navigateByUrl: vi.fn() };
  const route: any = { snapshot: { queryParamMap: { get: () => null } } };
  const theme: any = { isDark: () => false, toggle: vi.fn() };
  return new TeacherObservationComponent(emotionService, sessionService, router, route, theme);
}

describe('TeacherObservationComponent — search & filtering', () => {
  let comp: TeacherObservationComponent;

  beforeEach(() => {
    comp = makeComponent();
    comp.rows = [
      makeRow('alex.rivera@dev.local'),
      makeRow('maya.jones@dev.local', { tags: ['par_01'] }),
      makeRow('liam.kim@dev.local', { comment: 'works well in pairs' }),
      makeRow('zoe.chen@dev.local'),
    ];
  });

  it('returns empty list when query is blank', () => {
    comp.searchQuery = '';
    expect(comp.filteredRows).toEqual([]);
    comp.searchQuery = '   ';
    expect(comp.filteredRows).toEqual([]);
  });

  it('matches a single student case-insensitively', () => {
    comp.searchQuery = 'ALEX';
    const result = comp.filteredRows.map(r => r.report.studentLoginIdentity);
    expect(result).toEqual(['alex.rivera@dev.local']);
  });

  it('returns all matching rows for a partial substring', () => {
    comp.searchQuery = 'dev.local';
    expect(comp.filteredRows).toHaveLength(4);
  });

  it('returns no rows when nothing matches', () => {
    comp.searchQuery = 'nonexistent';
    expect(comp.filteredRows).toEqual([]);
  });
});

describe('TeacherObservationComponent — recently observed', () => {
  let comp: TeacherObservationComponent;

  beforeEach(() => {
    comp = makeComponent();
  });

  it('returns only rows that have at least one tag or a comment', () => {
    comp.rows = [
      makeRow('a@dev'),                                  // no tags, no comment → skipped
      makeRow('b@dev', { tags: ['par_01'] }),           // included
      makeRow('c@dev', { comment: 'great progress' }),   // included
      makeRow('d@dev'),                                  // skipped
    ];
    const recent = comp.recentlyObserved.map(r => r.report.studentLoginIdentity);
    expect(recent).toEqual(['b@dev', 'c@dev']);
  });

  it('caps the list at 6 entries', () => {
    comp.rows = Array.from({ length: 10 }, (_, i) => makeRow(`s${i}@dev`, { tags: ['par_01'] }));
    expect(comp.recentlyObserved).toHaveLength(6);
  });

  it('returns an empty list when no observations exist', () => {
    comp.rows = [makeRow('a@dev'), makeRow('b@dev')];
    expect(comp.recentlyObserved).toEqual([]);
  });
});

describe('TeacherObservationComponent — student initial', () => {
  let comp: TeacherObservationComponent;

  beforeEach(() => { comp = makeComponent(); });

  it('returns the uppercase first character of the login', () => {
    expect(comp.studentInitial(makeRow('alex'))).toBe('A');
    expect(comp.studentInitial(makeRow('Beatrice'))).toBe('B');
  });

  it('falls back to ? when login is empty', () => {
    const row = makeRow('');
    row.report.studentLoginIdentity = '';
    expect(comp.studentInitial(row)).toBe('?');
  });

  it('strips leading whitespace before taking the initial', () => {
    expect(comp.studentInitial(makeRow('   delta'))).toBe('D');
  });
});

describe('TeacherObservationComponent — open / pickFromRecent', () => {
  let comp: TeacherObservationComponent;

  beforeEach(() => { comp = makeComponent(); });

  it('openStudent loads the row into the editor draft', () => {
    const row = makeRow('alex', { tags: ['par_01', 'aut_02'], comment: 'on task' });
    comp.openStudent(row);
    expect(comp.selectedRow).toBe(row);
    expect(comp.draftTags).toEqual(['par_01', 'aut_02']);
    expect(comp.draftTags).not.toBe(row.observation.tags);
    expect(comp.draftComment).toBe('on task');
    expect(comp.saveMessage).toBe('');
  });

  it('closeSheet clears editor state', () => {
    const row = makeRow('alex', { tags: ['par_01'] });
    comp.openStudent(row);
    comp.closeSheet();
    expect(comp.selectedRow).toBeNull();
    expect(comp.draftTags).toEqual([]);
    expect(comp.draftComment).toBe('');
  });

  it('pickFromRecent fills the search query AND opens the editor', () => {
    const row = makeRow('maya@dev', { tags: ['par_01'] });
    comp.pickFromRecent(row);
    expect(comp.searchQuery).toBe('maya@dev');
    expect(comp.selectedRow).toBe(row);
  });
});

describe('TeacherObservationComponent — tag draft mutations', () => {
  let comp: TeacherObservationComponent;

  beforeEach(() => {
    comp = makeComponent();
    comp.openStudent(makeRow('alex'));
  });

  it('toggleTag adds when missing, removes when present', () => {
    expect(comp.isSelected('par_01')).toBe(false);
    comp.toggleTag('par_01');
    expect(comp.isSelected('par_01')).toBe(true);
    comp.toggleTag('par_01');
    expect(comp.isSelected('par_01')).toBe(false);
  });

  it('removeDraftTag removes only the named id', () => {
    comp.toggleTag('par_01');
    comp.toggleTag('aut_02');
    comp.removeDraftTag('par_01');
    expect(comp.draftTags).toEqual(['aut_02']);
  });

  it('toggleTag stops at five and surfaces a warning', () => {
    comp.toggleTag('par_01');
    comp.toggleTag('par_02');
    comp.toggleTag('par_03');
    comp.toggleTag('par_04');
    comp.toggleTag('par_05');
    expect(comp.draftTags.length).toBe(5);
    comp.toggleTag('par_06');
    expect(comp.draftTags.length).toBe(5);
    expect(comp.saveMessage).toBe('OBSERVATION.MAX_REACHED');
    expect(comp.isComplete).toBe(true);
  });

  it('isComplete is false until exactly five phrases are picked', () => {
    expect(comp.isComplete).toBe(false);
    comp.toggleTag('par_01');
    comp.toggleTag('par_02');
    comp.toggleTag('par_03');
    comp.toggleTag('par_04');
    expect(comp.isComplete).toBe(false);
    comp.toggleTag('par_05');
    expect(comp.isComplete).toBe(true);
  });
});

describe('TeacherObservationComponent — phone-only guard', () => {
  it('marks isPhone=true for an iPhone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
    const comp = makeComponent();
    expect(comp.isPhone).toBe(true);
  });

  it('marks isPhone=true for an Android user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile',
      configurable: true,
    });
    const comp = makeComponent();
    expect(comp.isPhone).toBe(true);
  });

  it('marks isPhone=false for a desktop Chrome user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      configurable: true,
    });
    const comp = makeComponent();
    expect(comp.isPhone).toBe(false);
  });
});
