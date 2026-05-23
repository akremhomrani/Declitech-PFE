import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { ThemeService } from '../../services/theme.service';
import { EmotionReport } from '../../models/emotion-report.model';
import {
  CATEGORY_INDEX,
  Observation,
  ObservationCategory,
  ObservationCategoryMeta,
  ObservationTag,
  OBSERVATION_CATEGORIES,
  OBSERVATION_TAGS,
  REQUIRED_TAG_COUNT,
  SCORE_DEFAULT,
  SCORE_MAX,
  SCORE_MIN,
  SCORE_STEP,
  TAG_INDEX,
  clampScore,
  parseObservation,
  stringifyObservation
} from '../../models/observation.model';

interface StudentRow {
  report: EmotionReport;
  observation: Observation;
}

@Component({
  selector: 'app-teacher-observation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './teacher-observation.component.html',
  styleUrls: ['./teacher-observation.component.css']
})
export class TeacherObservationComponent implements OnInit, OnDestroy {
  rows: StudentRow[] = [];
  sessionCode = '';
  sessionTitle = '';
  annotatedCount = 0;
  elapsedTime = '00:00';
  isRefreshing = false;

  searchQuery = '';

  readonly isPhone = /android|iphone|ipod|ipad|mobile|blackberry|opera mini|iemobile|webos/i
    .test(navigator.userAgent);

  selectedRow: StudentRow | null = null;
  draftTags: string[] = [];
  draftScore: number = SCORE_DEFAULT;
  draftComment = '';
  saving = false;
  saveMessage = '';
  activeCategory: ObservationCategory | null = null;

  @ViewChild('scoreSlider') scoreSliderRef?: ElementRef<HTMLDivElement>;

  readonly allTags: ObservationTag[] = OBSERVATION_TAGS;
  readonly tagIndex = TAG_INDEX;
  readonly categories: ObservationCategoryMeta[] = OBSERVATION_CATEGORIES;
  readonly categoryIndex = CATEGORY_INDEX;
  readonly requiredTagCount = REQUIRED_TAG_COUNT;
  readonly scoreSteps: number[] = TeacherObservationComponent.buildScoreSteps();
  readonly scoreMin = SCORE_MIN;
  readonly scoreMax = SCORE_MAX;
  scoreDragging = false;
  private moveHandler?: (e: MouseEvent | TouchEvent) => void;
  private endHandler?: () => void;

  private refreshSub?: Subscription;
  private sessionSub?: Subscription;
  private timerInterval?: ReturnType<typeof setInterval>;
  private readonly REFRESH_MS = 5_000;

  constructor(
    private readonly emotionService: EmotionService,
    private readonly sessionService: SessionService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    readonly theme: ThemeService
  ) {}

  toggleTheme(): void {
    this.theme.toggle();
  }

  ngOnInit(): void {
    const queryCode = (this.route.snapshot.queryParamMap.get('code') || '').trim();
    if (queryCode) {
      this.sessionService.joinByCode(queryCode);
    }

    this.sessionSub = this.sessionService.sessionData$.subscribe((session) => {
      this.sessionCode = session?.code || '';
      this.sessionTitle = session?.title || '';
      if (session?.startTime) {
        this.startTimer(new Date(session.startTime));
      } else {
        this.stopTimer();
        this.elapsedTime = '00:00';
      }
      this.loadStudents();
    });

    this.refreshSub = interval(this.REFRESH_MS)
      .pipe(switchMap(() => {
        if (!this.sessionCode) return [];
        this.flashRefresh();
        return this.emotionService.getReportsBySessionCode(this.sessionCode);
      }))
      .subscribe({
        next: (reports) => this.applyReports(reports as EmotionReport[]),
        error: () => {}
      });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.sessionSub?.unsubscribe();
    this.stopTimer();
    this.detachSliderListeners();
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  openStudent(row: StudentRow): void {
    this.selectedRow = row;
    this.draftTags = [...row.observation.tags];
    this.draftScore = clampScore(row.observation.score);
    this.draftComment = row.observation.comment || '';
    this.saveMessage = '';
    this.activeCategory = null;
  }

  closeSheet(): void {
    this.selectedRow = null;
    this.draftTags = [];
    this.draftScore = SCORE_DEFAULT;
    this.draftComment = '';
    this.saveMessage = '';
    this.activeCategory = null;
  }

  openCategory(catId: ObservationCategory): void {
    this.activeCategory = catId;
  }

  backToCategories(): void {
    this.activeCategory = null;
  }

  toggleTag(tagId: string): void {
    const already = this.draftTags.includes(tagId);
    if (already) {
      this.draftTags = this.draftTags.filter((t) => t !== tagId);
      return;
    }
    if (this.draftTags.length >= this.requiredTagCount) {
      this.saveMessage = 'OBSERVATION.MAX_REACHED';
      return;
    }
    this.draftTags = [...this.draftTags, tagId];
    if (this.saveMessage === 'OBSERVATION.MAX_REACHED') {
      this.saveMessage = '';
    }
  }

  isSelected(tagId: string): boolean {
    return this.draftTags.includes(tagId);
  }

  removeDraftTag(tagId: string): void {
    this.draftTags = this.draftTags.filter((t) => t !== tagId);
    if (this.saveMessage === 'OBSERVATION.MAX_REACHED') {
      this.saveMessage = '';
    }
  }

  setScore(value: number): void {
    this.draftScore = clampScore(value);
  }

  get scorePct(): number {
    return ((this.draftScore - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;
  }

  onSliderClick(event: MouseEvent): void {
    if (this.scoreDragging) return;
    this.applySliderEvent(event);
  }

  onSliderStart(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.scoreDragging = true;
    this.applySliderEvent(event);
    this.moveHandler = (e) => this.applySliderEvent(e);
    this.endHandler = () => {
      this.scoreDragging = false;
      this.detachSliderListeners();
    };
    window.addEventListener('mousemove', this.moveHandler as EventListener);
    window.addEventListener('touchmove', this.moveHandler as EventListener);
    window.addEventListener('mouseup', this.endHandler);
    window.addEventListener('touchend', this.endHandler);
    window.addEventListener('touchcancel', this.endHandler);
  }

  private applySliderEvent(event: MouseEvent | TouchEvent): void {
    const host = this.scoreSliderRef?.nativeElement;
    if (!host) return;
    const track = host.querySelector<HTMLElement>('.score-slider-track');
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clientX = event instanceof MouseEvent
      ? event.clientX
      : event.touches[0]?.clientX ?? event.changedTouches[0]?.clientX ?? 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    this.draftScore = clampScore(SCORE_MIN + ratio * (SCORE_MAX - SCORE_MIN));
  }

  private detachSliderListeners(): void {
    if (this.moveHandler) {
      window.removeEventListener('mousemove', this.moveHandler as EventListener);
      window.removeEventListener('touchmove', this.moveHandler as EventListener);
      this.moveHandler = undefined;
    }
    if (this.endHandler) {
      window.removeEventListener('mouseup', this.endHandler);
      window.removeEventListener('touchend', this.endHandler);
      window.removeEventListener('touchcancel', this.endHandler);
      this.endHandler = undefined;
    }
  }

  selectedCountInCategory(catId: ObservationCategory): number {
    return this.draftTags.filter((id) => this.tagIndex[id]?.category === catId).length;
  }

  get isComplete(): boolean {
    return this.draftTags.length === this.requiredTagCount;
  }

  save(): void {
    const row = this.selectedRow;
    if (!row || !row.report.id) return;

    if (!this.isComplete) {
      this.saveMessage = 'OBSERVATION.NEED_FIVE';
      return;
    }

    this.saving = true;
    this.saveMessage = '';

    const obs: Observation = {
      v: 2,
      tags: [...this.draftTags],
      score: clampScore(this.draftScore),
      comment: this.draftComment.trim(),
      updatedAt: new Date().toISOString()
    };

    this.emotionService.updateInstructorNote(row.report.id, stringifyObservation(obs)).subscribe({
      next: () => {
        row.observation = obs;
        row.report.instructorNote = stringifyObservation(obs);
        this.saving = false;
        this.saveMessage = 'OBSERVATION.SAVED';
        setTimeout(() => this.closeSheet(), 600);
      },
      error: () => {
        this.saving = false;
        this.saveMessage = 'OBSERVATION.SAVE_FAILED';
      }
    });
  }

  tagsByCategory(category: ObservationCategory): ObservationTag[] {
    return this.allTags.filter((t) => t.category === category);
  }

  scoreColor(value: number): string {
    if (value >= 80) return '#10b981';
    if (value >= 60) return '#06b6d4';
    if (value >= 40) return '#f59e0b';
    return '#ef4444';
  }

  getDominantEmotion(report: EmotionReport): string {
    return report.dominantEmotion || 'Neutral';
  }

  getEmotionEmoji(emotion: string | undefined): string {
    const map: Record<string, string> = {
      happy: '😊', neutral: '😐', sad: '😔',
      angry: '😡', fear: '😨', surprise: '😲', disgust: '🤢'
    };
    return map[emotion || ''] || '🙂';
  }

  trackByIdentity(_: number, row: StudentRow): string {
    return row.report.studentLoginIdentity;
  }

  get filteredRows(): StudentRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return [];
    return this.rows.filter(r => r.report.studentLoginIdentity.toLowerCase().includes(q));
  }

  get recentlyObserved(): StudentRow[] {
    return this.rows
      .filter(r => r.observation.tags.length > 0 || r.observation.comment)
      .slice(0, 6);
  }

  pickFromRecent(row: StudentRow): void {
    this.searchQuery = row.report.studentLoginIdentity;
    this.openStudent(row);
  }

  studentInitial(row: StudentRow): string {
    const name = row.report.studentLoginIdentity || '?';
    return name.trim().charAt(0).toUpperCase();
  }

  trackByTagId(_: number, tag: ObservationTag): string {
    return tag.id;
  }

  trackBySelected(_: number, tagId: string): string {
    return tagId;
  }

  trackByCategoryId(_: number, cat: ObservationCategoryMeta): string {
    return cat.id;
  }

  trackByScore(_: number, value: number): number {
    return value;
  }

  private static buildScoreSteps(): number[] {
    const steps: number[] = [];
    for (let v = SCORE_MIN; v <= SCORE_MAX; v += SCORE_STEP) steps.push(v);
    return steps;
  }


  private startTimer(start: Date): void {
    this.stopTimer();
    const tick = () => {
      const total = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
      const mm = Math.floor(total / 60).toString().padStart(2, '0');
      const ss = (total % 60).toString().padStart(2, '0');
      this.elapsedTime = `${mm}:${ss}`;
    };
    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  private flashRefresh(): void {
    this.isRefreshing = true;
    setTimeout(() => (this.isRefreshing = false), 1200);
  }

  private loadStudents(): void {
    if (!this.sessionCode) {
      this.rows = [];
      this.annotatedCount = 0;
      return;
    }
    this.emotionService.getReportsBySessionCode(this.sessionCode).subscribe({
      next: (reports) => this.applyReports(reports),
      error: () => {}
    });
  }

  private applyReports(reports: EmotionReport[]): void {
    const next: StudentRow[] = reports.map((r) => {
      const existing = this.rows.find((row) => row.report.studentLoginIdentity === r.studentLoginIdentity);
      const isOpen = this.selectedRow?.report.studentLoginIdentity === r.studentLoginIdentity;
      const observation = isOpen && existing
        ? existing.observation
        : parseObservation(r.instructorNote);
      return { report: r, observation };
    });
    this.rows = next;
    this.annotatedCount = next.filter((r) => r.observation.tags.length > 0 || r.observation.comment).length;
    const selected = this.selectedRow;
    if (selected) {
      const fresh = next.find((row) => row.report.studentLoginIdentity === selected.report.studentLoginIdentity);
      if (fresh) this.selectedRow = fresh;
    }
  }
}
