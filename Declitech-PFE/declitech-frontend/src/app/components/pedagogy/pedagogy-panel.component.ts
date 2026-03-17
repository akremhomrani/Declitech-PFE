import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { PedagogyService } from '../../services/pedagogy.service';
import { PedagogyProgress } from '../../models/pedagogy/pedagogy-progress.model';

@Component({
    selector: 'app-pedagogy-panel',
    standalone: true,
    imports: [CommonModule, HttpClientModule],
    template: `
<div class="pedagogy-panel">
  <!-- En-tête -->
  <div class="panel-header">
    <div class="panel-title">
      <span class="icon">🎓</span>
      Suivi Pédagogique
      <span class="live-badge" [class.active]="hasData">LIVE</span>
    </div>
    <div class="ollama-status" [class.ready]="ollamaReady">
      <span class="dot"></span>
      IA {{ ollamaReady ? 'Active' : 'Hors ligne' }}
    </div>
  </div>

  <!-- Aucune donnée -->
  <div *ngIf="!hasData" class="no-data">
    <span class="no-data-icon">📚</span>
    <p>En attente des activités des élèves...</p>
    <small>L'extension détecte automatiquement CodeCombat et Code.org</small>
  </div>

  <!-- Cartes par élève -->
  <div class="student-grid" *ngIf="hasData">
    <div
      *ngFor="let p of progressList"
      class="student-card"
      [class.correct]="p.correct"
      [class.struggling]="!p.correct">

      <!-- En-tête carte étudiant -->
      <div class="card-header">
        <span class="student-name">{{ p.studentLoginIdentity || p.participantId || 'Élève' }}</span>
        <span class="site-badge">{{ getSiteIcon(p.site) }} {{ p.site }}</span>
      </div>

      <!-- Activité -->
      <div class="activity-info">
        <div class="activity-name">{{ p.activityTitle || p.levelName }}</div>
        <div class="level-info" *ngIf="p.levelNumber">
          Niveau {{ p.levelNumber }}
          <span *ngIf="p.courseName"> — {{ p.courseName }}</span>
        </div>
      </div>

      <!-- Score circulaire -->
      <div class="score-section">
        <div class="score-circle" [style.background]="getScoreGradient(p.score)">
          <div class="score-inner">
            <span class="score-value">{{ p.score }}</span>
            <span class="score-label">/100</span>
          </div>
        </div>
        <div class="status-badge" [class.correct]="p.correct" [class.incorrect]="!p.correct">
          {{ p.correct ? '✅ En progression' : '⚠️ Difficulté' }}
        </div>
      </div>

      <!-- Badge de complétion -->
      <div class="completion-badge" *ngIf="p.completed">
        🏆 Niveau complété !
      </div>

      <!-- Feedback IA -->
      <div class="feedback-section">
        <div class="feedback-label">💬 Retour IA :</div>
        <div class="feedback-text">{{ p.feedback }}</div>
      </div>
    </div>
  </div>
</div>
  `,
    styles: [`
.pedagogy-panel {
  background: #0f172a;
  border-radius: 16px;
  padding: 20px;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-title {
  font-size: 1.1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.live-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: #334155;
  color: #94a3b8;
  transition: all 0.3s;
}
.live-badge.active {
  background: #166534;
  color: #4ade80;
  animation: pulse 2s infinite;
}

.ollama-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #ef4444;
}
.ollama-status.ready { color: #4ade80; }
.dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}
.no-data-icon { font-size: 3rem; display: block; margin-bottom: 12px; }
.no-data p { margin: 8px 0; font-size: 1rem; }
.no-data small { font-size: 0.8rem; }

.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.student-card {
  background: #1e293b;
  border-radius: 12px;
  padding: 16px;
  border: 2px solid #334155;
  transition: all 0.3s;
}
.student-card.correct  { border-color: #22c55e; box-shadow: 0 0 12px rgba(34,197,94,0.15); }
.student-card.struggling { border-color: #f59e0b; box-shadow: 0 0 12px rgba(245,158,11,0.15); }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.student-name { font-weight: 700; font-size: 0.95rem; }
.site-badge {
  font-size: 0.7rem;
  background: #0f172a;
  padding: 2px 8px;
  border-radius: 999px;
  color: #94a3b8;
}

.activity-info { margin-bottom: 14px; }
.activity-name { font-weight: 600; font-size: 0.9rem; color: #cbd5e1; }
.level-info { font-size: 0.75rem; color: #64748b; margin-top: 2px; }

.score-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.score-circle {
  width: 64px; height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.score-inner {
  width: 52px; height: 52px;
  border-radius: 50%;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.score-value { font-size: 1.1rem; font-weight: 800; line-height: 1; }
.score-label { font-size: 0.6rem; color: #64748b; }

.status-badge {
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: 999px;
}
.status-badge.correct   { background: rgba(34,197,94,0.15);  color: #4ade80; }
.status-badge.incorrect { background: rgba(245,158,11,0.15); color: #fbbf24; }

.completion-badge {
  background: linear-gradient(135deg, #854d0e, #ca8a04);
  color: #fef08a;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 12px;
}

.feedback-section {
  background: #0f172a;
  border-radius: 8px;
  padding: 10px;
}
.feedback-label { font-size: 0.72rem; color: #64748b; margin-bottom: 4px; }
.feedback-text { font-size: 0.8rem; color: #cbd5e1; line-height: 1.5; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
  `]
})
export class PedagogyPanelComponent implements OnInit, OnDestroy {
    @Input() sessionId: string = '';

    progressList: PedagogyProgress[] = [];
    ollamaReady = false;
    private stopPolling?: () => void;

    get hasData(): boolean { return this.progressList.length > 0; }

    constructor(
        private pedagogyService: PedagogyService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        // Vérifier Ollama
        this.pedagogyService.getOllamaStatus().subscribe({
            next: s => { this.ollamaReady = s.ollamaReady; this.cdr.detectChanges(); },
            error: () => { }
        });

        // Démarrer le polling si une session est active
        if (this.sessionId) {
            this.stopPolling = this.pedagogyService.startPolling(this.sessionId, 15000);
            this.pedagogyService.progress$.subscribe(p => {
                const idx = this.progressList.findIndex(
                    x => (x.studentLoginIdentity || x.participantId) ===
                        (p.studentLoginIdentity || p.participantId)
                );
                if (idx >= 0) this.progressList[idx] = p;
                else this.progressList.push(p);
                this.progressList = [...this.progressList];
                this.cdr.detectChanges();
            });
        }
    }

    ngOnDestroy(): void {
        this.stopPolling?.();
        this.pedagogyService.clearSession();
    }

    getScoreGradient(score: number): string {
        if (score >= 80) return 'linear-gradient(135deg, #16a34a, #22c55e)';
        if (score >= 60) return 'linear-gradient(135deg, #d97706, #fbbf24)';
        if (score >= 30) return 'linear-gradient(135deg, #ea580c, #fb923c)';
        return 'linear-gradient(135deg, #dc2626, #ef4444)';
    }

    getSiteIcon(site: string): string {
        if (site?.includes('codecombat')) return '⚔️';
        if (site?.includes('code.org')) return '💻';
        return '📖';
    }
}
