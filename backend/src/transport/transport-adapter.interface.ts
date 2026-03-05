import {
  TransportStatus,
  EngineeringWorks,
  TransportProvider,
} from '@commuter/shared';

export interface CheckOptions {
  /** Specific time to check for (defaults to now) */
  dateTime?: Date;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface TransportAdapter {
  /** Adapter name for logging */
  readonly name: string;

  /** Which provider this adapter wraps */
  readonly provider: TransportProvider;

  /**
   * Check real-time status for a station-to-station route.
   * @param origin CRS station code (e.g. "SUR")
   * @param destination CRS station code (e.g. "WAT")
   */
  checkRouteStatus(
    origin: string,
    destination: string,
    options?: CheckOptions,
  ): Promise<TransportStatus>;

  /**
   * Check status of a specific line (primarily for TfL).
   * @param lineId Line identifier (e.g. "piccadilly", "northern")
   */
  checkLineStatus(lineId: string): Promise<TransportStatus>;

  /**
   * Get planned engineering works for a date range.
   * @param dateRange Range to check
   * @param affectedStations Optional filter by station codes
   */
  getPlannedWorks(
    dateRange: DateRange,
    affectedStations?: string[],
  ): Promise<EngineeringWorks[]>;

  /**
   * Check if the adapter's upstream API is reachable.
   */
  healthCheck(): Promise<boolean>;
}
