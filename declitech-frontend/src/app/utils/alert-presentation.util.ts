const KNOWN_ALERT_TYPES = [
  'TAB_SWITCH',
  'MULTIPLE_SWITCHES',
  'OFF_PLATFORM',
  'INACTIVITY',
  'MOUSE_INACTIVITY',
  'FOCUS_LOSS',
  'DISTRACTION',
  'LOW_ENGAGEMENT',
  'ALERT_RESOLVED'
];

const ALERT_ICONS: Record<string, string> = {
  TAB_SWITCH: 'tab',
  MULTIPLE_SWITCHES: 'tab_unselected',
  OFF_PLATFORM: 'public_off',
  INACTIVITY: 'timer_off',
  MOUSE_INACTIVITY: 'mouse',
  FOCUS_LOSS: 'visibility_off',
  DISTRACTION: 'warning',
  LOW_ENGAGEMENT: 'trending_down',
  ALERT_RESOLVED: 'check_circle'
};

const SEVERITY_CLASSES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200'
};

export function alertTypeI18nKey(alertType: string): string {
  return KNOWN_ALERT_TYPES.includes(alertType) ? `ALERT_TYPE.${alertType}` : alertType;
}

export function alertIcon(alertType: string): string {
  return ALERT_ICONS[alertType] || 'notification_important';
}

export function alertSeverityClass(severity: string): string {
  return SEVERITY_CLASSES[severity] || SEVERITY_CLASSES['LOW'];
}

export function formatAlertTime(timestamp: string): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function getInitials(name: string): string {
  if (!name) return 'ST';
  const parts = name.split(/[\s.]+/).filter((p) => p.length > 0);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
