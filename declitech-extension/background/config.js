export const ALERT_URL = "http://localhost:8081/api/alerts/publish";
export const AGENT_URL = "http://127.0.0.1:8765";
export const AGENT_SCREEN_URL = `${AGENT_URL}/analyze-screen`;
export const AGENT_PEDAGOGY_URL = `${AGENT_URL}/pedagogy/progress`;
export const AGENT_PYTHON_URL = `${AGENT_URL}/python-execution`;
export const AGENT_VALIDATE_URL = (code) => `${AGENT_URL}/validate/${code}`;
export const AGENT_STOP_URL = `${AGENT_URL}/stop`;

export const ALLOWED_SITES = [
  "https://app.decli.tech/",
  "https://learn.decli.tech/",
  "https://quiz.decli.tech/",
  "https://codecombat.com/",
  "https://www.codecombat.com/",
  "https://code.org/",
  "https://studio.code.org/",
  "https://vittascience.com/",
  "http://localhost:4200/",
];

export const PEDAGOGY_SITES = ["codecombat.com", "code.org"];

export const TIMING = {
  TAB_CHECK_MS: 2000,
  ALERT_COOLDOWN_MS: 5000,
  MOUSE_INACTIVITY_MS: 30 * 1000,
  MOUSE_CHECK_MS: 5000,
  SCREEN_CAPTURE_MS: 30000,
  SCREEN_CAPTURE_DELAY_MS: 5000,
  SESSION_VALIDATION_MS: 5000,
  PEDAGOGY_SCAN_MS: 30000,
  LEARN_DURATION_MS: 10 * 1000,
};

export const SCREEN_CAPTURE_DOMAIN = "https://learn.decli.tech/";
