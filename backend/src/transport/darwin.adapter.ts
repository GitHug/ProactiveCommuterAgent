import axios from 'axios';
import {
  TransportStatus,
  EngineeringWorks,
  TransportProvider,
  OverallStatus,
  Severity,
} from '@commuter/shared';
import { TransportAdapter } from './transport-adapter.interface';
import { HuxleyDepartureBoard } from './darwin-types';
import { mapDarwinSeverity } from './severity-mapper';

const HUXLEY2_BASE_URL = 'https://huxley2.azurewebsites.net';
const DEFAULT_NUM_ROWS = 10;

export class DarwinAdapter implements TransportAdapter {
  readonly name = 'Darwin (Huxley2)';
  readonly provider = TransportProvider.Darwin;

  private readonly baseUrl: string;
  private readonly accessToken: string | undefined;

  constructor(accessToken?: string, baseUrl?: string) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl ?? HUXLEY2_BASE_URL;
  }

  private params(): Record<string, string> {
    return this.accessToken ? { accessToken: this.accessToken } : {};
  }

  async checkRouteStatus(
    origin: string,
    destination: string,
  ): Promise<TransportStatus> {
    const url = `${this.baseUrl}/departures/${origin}/to/${destination}/${DEFAULT_NUM_ROWS}`;

    const response = await axios.get<HuxleyDepartureBoard>(url, {
      params: this.params(),
      timeout: 10_000,
    });

    const board = response.data;
    const { overallStatus, severity, summary } = mapDarwinSeverity(board);

    const routeKey = `${origin}-${destination}`;
    const services = board.trainServices ?? [];

    return {
      provider: TransportProvider.Darwin,
      routeKey,
      checkedAt: new Date().toISOString(),
      overallStatus,
      severity,
      summary,
      affectedServices: services
        .filter((s) => s.isCancelled || s.etd?.toLowerCase() !== 'on time')
        .slice(0, 5)
        .map((s) => ({
          serviceId: s.rsid ?? s.serviceIdGuid,
          operator: s.operator,
          status: s.isCancelled ? 'Cancelled' : `Expected ${s.etd}`,
          detail: s.isCancelled
            ? (s.cancelReason ?? 'No reason given')
            : (s.delayReason ?? `Scheduled ${s.std}, expected ${s.etd}`),
        })),
      sourceIncidentId: null,
      expectedResolution: null,
      alternatives: null,
    };
  }

  checkLineStatus(lineId: string): Promise<TransportStatus> {
    // Darwin is station-based, not line-based. Return a not-supported response.
    return Promise.resolve({
      provider: TransportProvider.Darwin,
      routeKey: lineId,
      checkedAt: new Date().toISOString(),
      overallStatus: OverallStatus.Normal,
      severity: Severity.Info,
      summary:
        'Line-based status not supported by Darwin. Use checkRouteStatus instead.',
      affectedServices: [],
      sourceIncidentId: null,
      expectedResolution: null,
      alternatives: null,
    });
  }

  getPlannedWorks(): Promise<EngineeringWorks[]> {
    // Engineering works come from Network Rail, not Darwin.
    // Stubbed for now - will be implemented in NetworkRailAdapter.
    return Promise.resolve([]);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/departures/WAT/1`, {
        params: this.params(),
        timeout: 5_000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
