import { OverallStatus, Severity } from '@commuter/shared';
import { HuxleyDepartureBoard, HuxleyTrainService } from './darwin-types';
import { TflStatusSeverity } from './tfl-types';

/**
 * Map TfL statusSeverity number to internal severity.
 */
export function mapTflSeverity(statusSeverity: TflStatusSeverity): {
  overallStatus: OverallStatus;
  severity: Severity;
} {
  switch (statusSeverity) {
    case TflStatusSeverity.GoodService:
      return { overallStatus: OverallStatus.Normal, severity: Severity.Info };

    case TflStatusSeverity.MinorDelays:
    case TflStatusSeverity.ChangeOfFrequency:
      return {
        overallStatus: OverallStatus.MinorDelays,
        severity: Severity.Info,
      };

    case TflStatusSeverity.SevereDelays:
    case TflStatusSeverity.ReducedService:
      return {
        overallStatus: OverallStatus.MajorDelays,
        severity: Severity.Warning,
      };

    case TflStatusSeverity.PartSuspended:
    case TflStatusSeverity.PartClosure:
    case TflStatusSeverity.PartClosed:
      return {
        overallStatus: OverallStatus.PartSuspended,
        severity: Severity.Warning,
      };

    case TflStatusSeverity.Suspended:
    case TflStatusSeverity.Closed:
      return {
        overallStatus: OverallStatus.Suspended,
        severity: Severity.Critical,
      };

    case TflStatusSeverity.PlannedClosure:
      return {
        overallStatus: OverallStatus.Suspended,
        severity: Severity.Critical,
      };

    case TflStatusSeverity.BusService:
      return {
        overallStatus: OverallStatus.Suspended,
        severity: Severity.Critical,
      };

    case TflStatusSeverity.SpecialService:
      return {
        overallStatus: OverallStatus.MinorDelays,
        severity: Severity.Info,
      };

    default:
      return { overallStatus: OverallStatus.Normal, severity: Severity.Info };
  }
}

/**
 * Analyse a Huxley departure board response and derive overall status/severity.
 */
export function mapDarwinSeverity(board: HuxleyDepartureBoard): {
  overallStatus: OverallStatus;
  severity: Severity;
  summary: string;
} {
  const services = board.trainServices ?? [];
  if (services.length === 0) {
    return {
      overallStatus: OverallStatus.Normal,
      severity: Severity.Info,
      summary: 'No services found for this route.',
    };
  }

  const cancelled = services.filter((s) => s.isCancelled);
  const delayed = services.filter((s) => !s.isCancelled && isDelayed(s));
  const total = services.length;

  const cancelledRatio = cancelled.length / total;
  const delayedRatio = delayed.length / total;

  // All or most cancelled
  if (cancelledRatio >= 0.5) {
    const reason = findMostCommonReason(cancelled, 'cancelReason');
    return {
      overallStatus: OverallStatus.Cancelled,
      severity: Severity.Critical,
      summary: `${cancelled.length}/${total} services cancelled${reason ? `: ${reason}` : ''}.`,
    };
  }

  // Some cancelled (but not majority)
  if (cancelledRatio >= 0.2) {
    const reason = findMostCommonReason(cancelled, 'cancelReason');
    return {
      overallStatus: OverallStatus.MajorDelays,
      severity: Severity.Critical,
      summary: `${cancelled.length}/${total} services cancelled, ${delayed.length} delayed${reason ? `. Reason: ${reason}` : ''}.`,
    };
  }

  // Major delays (many services delayed or large aggregate delay)
  if (delayedRatio >= 0.5 || board.totalDelayMinutes > 30) {
    const reason = findMostCommonReason(delayed, 'delayReason');
    return {
      overallStatus: OverallStatus.MajorDelays,
      severity: Severity.Warning,
      summary: `${delayed.length}/${total} services delayed (${board.totalDelayMinutes} min total)${reason ? `. Reason: ${reason}` : ''}.`,
    };
  }

  // Some delays
  if (delayed.length > 0 || cancelled.length > 0) {
    const parts: string[] = [];
    if (delayed.length > 0) parts.push(`${delayed.length} delayed`);
    if (cancelled.length > 0) parts.push(`${cancelled.length} cancelled`);
    const reason = findMostCommonReason(
      [...delayed, ...cancelled],
      delayed.length > 0 ? 'delayReason' : 'cancelReason',
    );
    return {
      overallStatus: OverallStatus.MinorDelays,
      severity:
        delayed.length >= 2 || cancelled.length >= 1
          ? Severity.Warning
          : Severity.Info,
      summary: `${parts.join(', ')} out of ${total} services${reason ? `. Reason: ${reason}` : ''}.`,
    };
  }

  // All good
  return {
    overallStatus: OverallStatus.Normal,
    severity: Severity.Info,
    summary: `All ${total} services running on time.`,
  };
}

function isDelayed(service: HuxleyTrainService): boolean {
  const etd = service.etd?.toLowerCase();
  if (!etd) return false;
  if (etd === 'on time') return false;
  if (etd === 'cancelled') return false;
  if (etd === 'delayed') return true;
  // If etd is a time different from std, it's delayed
  if (service.std && etd !== service.std.toLowerCase()) return true;
  return false;
}

function findMostCommonReason(
  services: HuxleyTrainService[],
  field: 'cancelReason' | 'delayReason',
): string | null {
  const reasons = services
    .map((s) => s[field])
    .filter((r): r is string => r != null && r.length > 0);

  if (reasons.length === 0) return null;

  const counts = new Map<string, number>();
  for (const r of reasons) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  let maxCount = 0;
  let maxReason = '';
  for (const [reason, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxReason = reason;
    }
  }

  return maxReason || null;
}
