import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';
import { PedagogyProgress } from '../models/pedagogy/pedagogy-progress.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PedagogyService {

    // URL de l'agent Python (directement, pas via la gateway)
    private readonly agentUrl = 'http://localhost:8765';

    // Map : studentLoginIdentity → dernière progression connue
    private progressMap = new Map<string, PedagogyProgress>();
    private progressSubject = new Subject<PedagogyProgress>();

    public progress$ = this.progressSubject.asObservable();

    constructor(private http: HttpClient) { }

    // ------------------------------------------------
    //  Appelée par le dashboard quand une session démarre
    //  L'extension envoie les mises à jour directement à l'agent
    //  et l'agent stocke le résultat — on poll toutes les 15s
    // ------------------------------------------------
    startPolling(sessionId: string, interval = 4000): () => void {
        const id = setInterval(() => this.fetchProgress(sessionId), interval);
        this.fetchProgress(sessionId); // appel immédiat
        return () => clearInterval(id);
    }

    private fetchProgress(sessionId: string): void {
        this.http.get<PedagogyProgress[]>(
            `${this.agentUrl}/pedagogy/session/${sessionId}`,
            { withCredentials: false }
        ).subscribe({
            next: (list) => {
                list.forEach(p => {
                    this.progressMap.set(p.studentLoginIdentity || 'unknown', p);
                    this.progressSubject.next(p);
                });
            },
            error: () => { }
        });
    }

    // ------------------------------------------------
    //  Accesseurs
    // ------------------------------------------------
    getProgressFor(identity: string): PedagogyProgress | undefined {
        return this.progressMap.get(identity);
    }

    getScoreFor(identity: string): number {
        return this.progressMap.get(identity)?.score ?? -1;
    }

    hasProgress(identity: string): boolean {
        return this.progressMap.has(identity);
    }

    clearSession(): void {
        this.progressMap.clear();
    }

    // ------------------------------------------------
    //  Test direct : générer une solution depuis le dashboard
    // ------------------------------------------------
    getSolution(title: string, site: string, level?: number) {
        const params: any = { title, site };
        if (level !== undefined) params['level'] = level;
        return this.http.get<{ solution: string }>(`${this.agentUrl}/pedagogy/solution`, { params });
    }

    // ------------------------------------------------
    //  Statut Ollama
    // ------------------------------------------------
    getOllamaStatus() {
        return this.http.get<{ ollamaReady: boolean; message: string }>(
            `${this.agentUrl}/pedagogy/status`,
            { withCredentials: false }
        );
    }
}
