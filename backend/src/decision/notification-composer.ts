import { AlertType, OverallStatus, Severity } from '@commuter/shared';
import { Clock, DecisionInput, NotificationContent } from './decision-types';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function composeNotification(
  input: DecisionInput,
  clock: Clock,
): NotificationContent {
  const { userContext, rule } = input;

  switch (rule.alertType) {
    case AlertType.PreDeparture:
      return composePreDeparture(input, clock);
    case AlertType.MorningSummary:
      return composeMorningSummary(input, clock);
    case AlertType.EngineeringWorks:
      return composeEngineeringWorks(input);
    case AlertType.MajorDisruption:
      return composeMajorDisruption(input);
    default:
      return {
        title: `Disruption on ${userContext.routeDisplayName}`,
        body: input.transportStatus.summary,
        triggerReason: `Alert for ${userContext.originStation}-${userContext.destinationStation}.`,
      };
  }
}

function composePreDeparture(
  input: DecisionInput,
  clock: Clock,
): NotificationContent {
  const { userContext, departureWindow, transportStatus } = input;
  const route = `${userContext.originStation} to ${userContext.destinationStation}`;
  const dayName = DAY_NAMES[clock.now().getDay()];

  const title = severityTitle(
    transportStatus.severity,
    userContext.routeDisplayName,
  );
  const body = transportStatus.summary;

  const triggerReason =
    `Your usual ${dayName} departure is around ${departureWindow.medianDepartureTime}. ` +
    `We checked your route (${route}) at ${formatTime(clock.now())} and found: ${transportStatus.summary}`;

  return { title, body, triggerReason };
}

function composeMorningSummary(
  input: DecisionInput,
  clock: Clock,
): NotificationContent {
  const { userContext, transportStatus } = input;
  const route = `${userContext.originStation} to ${userContext.destinationStation}`;

  const title = severityTitle(
    transportStatus.severity,
    userContext.routeDisplayName,
  );
  const body = transportStatus.summary;

  const triggerReason =
    `Your morning route check at ${formatTime(clock.now())} found: ${transportStatus.summary} ` +
    `Route: ${route}.`;

  return { title, body, triggerReason };
}

function composeEngineeringWorks(input: DecisionInput): NotificationContent {
  const { userContext, transportStatus } = input;
  const route = `${userContext.originStation} to ${userContext.destinationStation}`;

  const title = `Engineering works: ${userContext.routeDisplayName}`;
  const body = transportStatus.summary;

  const triggerReason = `Planned engineering works affecting your route (${route}): ${transportStatus.summary}`;

  if (transportStatus.alternatives) {
    return {
      title,
      body: `${body} ${transportStatus.alternatives}`,
      triggerReason,
    };
  }

  return { title, body, triggerReason };
}

function composeMajorDisruption(input: DecisionInput): NotificationContent {
  const { userContext, transportStatus } = input;

  const title = `${userContext.routeDisplayName}: ${statusLabel(transportStatus.overallStatus)}`;
  const body = transportStatus.summary;

  const triggerReason =
    `Major disruption detected on your route ` +
    `(${userContext.originStation}-${userContext.destinationStation}): ${transportStatus.summary}`;

  return { title, body, triggerReason };
}

function severityTitle(severity: Severity, routeName: string): string {
  switch (severity) {
    case Severity.Critical:
      return `Major disruption: ${routeName}`;
    case Severity.Warning:
      return `Delays on ${routeName}`;
    case Severity.Info:
      return `${routeName}: minor issue`;
  }
}

function statusLabel(status: OverallStatus): string {
  switch (status) {
    case OverallStatus.Suspended:
      return 'Suspended';
    case OverallStatus.Cancelled:
      return 'Cancelled';
    case OverallStatus.PartSuspended:
      return 'Part Suspended';
    case OverallStatus.MajorDelays:
      return 'Major Delays';
    case OverallStatus.MinorDelays:
      return 'Minor Delays';
    case OverallStatus.Normal:
      return 'Good Service';
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
