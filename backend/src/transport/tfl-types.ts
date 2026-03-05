/** Raw response types from TfL Unified API */

export interface TflLineResponse {
  id: string;
  name: string;
  modeName: string;
  created?: string;
  modified?: string;
  lineStatuses: TflLineStatus[];
  disruptions?: TflDisruption[];
  routeSections?: TflRouteSection[];
  serviceTypes?: TflServiceType[];
}

export interface TflLineStatus {
  id?: number;
  lineId?: string;
  statusSeverity: TflStatusSeverity;
  statusSeverityDescription: string;
  reason?: string;
  validityPeriods: TflValidityPeriod[];
  disruption?: TflDisruption;
  created?: string;
  modified?: string;
}

export interface TflValidityPeriod {
  fromDate: string;
  toDate: string;
  isNow?: boolean;
}

export interface TflDisruption {
  category: string;
  categoryDescription?: string;
  description: string;
  additionalInfo?: string;
  affectedRoutes?: TflAffectedRoute[];
  affectedStops?: TflStopPoint[];
  closureText?: string;
  isWholeLine?: boolean;
  isBlocking?: boolean;
  lastUpdate?: string;
  created?: string;
}

export interface TflAffectedRoute {
  id?: number;
  name?: string;
  uri?: string;
  lineId?: string;
}

export interface TflStopPoint {
  id?: string;
  name?: string;
  naptanId?: string;
}

export interface TflRouteSection {
  originator?: string;
  destination?: string;
}

export interface TflServiceType {
  name: string;
  uri?: string;
}

/**
 * TfL Status Severity values.
 * 0-14 scale where 10 = Good Service.
 */
export enum TflStatusSeverity {
  SpecialService = 0,
  Closed = 1,
  Suspended = 2,
  PartSuspended = 3,
  PlannedClosure = 4,
  PartClosure = 5,
  SevereDelays = 6,
  ReducedService = 7,
  BusService = 8,
  MinorDelays = 9,
  GoodService = 10,
  PartClosed = 11,
  ExitOnly = 12,
  NoStepFreeAccess = 13,
  ChangeOfFrequency = 14,
}
