import {
  AlertDecision,
  AlertType,
  DepartureConfidence,
  DepartureSource,
  EngineeringWorksSeverity,
  OverallStatus,
  Platform,
  Severity,
  TransportMode,
  TransportProvider,
} from './enums';

/** Normalised transport status from any provider */
export interface TransportStatus {
  provider: TransportProvider;
  routeKey: string;
  checkedAt: string;
  overallStatus: OverallStatus;
  severity: Severity;
  summary: string;
  affectedServices: AffectedService[];
  sourceIncidentId: string | null;
  expectedResolution: string | null;
  alternatives: string | null;
}

export interface AffectedService {
  serviceId: string;
  operator: string;
  status: string;
  detail: string;
}

/** Commute route configuration */
export interface CommuteRoute {
  routeId: string;
  userId: string;
  originStation: string;
  destinationStation: string;
  viaStation: string | null;
  transportMode: TransportMode;
  isActive: boolean;
  daysOfWeek: number[];
}

/** Learned or manual departure window */
export interface DepartureWindow {
  windowId: string;
  userId: string;
  routeId: string;
  dayOfWeek: number;
  medianDepartureTime: string;
  stdDeviationMinutes: number;
  sampleCount: number;
  confidence: DepartureConfidence;
  source: DepartureSource;
  updatedAt: string;
}

/** User settings */
export interface UserSettings {
  userId: string;
  pushToken: string;
  platform: Platform;
  timezone: string;
  morningSummaryTime: string;
  eveningWorksAlertTime: string;
  preDepartureLeadMinutes: number;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Alert decision record */
export interface AlertRecord {
  alertId: string;
  userId: string;
  routeId: string;
  alertType: AlertType;
  triggerReason: string;
  transportStatusSnapshot: TransportStatus;
  severity: Severity;
  decision: AlertDecision;
  suppressionReason: string | null;
  notificationTitle: string;
  notificationBody: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  createdAt: string;
}

/** Planned engineering works */
export interface EngineeringWorks {
  worksId: string;
  provider: TransportProvider;
  affectedRoutes: string[];
  startDate: string;
  endDate: string;
  description: string;
  severity: EngineeringWorksSeverity;
  sourceUrl: string | null;
  fetchedAt: string;
}

/** Notification rule preferences */
export interface NotificationRule {
  ruleId: string;
  userId: string;
  ruleType: AlertType;
  enabled: boolean;
  minSeverity: Severity;
  cooldownMinutes: number;
  scheduleTime: string | null;
  daysOfWeek: number[];
}
