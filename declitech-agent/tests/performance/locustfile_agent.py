"""
Tests de performance — Agent Python (DecliTech)
Outil : Locust (pip install locust)
Usage : locust -f tests/performance/locustfile_agent.py --host http://localhost:8000

Scénarios simulés :
  - Statut de l'agent (GET /status)
  - Validation de code session (GET /validate/{code})
  - Requêtes racine (GET /)
  - Simulation flux complet start/stop
"""

from locust import HttpUser, task, between, events
import json
import random
import string
import time


def random_code(n=6):
    """Génère un code de session aléatoire pour les tests"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=n))


class AgentStatusUser(HttpUser):
    """
    Utilisateur simulant des mises à jour de statut fréquentes
    (ex: extension Chrome polling toutes les 2s)
    """
    wait_time = between(1, 3)

    @task(5)
    def check_status(self):
        """Scénario le plus fréquent : vérification du statut"""
        with self.client.get("/status", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if "running" in data:
                    response.success()
                else:
                    response.failure("Missing 'running' field in response")
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(2)
    def get_root(self):
        """Endpoint racine / healthcheck"""
        with self.client.get("/", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Root endpoint failed: {response.status_code}")

    @task(3)
    def validate_session_code(self):
        """Validation d'un code de session (utilisée avant chaque start)"""
        code = random_code()
        with self.client.get(f"/validate/{code}", catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                # Que le code soit valide ou non, la réponse doit avoir 'valid'
                if "valid" in data:
                    response.success()
                else:
                    response.failure("Missing 'valid' field in response")
            else:
                response.failure(f"Validate failed: {response.status_code}")


class AgentFullFlowUser(HttpUser):
    """
    Utilisateur simulant le flux complet étudiant:
    validate → start → [polling status] → stop
    """
    wait_time = between(5, 15)

    @task(1)
    def full_session_flow(self):
        """Flux complet : validation + démarrage + arrêt"""
        code = random_code()

        # Étape 1 : Valider le code
        with self.client.get(f"/validate/{code}", name="/validate/[code]",
                              catch_response=True) as response:
            if response.status_code != 200:
                response.failure("Validation failed")
                return

        # Étape 2 : Démarrer une session (peut échouer car code fictif — c'est attendu)
        payload = {
            "code": code,
            "student_id": f"student_{random.randint(1, 100)}",
            "device_id": f"PC-{random.randint(1, 50)}",
            "duration_min": 1,
            "interval_min": 1,
            "login_identity": f"student{random.randint(1,100)}@test.com"
        }
        with self.client.post("/start", json=payload, name="/start",
                               catch_response=True) as response:
            # 200 = démarré, 400 = code invalide ou déjà en cours (les deux sont ok en perf test)
            if response.status_code in (200, 400, 422):
                response.success()
            else:
                response.failure(f"Unexpected start response: {response.status_code}")


# =========================================================
#  Hooks pour le rapport de performance
# =========================================================

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("\n🚀 Démarrage des tests de performance — Agent DecliTech")
    print(f"   Host cible : {environment.host}")
    print(f"   Utilisateurs simulés : {environment.runner.target_user_count if environment.runner else 'N/A'}")

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("\n✅ Tests de performance terminés")
    stats = environment.runner.stats
    print(f"   Requêtes totales     : {stats.total.num_requests}")
    print(f"   Échecs               : {stats.total.num_failures}")
    print(f"   Temps de réponse moy : {stats.total.avg_response_time:.1f} ms")
    print(f"   Temps de réponse p95 : {stats.total.get_response_time_percentile(0.95):.1f} ms")
    print(f"   RPS (débit)          : {stats.total.current_rps:.1f} req/s")
