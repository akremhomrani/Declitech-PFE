import { Component, OnDestroy, OnInit } from '@angular/core';
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
  Observation,
  ObservationCategory,
  ObservationTag,
  OBSERVATION_TAGS,
  TAG_INDEX,
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

  selectedRow: StudentRow | null = null;
  draftTags: string[] = [];
  draftComment = '';
  saving = false;
  saveMessage = '';

  readonly allTags: ObservationTag[] = OBSERVATION_TAGS;
  readonly tagIndex = TAG_INDEX;
  readonly categories: { id: ObservationCategory; label: string; index: number }[] = [
    { id: 'emotion',    label: 'EMOTION',    index: 1 },
    { id: 'engagement', label: 'ENGAGEMENT', index: 2 },
    { id: 'behavior',   label: 'BEHAVIOR',   index: 3 }
  ];

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
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  openStudent(row: StudentRow): void {
    this.selectedRow = row;
    this.draftTags = [...row.observation.tags];
    this.draftComment = row.observation.comment || '';
    this.saveMessage = '';
  }

  closeSheet(): void {
    this.selectedRow = null;
    this.draftTags = [];
    this.draftComment = '';
    this.saveMessage = '';
  }

  toggleTag(tagId: string): void {
    const idx = this.draftTags.indexOf(tagId);
    if (idx >= 0) this.draftTags.splice(idx, 1);
    else this.draftTags.push(tagId);
  }

  isSelected(tagId: string): boolean {
    return this.draftTags.includes(tagId);
  }

  removeDraftTag(tagId: string): void {
    this.draftTags = this.draftTags.filter((t) => t !== tagId);
  }

  save(): void {
    const row = this.selectedRow;
    if (!row || !row.report.id) return;

    this.saving = true;
    this.saveMessage = '';

    const obs: Observation = {
      v: 1,
      tags: [...this.draftTags],
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

  trackByTagId(_: number, tag: ObservationTag): string {
    return tag.id;
  }

  trackBySelected(_: number, tagId: string): string {
    return tagId;
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
      const observation = isOpen
        ? existing!.observation
        : parseObservation(r.instructorNote);
      return { report: r, observation };
    });
    this.rows = next;
    this.annotatedCount = next.filter((r) => r.observation.tags.length > 0 || r.observation.comment).length;
    if (this.selectedRow) {
      const fresh = next.find((row) => row.report.studentLoginIdentity === this.selectedRow!.report.studentLoginIdentity);
      if (fresh) this.selectedRow = fresh;
    }
  }
}
