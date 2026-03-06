import {
  AlertDecision,
  AlertType,
  DepartureConfidence,
  OverallStatus,
  Severity,
  TransportProvider,
  TransportStatus,
} from '@commuter/shared';
import { DecisionEngine } from './decision-engine';
import {
  Clock,
  DecisionInput,
  DepartureWindowContext,
  LocationContext,
  PreviousAlert,
  RuleContext,
  UserContext,
} from './decision-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeClock(dateStr: string): Clock {
  return { now: () => new Date(dateStr) };
}

function makeUserContext(overrides?: Partial<UserContext>): UserContext {
  return {
    userId: 'user-1',
    routeId: 'route-1',
    originStation: 'SUR',
    destinationStation: 'WAT',
    routeDisplayName: 'SWR Surbiton to Waterloo',
    ...overrides,
  };
}

function makeDepartureWindow(
  overrides?: Partial<DepartureWindowContext>,
): DepartureWindowContext {
  return {
    medianDepartureTime: '08:03',
    confidence: DepartureConfidence.High,
    dayOfWeek: 1,
    ...overrides,
  };
}

function makeRule(overrides?: Partial<RuleContext>): RuleContext {
  return {
    alertType: AlertType.PreDeparture,
    enabled: true,
    minSeverity: Severity.Warning,
    cooldownMinutes: 60,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00',
    dailyCap: 5,
    ...overrides,
  };
}

function makeTransportStatus(
  overrides?: Partial<TransportStatus>,
): TransportStatus {
  return {
    provider: TransportProvider.Darwin,
    routeKey: 'SUR-WAT',
    checkedAt: '2026-03-05T07:48:00.000Z',
    overallStatus: OverallStatus.MajorDelays,
    severity: Severity.Warning,
    summary:
      'Delays of 15-20 minutes due to signal failure at Clapham Junction.',
    affectedServices: [],
    sourceIncidentId: null,
    expectedResolution: null,
    alternatives: null,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<DecisionInput>): DecisionInput {
  return {
    userContext: makeUserContext(),
    departureWindow: makeDepartureWindow(),
    rule: makeRule(),
    transportStatus: makeTransportStatus(),
    previousAlerts: [],
    alertsSentToday: 0,
    locationContext: { isAtHome: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecisionEngine', () => {
  // Monday 2026-03-09 at 07:48
  const clock = fakeClock('2026-03-09T07:48:00.000Z');
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine(clock);
  });

  // ---- Basic send/suppress ----

  it('sends notification when disruption meets severity threshold', () => {
    const result = engine.evaluate(makeInput());

    expect(result.decision).toBe(AlertDecision.Sent);
    expect(result.notification).not.toBeNull();
    expect(result.notification!.title).toContain('Delays');
    expect(result.notification!.body).toContain('signal failure');
    expect(result.notification!.triggerReason).toContain('08:03');
  });

  it('suppresses when severity is below threshold', () => {
    const result = engine.evaluate(
      makeInput({
        transportStatus: makeTransportStatus({ severity: Severity.Info }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.SuppressedSeverity);
    expect(result.notification).toBeNull();
    expect(result.suppressionReason).toContain('below minimum');
  });

  it('suppresses when alert type is disabled', () => {
    const result = engine.evaluate(
      makeInput({
        rule: makeRule({ enabled: false }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.SuppressedSeverity);
    expect(result.suppressionReason).toContain('disabled');
  });

  // ---- Cooldown ----

  it('suppresses within cooldown period', () => {
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning,
        summary: 'Previous delay',
        sourceIncidentId: null,
        sentAt: new Date('2026-03-09T07:40:00.000Z'), // 8 min ago
      },
    ];

    const result = engine.evaluate(makeInput({ previousAlerts }));

    expect(result.decision).toBe(AlertDecision.SuppressedCooldown);
    expect(result.suppressionReason).toContain('Cooldown');
  });

  it('allows alert after cooldown expires', () => {
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning,
        summary: 'Previous delay',
        sourceIncidentId: null,
        sentAt: new Date('2026-03-09T06:00:00.000Z'), // 108 min ago
      },
    ];

    const result = engine.evaluate(makeInput({ previousAlerts }));

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  it('allows escalation to override cooldown', () => {
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning, // previous was warning
        summary: 'Minor delay',
        sourceIncidentId: null,
        sentAt: new Date('2026-03-09T07:41:00.000Z'), // 7 min ago
      },
    ];

    const result = engine.evaluate(
      makeInput({
        previousAlerts,
        transportStatus: makeTransportStatus({
          severity: Severity.Critical, // now critical = escalation
          overallStatus: OverallStatus.Cancelled,
          summary: '3/4 services cancelled due to signal failure.',
        }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.Sent);
    expect(result.notification!.title).toContain('Major disruption');
  });

  it('does not override cooldown when severity is same', () => {
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning,
        summary: 'Same severity delay',
        sourceIncidentId: null,
        sentAt: new Date('2026-03-09T07:41:00.000Z'), // 7 min ago
      },
    ];

    const result = engine.evaluate(makeInput({ previousAlerts }));

    expect(result.decision).toBe(AlertDecision.SuppressedCooldown);
  });

  // ---- Deduplication ----

  it('suppresses duplicate by incident ID', () => {
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning,
        summary: 'Different text',
        sourceIncidentId: 'darwin-12345',
        sentAt: new Date('2026-03-09T06:00:00.000Z'), // outside cooldown
      },
    ];

    const result = engine.evaluate(
      makeInput({
        previousAlerts,
        transportStatus: makeTransportStatus({
          sourceIncidentId: 'darwin-12345',
        }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.SuppressedDuplicate);
    expect(result.suppressionReason).toContain('incident ID');
  });

  it('suppresses duplicate by identical summary', () => {
    const summary =
      'Delays of 15-20 minutes due to signal failure at Clapham Junction.';
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning,
        summary,
        sourceIncidentId: null,
        sentAt: new Date('2026-03-09T06:00:00.000Z'), // outside cooldown
      },
    ];

    const result = engine.evaluate(
      makeInput({
        previousAlerts,
        transportStatus: makeTransportStatus({ summary }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.SuppressedDuplicate);
    expect(result.suppressionReason).toContain('summary');
  });

  it('sends when summary text differs', () => {
    const previousAlerts: PreviousAlert[] = [
      {
        alertId: 'prev-1',
        alertType: AlertType.PreDeparture,
        severity: Severity.Warning,
        summary: 'Old disruption text',
        sourceIncidentId: null,
        sentAt: new Date('2026-03-09T06:00:00.000Z'),
      },
    ];

    const result = engine.evaluate(makeInput({ previousAlerts }));

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  // ---- Daily cap ----

  it('suppresses when daily cap is reached', () => {
    const result = engine.evaluate(makeInput({ alertsSentToday: 5 }));

    expect(result.decision).toBe(AlertDecision.SuppressedCap);
    expect(result.suppressionReason).toContain('cap');
  });

  it('allows critical alerts to override daily cap', () => {
    const result = engine.evaluate(
      makeInput({
        alertsSentToday: 5,
        transportStatus: makeTransportStatus({
          severity: Severity.Critical,
          overallStatus: OverallStatus.Suspended,
          summary: 'Full suspension.',
        }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  it('allows alert when under daily cap', () => {
    const result = engine.evaluate(makeInput({ alertsSentToday: 4 }));

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  // ---- Quiet hours ----

  it('suppresses during quiet hours (overnight range)', () => {
    const lateEngine = new DecisionEngine(
      fakeClock('2026-03-09T23:30:00.000Z'),
    );

    const result = lateEngine.evaluate(makeInput());

    expect(result.decision).toBe(AlertDecision.SuppressedQuiet);
    expect(result.suppressionReason).toContain('Quiet hours');
  });

  it('suppresses during quiet hours (early morning)', () => {
    const earlyEngine = new DecisionEngine(
      fakeClock('2026-03-09T05:30:00.000Z'),
    );

    const result = earlyEngine.evaluate(makeInput());

    expect(result.decision).toBe(AlertDecision.SuppressedQuiet);
  });

  it('allows critical alerts during quiet hours', () => {
    const lateEngine = new DecisionEngine(
      fakeClock('2026-03-09T23:30:00.000Z'),
    );

    const result = lateEngine.evaluate(
      makeInput({
        transportStatus: makeTransportStatus({
          severity: Severity.Critical,
          summary: 'Full line suspension.',
        }),
      }),
    );

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  it('allows alert outside quiet hours', () => {
    const result = engine.evaluate(makeInput()); // 07:48 is outside 22:00-06:00

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  // ---- Actionability ----

  it('suppresses pre-departure when user is at home past departure time', () => {
    // Clock is 09:30, departure is 08:03, user still at home
    const lateEngine = new DecisionEngine(
      fakeClock('2026-03-09T09:30:00.000Z'),
    );
    const locationContext: LocationContext = { isAtHome: true };

    const result = lateEngine.evaluate(makeInput({ locationContext }));

    expect(result.decision).toBe(AlertDecision.SuppressedActionability);
    expect(result.suppressionReason).toContain('WFH');
  });

  it('sends pre-departure when user has left home', () => {
    const locationContext: LocationContext = { isAtHome: false };

    const result = engine.evaluate(makeInput({ locationContext }));

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  it('sends when location is unknown', () => {
    const locationContext: LocationContext = { isAtHome: null };

    const result = engine.evaluate(makeInput({ locationContext }));

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  it('sends pre-departure when still within departure window', () => {
    // Clock is 07:48, departure is 08:03, user at home but hasn't left yet (normal)
    const locationContext: LocationContext = { isAtHome: true };

    const result = engine.evaluate(makeInput({ locationContext }));

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  it('does not apply actionability check to morning summary', () => {
    const lateEngine = new DecisionEngine(
      fakeClock('2026-03-09T09:30:00.000Z'),
    );

    const result = lateEngine.evaluate(
      makeInput({
        rule: makeRule({ alertType: AlertType.MorningSummary }),
        locationContext: { isAtHome: true },
      }),
    );

    expect(result.decision).toBe(AlertDecision.Sent);
  });

  // ---- Notification content ----

  it('generates pre-departure notification with explainability', () => {
    const result = engine.evaluate(makeInput());

    expect(result.notification!.title).toBe(
      'Delays on SWR Surbiton to Waterloo',
    );
    expect(result.notification!.body).toContain('signal failure');
    expect(result.notification!.triggerReason).toContain('Monday');
    expect(result.notification!.triggerReason).toContain('08:03');
    expect(result.notification!.triggerReason).toContain('SUR to WAT');
  });

  it('generates critical notification title', () => {
    const result = engine.evaluate(
      makeInput({
        transportStatus: makeTransportStatus({
          severity: Severity.Critical,
          summary: 'All services cancelled.',
        }),
      }),
    );

    expect(result.notification!.title).toBe(
      'Major disruption: SWR Surbiton to Waterloo',
    );
  });

  it('generates engineering works notification', () => {
    const result = engine.evaluate(
      makeInput({
        rule: makeRule({ alertType: AlertType.EngineeringWorks }),
        transportStatus: makeTransportStatus({
          severity: Severity.Critical,
          summary: 'No trains on Saturday due to engineering works.',
          alternatives: 'Rail replacement bus available.',
        }),
      }),
    );

    expect(result.notification!.title).toContain('Engineering works');
    expect(result.notification!.body).toContain('Rail replacement bus');
  });

  // ---- Plan scenarios (Section 6.9) ----

  describe('Plan Scenario 1: Normal commute day with delay', () => {
    it('sends alert for SWR delay 15 min before departure', () => {
      const result = engine.evaluate(makeInput());

      expect(result.decision).toBe(AlertDecision.Sent);
      expect(result.notification!.body).toContain('signal failure');
    });
  });

  describe('Plan Scenario 2: WFH day, disruption suppressed', () => {
    it('suppresses when user is still at home past departure', () => {
      const lateEngine = new DecisionEngine(
        fakeClock('2026-03-09T09:30:00.000Z'),
      );

      const result = lateEngine.evaluate(
        makeInput({
          locationContext: { isAtHome: true },
          transportStatus: makeTransportStatus({
            severity: Severity.Critical,
            summary: 'SWR cancellations on the Surbiton-Waterloo route.',
          }),
        }),
      );

      expect(result.decision).toBe(AlertDecision.SuppressedActionability);
    });
  });

  describe('Plan Scenario 4: Rapid succession alerts (anti-spam)', () => {
    it('sends first alert, suppresses same-severity repeat, allows escalation', () => {
      // First alert at 07:48 - should send
      const result1 = engine.evaluate(makeInput());
      expect(result1.decision).toBe(AlertDecision.Sent);

      // 07:55 - same severity, within cooldown - should suppress
      const engine2 = new DecisionEngine(fakeClock('2026-03-09T07:55:00.000Z'));
      const result2 = engine2.evaluate(
        makeInput({
          previousAlerts: [
            {
              alertId: 'sent-1',
              alertType: AlertType.PreDeparture,
              severity: Severity.Warning,
              summary:
                'Delays of 15-20 minutes due to signal failure at Clapham Junction.',
              sourceIncidentId: null,
              sentAt: new Date('2026-03-09T07:48:00.000Z'),
            },
          ],
        }),
      );
      expect(result2.decision).toBe(AlertDecision.SuppressedCooldown);

      // 07:55 - escalation to critical, within cooldown but overrides
      const result3 = engine2.evaluate(
        makeInput({
          previousAlerts: [
            {
              alertId: 'sent-1',
              alertType: AlertType.PreDeparture,
              severity: Severity.Warning,
              summary: 'Delays of 15-20 minutes.',
              sourceIncidentId: null,
              sentAt: new Date('2026-03-09T07:48:00.000Z'),
            },
          ],
          transportStatus: makeTransportStatus({
            severity: Severity.Critical,
            summary: 'Major delays, 20+ min. Service significantly disrupted.',
          }),
        }),
      );
      expect(result3.decision).toBe(AlertDecision.Sent);
      expect(result3.notification!.title).toContain('Major disruption');
    });
  });
});
