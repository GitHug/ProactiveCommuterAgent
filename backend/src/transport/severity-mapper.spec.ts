import { OverallStatus, Severity } from '@commuter/shared';
import { mapDarwinSeverity, mapTflSeverity } from './severity-mapper';
import { TflStatusSeverity } from './tfl-types';
import {
  darwinAllOnTime,
  darwinWithDelays,
  darwinMostCancelled,
  darwinNoServices,
} from './__fixtures__/darwin-responses';

describe('mapTflSeverity', () => {
  it('maps Good Service to Normal/Info', () => {
    const result = mapTflSeverity(TflStatusSeverity.GoodService);
    expect(result.overallStatus).toBe(OverallStatus.Normal);
    expect(result.severity).toBe(Severity.Info);
  });

  it('maps Minor Delays to MinorDelays/Info', () => {
    const result = mapTflSeverity(TflStatusSeverity.MinorDelays);
    expect(result.overallStatus).toBe(OverallStatus.MinorDelays);
    expect(result.severity).toBe(Severity.Info);
  });

  it('maps Severe Delays to MajorDelays/Warning', () => {
    const result = mapTflSeverity(TflStatusSeverity.SevereDelays);
    expect(result.overallStatus).toBe(OverallStatus.MajorDelays);
    expect(result.severity).toBe(Severity.Warning);
  });

  it('maps Reduced Service to MajorDelays/Warning', () => {
    const result = mapTflSeverity(TflStatusSeverity.ReducedService);
    expect(result.overallStatus).toBe(OverallStatus.MajorDelays);
    expect(result.severity).toBe(Severity.Warning);
  });

  it('maps Part Suspended to PartSuspended/Warning', () => {
    const result = mapTflSeverity(TflStatusSeverity.PartSuspended);
    expect(result.overallStatus).toBe(OverallStatus.PartSuspended);
    expect(result.severity).toBe(Severity.Warning);
  });

  it('maps Suspended to Suspended/Critical', () => {
    const result = mapTflSeverity(TflStatusSeverity.Suspended);
    expect(result.overallStatus).toBe(OverallStatus.Suspended);
    expect(result.severity).toBe(Severity.Critical);
  });

  it('maps Closed to Suspended/Critical', () => {
    const result = mapTflSeverity(TflStatusSeverity.Closed);
    expect(result.overallStatus).toBe(OverallStatus.Suspended);
    expect(result.severity).toBe(Severity.Critical);
  });

  it('maps Planned Closure to Suspended/Critical', () => {
    const result = mapTflSeverity(TflStatusSeverity.PlannedClosure);
    expect(result.overallStatus).toBe(OverallStatus.Suspended);
    expect(result.severity).toBe(Severity.Critical);
  });

  it('maps Bus Service to Suspended/Critical', () => {
    const result = mapTflSeverity(TflStatusSeverity.BusService);
    expect(result.overallStatus).toBe(OverallStatus.Suspended);
    expect(result.severity).toBe(Severity.Critical);
  });

  it('maps Special Service to MinorDelays/Info', () => {
    const result = mapTflSeverity(TflStatusSeverity.SpecialService);
    expect(result.overallStatus).toBe(OverallStatus.MinorDelays);
    expect(result.severity).toBe(Severity.Info);
  });

  it('maps unknown value to Normal/Info', () => {
    const result = mapTflSeverity(99);
    expect(result.overallStatus).toBe(OverallStatus.Normal);
    expect(result.severity).toBe(Severity.Info);
  });
});

describe('mapDarwinSeverity', () => {
  it('returns Normal/Info when all services on time', () => {
    const result = mapDarwinSeverity(darwinAllOnTime);
    expect(result.overallStatus).toBe(OverallStatus.Normal);
    expect(result.severity).toBe(Severity.Info);
    expect(result.summary).toContain('on time');
  });

  it('returns MajorDelays/Warning when most services delayed', () => {
    const result = mapDarwinSeverity(darwinWithDelays);
    expect(result.overallStatus).toBe(OverallStatus.MajorDelays);
    expect(result.severity).toBe(Severity.Warning);
    expect(result.summary).toContain('delayed');
    expect(result.summary).toContain('Signal failure at Clapham Junction');
  });

  it('returns Cancelled/Critical when most services cancelled', () => {
    const result = mapDarwinSeverity(darwinMostCancelled);
    expect(result.overallStatus).toBe(OverallStatus.Cancelled);
    expect(result.severity).toBe(Severity.Critical);
    expect(result.summary).toContain('cancelled');
  });

  it('returns Normal/Info when no services found', () => {
    const result = mapDarwinSeverity(darwinNoServices);
    expect(result.overallStatus).toBe(OverallStatus.Normal);
    expect(result.severity).toBe(Severity.Info);
    expect(result.summary).toContain('No services');
  });
});
