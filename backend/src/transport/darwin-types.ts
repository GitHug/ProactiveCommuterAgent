/** Raw response types from Huxley2 (Darwin JSON proxy) */

export interface HuxleyDepartureBoard {
  generatedAt: string;
  locationName: string;
  crs: string;
  filterLocationName?: string;
  filtercrs?: string;
  filterType?: number;
  delays: boolean;
  totalTrains: number;
  totalTrainsDelayed: number;
  totalDelayMinutes: number;
  trainServices: HuxleyTrainService[] | null;
  busServices: unknown[] | null;
  ferryServices: unknown[] | null;
  nrccMessages: NrccMessage[] | null;
}

export interface HuxleyTrainService {
  std: string;
  etd: string;
  sta?: string;
  eta?: string;
  platform: string | null;
  operator: string;
  operatorCode: string;
  origin: HuxleyLocation[];
  destination: HuxleyLocation[];
  serviceIdPercentEncoded: string;
  serviceIdGuid: string;
  serviceIdUrlSafe: string;
  rsid: string;
  isCancelled: boolean;
  cancelReason: string | null;
  delayReason: string | null;
  length: string | null;
  isCircularRoute: boolean;
  subsequentCallingPoints?: HuxleyCallingPointSet[];
  previousCallingPoints?: HuxleyCallingPointSet[];
}

export interface HuxleyLocation {
  locationName: string;
  crs: string;
  via: string | null;
  futureChangeTo: string | null;
  assocIsCancelled: boolean;
}

export interface HuxleyCallingPointSet {
  callingPoint: HuxleyCallingPoint[];
  serviceType: number;
  serviceChangeRequired: boolean;
  assocIsCancelled: boolean;
}

export interface HuxleyCallingPoint {
  locationName: string;
  crs: string;
  st: string;
  et: string;
  at: string | null;
  isCancelled: boolean;
  length: number;
  detachFront: boolean;
}

export interface NrccMessage {
  category: number;
  severity: number;
  xhtmlMessage: string;
}
