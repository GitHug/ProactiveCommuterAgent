import { AlertDecision, AlertType, Severity } from '@commuter/shared';
import {
  Clock,
  DecisionInput,
  DecisionOutput,
  systemClock,
} from './decision-types';
import { composeNotification } from './notification-composer';

const SEVERITY_RANK: Record<Severity, number> = {
  [Severity.Info]: 0,
  [Severity.Warning]: 1,
  [Severity.Critical]: 2,
};

export class DecisionEngine {
  private readonly clock: Clock;

  constructor(clock?: Clock) {
    this.clock = clock ?? systemClock;
  }

  evaluate(input: DecisionInput): DecisionOutput {
    const {
      rule,
      transportStatus,
      previousAlerts,
      alertsSentToday,
      locationContext,
    } = input;

    // Step 1: Check if rule is enabled
    if (!rule.enabled) {
      return this.suppress(
        AlertDecision.SuppressedSeverity,
        'Alert type is disabled.',
      );
    }

    // Step 2-3: Check severity threshold
    const statusSeverity = transportStatus.severity;
    if (SEVERITY_RANK[statusSeverity] < SEVERITY_RANK[rule.minSeverity]) {
      return this.suppress(
        AlertDecision.SuppressedSeverity,
        `Severity ${statusSeverity} is below minimum threshold ${rule.minSeverity}.`,
      );
    }

    // Step 4: Check cooldown (with escalation override)
    const cooldownResult = this.checkCooldown(input, previousAlerts);
    if (cooldownResult) {
      return cooldownResult;
    }

    // Step 5: Check deduplication
    const dedupResult = this.checkDeduplication(
      transportStatus.summary,
      transportStatus.sourceIncidentId,
      previousAlerts,
    );
    if (dedupResult) {
      return dedupResult;
    }

    // Step 6: Check daily cap
    if (
      alertsSentToday >= rule.dailyCap &&
      statusSeverity !== Severity.Critical
    ) {
      return this.suppress(
        AlertDecision.SuppressedCap,
        `Daily cap of ${rule.dailyCap} reached. Only critical alerts override.`,
      );
    }

    // Step 7: Check quiet hours
    const quietResult = this.checkQuietHours(
      rule.quietHoursStart,
      rule.quietHoursEnd,
      statusSeverity,
    );
    if (quietResult) {
      return quietResult;
    }

    // Step 8: Check actionability (pre-departure only)
    if (rule.alertType === AlertType.PreDeparture) {
      const actionResult = this.checkActionability(input, locationContext);
      if (actionResult) {
        return actionResult;
      }
    }

    // Step 9: Compose and send
    const notification = composeNotification(input, this.clock);

    return {
      decision: AlertDecision.Sent,
      suppressionReason: null,
      notification,
    };
  }

  private checkCooldown(
    input: DecisionInput,
    previousAlerts: DecisionInput['previousAlerts'],
  ): DecisionOutput | null {
    const { rule, transportStatus } = input;
    const now = this.clock.now();

    const recentSameType = previousAlerts.find(
      (a) =>
        a.alertType === rule.alertType &&
        now.getTime() - a.sentAt.getTime() < rule.cooldownMinutes * 60_000,
    );

    if (!recentSameType) {
      return null; // No cooldown violation
    }

    // Allow escalation override: if current severity is higher than previous
    if (
      SEVERITY_RANK[transportStatus.severity] >
      SEVERITY_RANK[recentSameType.severity]
    ) {
      return null; // Escalation overrides cooldown
    }

    return this.suppress(
      AlertDecision.SuppressedCooldown,
      `Cooldown active: last ${rule.alertType} alert was ${Math.round((now.getTime() - recentSameType.sentAt.getTime()) / 60_000)} min ago. Cooldown is ${rule.cooldownMinutes} min.`,
    );
  }

  private checkDeduplication(
    summary: string,
    sourceIncidentId: string | null,
    previousAlerts: DecisionInput['previousAlerts'],
  ): DecisionOutput | null {
    if (previousAlerts.length === 0) {
      return null;
    }

    const lastAlert = previousAlerts[0]; // Assume sorted most recent first

    // Check by incident ID if available
    if (sourceIncidentId && lastAlert.sourceIncidentId === sourceIncidentId) {
      return this.suppress(
        AlertDecision.SuppressedDuplicate,
        `Duplicate: same incident ID ${sourceIncidentId} as last alert.`,
      );
    }

    // Check by summary text
    if (lastAlert.summary === summary) {
      return this.suppress(
        AlertDecision.SuppressedDuplicate,
        'Duplicate: identical summary text as last alert.',
      );
    }

    return null;
  }

  private checkQuietHours(
    quietStart: string,
    quietEnd: string,
    severity: Severity,
  ): DecisionOutput | null {
    if (severity === Severity.Critical) {
      return null; // Critical always goes through
    }

    const now = this.clock.now();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this.parseTime(quietStart);
    const endMinutes = this.parseTime(quietEnd);

    let inQuietHours: boolean;
    if (startMinutes <= endMinutes) {
      // Same-day range (e.g., 01:00 - 05:00)
      inQuietHours =
        currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range (e.g., 22:00 - 06:00)
      inQuietHours =
        currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    if (inQuietHours) {
      return this.suppress(
        AlertDecision.SuppressedQuiet,
        `Quiet hours (${quietStart}-${quietEnd}). Only critical alerts override.`,
      );
    }

    return null;
  }

  private checkActionability(
    input: DecisionInput,
    locationContext: DecisionInput['locationContext'],
  ): DecisionOutput | null {
    // If we don't know location, don't suppress
    if (locationContext.isAtHome === null) {
      return null;
    }

    // If user is still at home and departure time has passed, they're likely WFH
    if (locationContext.isAtHome) {
      const now = this.clock.now();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const departureMinutes = this.parseTime(
        input.departureWindow.medianDepartureTime,
      );

      if (currentMinutes > departureMinutes + 30) {
        return this.suppress(
          AlertDecision.SuppressedActionability,
          `User appears to be at home ${currentMinutes - departureMinutes} min past usual departure time. Likely WFH.`,
        );
      }
    }

    return null;
  }

  private parseTime(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private suppress(decision: AlertDecision, reason: string): DecisionOutput {
    return {
      decision,
      suppressionReason: reason,
      notification: null,
    };
  }
}
