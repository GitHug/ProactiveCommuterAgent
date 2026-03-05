/* eslint-disable @typescript-eslint/unbound-method */
import axios from 'axios';
import { OverallStatus, Severity, TransportProvider } from '@commuter/shared';
import { DarwinAdapter } from './darwin.adapter';
import {
  darwinAllOnTime,
  darwinWithDelays,
  darwinMostCancelled,
} from './__fixtures__/darwin-responses';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DarwinAdapter', () => {
  let adapter: DarwinAdapter;

  beforeEach(() => {
    adapter = new DarwinAdapter('test-token', 'https://mock-huxley.test');
    jest.clearAllMocks();
  });

  describe('checkRouteStatus', () => {
    it('returns normal status when all services on time', async () => {
      mockedAxios.get.mockResolvedValue({ data: darwinAllOnTime, status: 200 });

      const result = await adapter.checkRouteStatus('SUR', 'WAT');

      expect(result.provider).toBe(TransportProvider.Darwin);
      expect(result.routeKey).toBe('SUR-WAT');
      expect(result.overallStatus).toBe(OverallStatus.Normal);
      expect(result.severity).toBe(Severity.Info);
      expect(result.affectedServices).toHaveLength(0);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://mock-huxley.test/departures/SUR/to/WAT/10',
        expect.any(Object),
      );
    });

    it('returns warning when services are delayed', async () => {
      mockedAxios.get.mockResolvedValue({
        data: darwinWithDelays,
        status: 200,
      });

      const result = await adapter.checkRouteStatus('SUR', 'WAT');

      expect(result.overallStatus).toBe(OverallStatus.MajorDelays);
      expect(result.severity).toBe(Severity.Warning);
      expect(result.affectedServices.length).toBeGreaterThan(0);
      expect(result.summary).toContain('Signal failure');
    });

    it('returns critical when most services cancelled', async () => {
      mockedAxios.get.mockResolvedValue({
        data: darwinMostCancelled,
        status: 200,
      });

      const result = await adapter.checkRouteStatus('SUR', 'WAT');

      expect(result.overallStatus).toBe(OverallStatus.Cancelled);
      expect(result.severity).toBe(Severity.Critical);
      expect(result.summary).toContain('cancelled');
    });

    it('propagates network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(adapter.checkRouteStatus('SUR', 'WAT')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('healthCheck', () => {
    it('returns true when API is reachable', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      const result = await adapter.healthCheck();
      expect(result).toBe(true);
    });

    it('returns false when API is unreachable', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      const result = await adapter.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('checkLineStatus', () => {
    it('returns info-level response (not supported for Darwin)', async () => {
      const result = await adapter.checkLineStatus('piccadilly');
      expect(result.severity).toBe(Severity.Info);
      expect(result.summary).toContain('not supported');
    });
  });
});
