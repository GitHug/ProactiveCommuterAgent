import {
  AlertDecision,
  AlertType,
  DepartureConfidence,
  Severity,
  TransportStatus,
} from '@commuter/shared';

/** Clock abstraction for testability */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** User context needed for a decision */
export interface UserContext {
  userId: string;
  routeId: string;
  originStation: string;
  destinationStation: string;
  /** e.g. "South Western Railway" or "Piccadilly" */
  routeDisplayName: string;
}

/** Departure window for the relevant day */
export interface DepartureWindowContext {
  medianDepartureTime: string; // HH:mm format
  confidence: DepartureConfidence;
  dayOfWeek: number;
}

/** Notification rule preferences */
export interface RuleContext {
  alertType: AlertType;
  enabled: boolean;
  minSeverity: Severity;
  cooldownMinutes: number;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string; // HH:mm
  dailyCap: number;
}

/** Previous alert for dedup/cooldown checks */
export interface PreviousAlert {
  alertId: string;
  alertType: AlertType;
  severity: Severity;
  summary: string;
  sourceIncidentId: string | null;
  sentAt: Date;
}

/** Whether user is currently at home (for actionability check) */
export interface LocationContext {
  /** true if user appears to still be at home */
  isAtHome: boolean | null; // null = unknown
}

/** Full input to the Decision Engine */
export interface DecisionInput {
  userContext: UserContext;
  departureWindow: DepartureWindowContext;
  rule: RuleContext;
  transportStatus: TransportStatus;
  previousAlerts: PreviousAlert[];
  alertsSentToday: number;
  locationContext: LocationContext;
}

/** Output from the Decision Engine */
export interface DecisionOutput {
  decision: AlertDecision;
  suppressionReason: string | null;
  notification: NotificationContent | null;
}

/** Notification content to send */
export interface NotificationContent {
  title: string;
  body: string;
  triggerReason: string;
}
