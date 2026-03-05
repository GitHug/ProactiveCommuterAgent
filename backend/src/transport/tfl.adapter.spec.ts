/* eslint-disable @typescript-eslint/unbound-method */
import axios from 'axios';
import { OverallStatus, Severity, TransportProvider } from '@commuter/shared';
import { TflAdapter } from './tfl.adapter';
import {
  tflGoodService,
  tflMinorDelays,
  tflSevereDelays,
  tflPartSuspended,
  tflSuspended,
  tflPlannedClosure,
} from './__fixtures__/tfl-responses';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TflAdapter', () => {
  let adapter: TflAdapter;

  beforeEach(() => {
    adapter = new TflAdapter('test-api-key', 'https://mock-tfl.test');
    jest.clearAllMocks();
  });

  describe('checkLineStatus', () => {
    it('returns Normal/Info for Good Service', async () => {
      mockedAxios.get.mockResolvedValue({ data: tflGoodService, status: 200 });

      const result = await adapter.checkLineStatus('piccadilly');

      expect(result.provider).toBe(TransportProvider.Tfl);
      expect(result.routeKey).toBe('piccadilly');
      expect(result.overallStatus).toBe(OverallStatus.Normal);
      expect(result.severity).toBe(Severity.Info);
      expect(result.summary).toContain('Good Service');
      expect(result.affectedServices).toHaveLength(0);
    });

    it('returns MinorDelays/Info for Minor Delays', async () => {
      mockedAxios.get.mockResolvedValue({ data: tflMinorDelays, status: 200 });

      const result = await adapter.checkLineStatus('piccadilly');

      expect(result.overallStatus).toBe(OverallStatus.MinorDelays);
      expect(result.severity).toBe(Severity.Info);
      expect(result.summary).toContain('Minor Delays');
    });

    it('returns MajorDelays/Warning for Severe Delays', async () => {
      mockedAxios.get.mockResolvedValue({ data: tflSevereDelays, status: 200 });

      const result = await adapter.checkLineStatus('central');

      expect(result.overallStatus).toBe(OverallStatus.MajorDelays);
      expect(result.severity).toBe(Severity.Warning);
      expect(result.summary).toContain('Severe Delays');
    });

    it('returns PartSuspended/Warning for Part Suspended', async () => {
      mockedAxios.get.mockResolvedValue({
        data: tflPartSuspended,
        status: 200,
      });

      const result = await adapter.checkLineStatus('piccadilly');

      expect(result.overallStatus).toBe(OverallStatus.PartSuspended);
      expect(result.severity).toBe(Severity.Warning);
      expect(result.affectedServices.length).toBeGreaterThan(0);
    });

    it('returns Suspended/Critical for full suspension', async () => {
      mockedAxios.get.mockResolvedValue({ data: tflSuspended, status: 200 });

      const result = await adapter.checkLineStatus('victoria');

      expect(result.overallStatus).toBe(OverallStatus.Suspended);
      expect(result.severity).toBe(Severity.Critical);
      expect(result.summary).toContain('Suspended');
    });

    it('returns Suspended/Critical for Planned Closure', async () => {
      mockedAxios.get.mockResolvedValue({
        data: tflPlannedClosure,
        status: 200,
      });

      const result = await adapter.checkLineStatus('northern');

      expect(result.overallStatus).toBe(OverallStatus.Suspended);
      expect(result.severity).toBe(Severity.Critical);
      expect(result.summary).toContain('Planned Closure');
    });

    it('passes API key as query parameter', async () => {
      mockedAxios.get.mockResolvedValue({ data: tflGoodService, status: 200 });

      await adapter.checkLineStatus('piccadilly');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://mock-tfl.test/Line/piccadilly/Status',
        expect.objectContaining({
          params: { app_key: 'test-api-key' },
        }),
      );
    });

    it('propagates network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('timeout'));

      await expect(adapter.checkLineStatus('piccadilly')).rejects.toThrow(
        'timeout',
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
});
