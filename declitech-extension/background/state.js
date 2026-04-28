export const state = {
  sessionCode: null,
  participantId: null,
  studentLoginIdentity: null,
  lastUrl: null,
  tabSwitchCount: 0,
  lastAlertTime: 0,
  isOnWrongSite: false,
  lastMouseMoveTime: Date.now(),
  mouseAlertSent: false,
  lastVittaData: null,
  lastPythonData: null,
};

export function startSession({ sessionCode, participantId, studentLoginIdentity }) {
  state.sessionCode = sessionCode;
  state.participantId = participantId;
  state.studentLoginIdentity = studentLoginIdentity;
  state.lastUrl = null;
  state.tabSwitchCount = 0;
  state.lastAlertTime = 0;
  state.isOnWrongSite = false;
  state.lastMouseMoveTime = Date.now();
  state.mouseAlertSent = false;
}

export function clearSession() {
  state.sessionCode = null;
  state.participantId = null;
  state.studentLoginIdentity = null;
  state.lastUrl = null;
  state.tabSwitchCount = 0;
  state.isOnWrongSite = false;
  state.mouseAlertSent = false;
}

export function isActive() {
  return !!state.sessionCode;
}
