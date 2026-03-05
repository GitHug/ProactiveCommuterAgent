export enum TransportProvider {
  Darwin = 'darwin',
  Tfl = 'tfl',
  NetworkRail = 'network_rail',
  TransportApi = 'transport_api',
}

export enum TransportMode {
  NationalRail = 'national_rail',
  TflTube = 'tfl_tube',
  TflRail = 'tfl_rail',
  TflDlr = 'tfl_dlr',
}

export enum OverallStatus {
  Normal = 'normal',
  MinorDelays = 'minor_delays',
  MajorDelays = 'major_delays',
  PartSuspended = 'part_suspended',
  Suspended = 'suspended',
  Cancelled = 'cancelled',
}

export enum Severity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

export enum AlertType {
  PreDeparture = 'pre_departure',
  MorningSummary = 'morning_summary',
  EngineeringWorks = 'engineering_works',
  MajorDisruption = 'major_disruption',
}

export enum AlertDecision {
  Sent = 'sent',
  SuppressedSeverity = 'suppressed_severity',
  SuppressedCooldown = 'suppressed_cooldown',
  SuppressedDuplicate = 'suppressed_duplicate',
  SuppressedCap = 'suppressed_cap',
  SuppressedQuiet = 'suppressed_quiet',
  SuppressedActionability = 'suppressed_actionability',
}

export enum DepartureConfidence {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export enum DepartureSource {
  Learned = 'learned',
  Manual = 'manual',
}

export enum PlaceLabel {
  Home = 'home',
  Office = 'office',
  Other = 'other',
}

export enum Platform {
  Ios = 'ios',
  Android = 'android',
}

export enum EngineeringWorksSeverity {
  Minor = 'minor',
  Major = 'major',
  Closure = 'closure',
}
