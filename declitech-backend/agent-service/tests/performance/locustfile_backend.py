"""
Tests de performance — Backend Spring Boot (DecliTech)
Outil : Locust (pip install locust)

Usage :
  # Interface web interactive
  locust -f tests/performance/locustfile_backend.py --host http://localhost:8080

  # Mode headless (CI/CD) — 20 utilisateurs, 2 min
  locust -f tests/performance/locustfile_backend.py \
    --host http://localhost:8080 \
    --headless -u 20 -r 2 --run-time 2m \
    --csv=results/performance_report

Scénarios :
  1. Auth Flow  → POST /login, GET /validate
  2. Session Flow → GET /validate (par code), GET /sessions/{id}
  3. Report Flow  → GET /reports
"""

from locust import HttpUser, task, between, events, constant
import json
import random
import string

# =========================================================
#  Configuration des seuils de performance
# =========================================================
SEUIL_TEMPS_REPONSE_P95_MS = 500   # P95 < 500ms
SEUIL_TAUX_ERREUR_MAX = 0.01        # < 1% d'erreurs

# =========================================================
#  Données de test
# =========================================================
TEST_LOGIN = {
    "usernameOrEmail": "admin",
    "password": "admin123"   # Adapter selon votre environnement de test
}

SAMPLE_SESSION_CODES = ["ABC123", "XYZ789", "DEF456", "TEST01", "DEMO99"]


class AuthFlowUser(HttpUser):
    """
    Simule des utilisateurs qui se connectent et vérifient leur token.
    Charge type : instructeurs se connectant en début de séance.
    """
    wait_time = between(2, 5)

    @task(3)
    def authenticate(self):
        """Login endpoint — critique, doit répondre < 300ms"""
        with self.client.post(
            "/api/auth/login",
            json=TEST_LOGIN,
            name="POST /auth/login",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.success()  # 401 attendu si credentials incorrects en test
            else:
                response.failure(f"Auth failed unexpectedly: {response.status_code}")

    @task(1)
    def health_check(self):
        """Health check — doit toujours répondre rapidement"""
        with self.client.get(
            "/api/auth/health",
            name="GET /auth/health",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")

    @task(2)
    def validate_token_with_invalid(self):
        """Valider un token → doit répondre même avec token invalide"""
        with self.client.get(
            "/api/auth/validate",
            name="GET /auth/validate (no token)",
            catch_response=True
        ) as response:
            # 401 est le comportement correct sans token
            if response.status_code in (200, 401):
                response.success()
            else:
                response.failure(f"Unexpected: {response.status_code}")


class SessionLookupUser(HttpUser):
    """
    Simule des étudiants qui rejoignent une session.
    Volume élevé attendu au début de chaque cours.
    """
    wait_time = between(1, 4)

    @task(4)
    def validate_session_code(self):
        """
        Validation du code session — endpoint critique !
        Appelé par chaque étudiant au démarrage de l'extension.
        """
        code = random.choice(SAMPLE_SESSION_CODES)
        with self.client.get(
            f"/api/sessions/code/{code}",
            name="GET /sessions/code/[code]",
            catch_response=True
        ) as response:
            # 200 = trouvé, 404 = pas trouvé (normal en test)
            if response.status_code in (200, 404, 403, 401):
                response.success()
            else:
                response.failure(f"Unexpected code: {response.status_code}")

    @task(1)
    def list_active_sessions(self):
        """Liste des sessions actives — accès instructeur"""
        with self.client.get(
            "/api/sessions",
            name="GET /sessions",
            catch_response=True
        ) as response:
            if response.status_code in (200, 401, 403):
                response.success()
            else:
                response.failure(f"Unexpected: {response.status_code}")


class ReportLoadUser(HttpUser):
    """
    Simule la consultation des rapports d'émotion.
    Charge modérée — consultation post-séance.
    """
    wait_time = between(3, 8)

    @task(3)
    def get_reports_by_session(self):
        """Récupération des rapports par session"""
        code = random.choice(SAMPLE_SESSION_CODES)
        with self.client.get(
            f"/api/reports/session/code/{code}",
            name="GET /reports/session/code/[code]",
            catch_response=True
        ) as response:
            if response.status_code in (200, 404, 401, 403):
                response.success()
            else:
                response.failure(f"Report fetch failed: {response.status_code}")

    @task(1)
    def get_all_reports(self):
        """Récupération de tous les rapports (admin)"""
        with self.client.get(
            "/api/reports",
            name="GET /reports",
            catch_response=True
        ) as response:
            if response.status_code in (200, 401, 403):
                response.success()
            else:
                response.failure(f"Unexpected: {response.status_code}")


# =========================================================
#  Hooks de rapport
# =========================================================

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n🚀 Démarrage des tests de performance — Backend DecliTech")
    print(f"   Host cible       : {environment.host}")
    print(f"   SLA p95          : < {SEUIL_TEMPS_REPONSE_P95_MS} ms")
    print(f"   SLA taux erreur  : < {SEUIL_TAUX_ERREUR_MAX*100:.0f}%")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.runner.stats

    p95 = stats.total.get_response_time_percentile(0.95)
    total = stats.total.num_requests
    failures = stats.total.num_failures
    error_rate = (failures / total * 100) if total > 0 else 0

    print("\n" + "="*60)
    print("📊 RAPPORT DE PERFORMANCE — Backend DecliTech")
    print("="*60)
    print(f"  Requêtes totales      : {total}")
    print(f"  Échecs                : {failures} ({error_rate:.1f}%)")
    print(f"  Temps réponse moyen   : {stats.total.avg_response_time:.0f} ms")
    print(f"  Temps réponse P50     : {stats.total.get_response_time_percentile(0.50):.0f} ms")
    print(f"  Temps réponse P95     : {p95:.0f} ms")
    print(f"  Temps réponse P99     : {stats.total.get_response_time_percentile(0.99):.0f} ms")
    print(f"  Débit (RPS)           : {stats.total.total_rps:.1f} req/s")
    print("="*60)

    # Vérification des SLAs
    sla_ok = True
    if p95 > SEUIL_TEMPS_REPONSE_P95_MS:
        print(f"  ❌ SLA VIOLÉ : P95 = {p95:.0f}ms > seuil de {SEUIL_TEMPS_REPONSE_P95_MS}ms")
        sla_ok = False
    else:
        print(f"  ✅ SLA P95 respecté : {p95:.0f}ms < {SEUIL_TEMPS_REPONSE_P95_MS}ms")

    if error_rate > SEUIL_TAUX_ERREUR_MAX * 100:
        print(f"  ❌ SLA VIOLÉ : Taux erreur = {error_rate:.1f}% > {SEUIL_TAUX_ERREUR_MAX*100:.0f}%")
        sla_ok = False
    else:
        print(f"  ✅ SLA Erreurs respecté : {error_rate:.1f}% < {SEUIL_TAUX_ERREUR_MAX*100:.0f}%")

    print("="*60)
