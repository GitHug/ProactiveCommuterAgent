import axios from 'axios';
import {
  TransportStatus,
  EngineeringWorks,
  TransportProvider,
  EngineeringWorksSeverity,
  OverallStatus,
  Severity,
} from '@commuter/shared';
import { TransportAdapter, DateRange } from './transport-adapter.interface';
import { TflLineResponse, TflLineStatus, TflStatusSeverity } from './tfl-types';
import { mapTflSeverity } from './severity-mapper';

const TFL_BASE_URL = 'https://api.tfl.gov.uk';

export class TflAdapter implements TransportAdapter {
  readonly name = 'TfL Unified API';
  readonly provider = TransportProvider.Tfl;

  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl ?? TFL_BASE_URL;
  }

  private params(): Record<string, string> {
    return this.apiKey ? { app_key: this.apiKey } : {};
  }

  async checkRouteStatus(
    origin: string,
    destination: string,
  ): Promise<TransportStatus> {
    // For TfL, origin/destination are station-based. We need to find the
    // line(s) serving both stations. For MVP, the caller should use
    // checkLineStatus for TfL routes directly.
    // Here we attempt a best-effort approach by checking the line status.
    return this.checkLineStatus(`${origin}-${destination}`);
  }

  async checkLineStatus(lineId: string): Promise<TransportStatus> {
    const url = `${this.baseUrl}/Line/${lineId}/Status`;

    const response = await axios.get<TflLineResponse[]>(url, {
      params: this.params(),
      timeout: 10_000,
    });

    const lines = response.data;
    if (!lines || lines.length === 0) {
      return this.emptyStatus(lineId);
    }

    const line = lines[0];
    const statuses = line.lineStatuses ?? [];

    if (statuses.length === 0) {
      return this.emptyStatus(lineId);
    }

    // Find the worst status (lowest statusSeverity number = worst)
    const worstStatus = this.findWorstStatus(statuses);
    const { overallStatus, severity } = mapTflSeverity(
      worstStatus.statusSeverity,
    );

    const summary = this.buildSummary(line.name, statuses);

    return {
      provider: TransportProvider.Tfl,
      routeKey: lineId,
      checkedAt: new Date().toISOString(),
      overallStatus,
      severity,
      summary,
      affectedServices: statuses
        .filter((s) => s.statusSeverity !== TflStatusSeverity.GoodService)
        .map((s) => ({
          serviceId: line.id,
          operator: 'TfL',
          status: s.statusSeverityDescription,
          detail: s.reason ?? s.statusSeverityDescription,
        })),
      sourceIncidentId: null,
      expectedResolution: null,
      alternatives: null,
    };
  }

  async getPlannedWorks(dateRange: DateRange): Promise<EngineeringWorks[]> {
    // TfL planned works are embedded in line status as PlannedClosure disruptions.
    // Fetch all tube lines and filter for planned works.
    try {
      const url = `${this.baseUrl}/Line/Mode/tube,elizabeth-line,dlr,overground/Status`;
      const response = await axios.get<TflLineResponse[]>(url, {
        params: this.params(),
        timeout: 10_000,
      });

      const works: EngineeringWorks[] = [];
      for (const line of response.data) {
        for (const status of line.lineStatuses) {
          if (
            status.statusSeverity === TflStatusSeverity.PlannedClosure || // Planned Closure
            status.statusSeverity === TflStatusSeverity.PartClosure // Part Closure
          ) {
            for (const period of status.validityPeriods ?? []) {
              const from = new Date(period.fromDate);
              const to = new Date(period.toDate);
              if (from <= dateRange.to && to >= dateRange.from) {
                works.push({
                  worksId: `tfl-${line.id}-${period.fromDate}`,
                  provider: TransportProvider.Tfl,
                  affectedRoutes: [line.id],
                  startDate: period.fromDate,
                  endDate: period.toDate,
                  description:
                    status.reason ??
                    `${line.name}: ${status.statusSeverityDescription}`,
                  severity:
                    status.statusSeverity === TflStatusSeverity.PlannedClosure
                      ? EngineeringWorksSeverity.Closure
                      : EngineeringWorksSeverity.Major,
                  sourceUrl: null,
                  fetchedAt: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
      return works;
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/Line/victoria/Status`, {
        params: this.params(),
        timeout: 5_000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private findWorstStatus(statuses: TflLineStatus[]): TflLineStatus {
    // Lower statusSeverity number = worse situation.
    // Exception: 0 (Special Service) is informational, not necessarily bad.
    return statuses.reduce((worst, current) => {
      const worstScore = this.severityScore(worst.statusSeverity);
      const currentScore = this.severityScore(current.statusSeverity);
      return currentScore > worstScore ? current : worst;
    }, statuses[0]);
  }

  /** Higher score = worse disruption */
  private severityScore(statusSeverity: number): number {
    const scoreMap: Record<number, number> = {
      10: 0, // Good Service
      14: 1, // Change of frequency
      0: 1, // Special Service
      9: 2, // Minor Delays
      7: 3, // Reduced Service
      6: 4, // Severe Delays
      5: 5, // Part Closure
      3: 5, // Part Suspended
      11: 5, // Part Closed
      8: 6, // Bus Service
      4: 7, // Planned Closure
      2: 8, // Suspended
      1: 9, // Closed
    };
    return scoreMap[statusSeverity] ?? 0;
  }

  private buildSummary(lineName: string, statuses: TflLineStatus[]): string {
    const nonGood = statuses.filter(
      (s) => s.statusSeverity !== TflStatusSeverity.GoodService,
    );
    if (nonGood.length === 0) {
      return `${lineName}: Good Service.`;
    }

    const descriptions = nonGood
      .map((s) => s.statusSeverityDescription)
      .join(', ');

    const reason = nonGood.find((s) => s.reason)?.reason;
    return reason
      ? `${lineName}: ${descriptions}. ${reason}`
      : `${lineName}: ${descriptions}.`;
  }

  private emptyStatus(lineId: string): TransportStatus {
    return {
      provider: TransportProvider.Tfl,
      routeKey: lineId,
      checkedAt: new Date().toISOString(),
      overallStatus: OverallStatus.Normal,
      severity: Severity.Info,
      summary: `No status data available for ${lineId}.`,
      affectedServices: [],
      sourceIncidentId: null,
      expectedResolution: null,
      alternatives: null,
    };
  }
}
