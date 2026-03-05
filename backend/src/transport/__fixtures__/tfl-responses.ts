import { TflLineResponse } from '../tfl-types';

export const tflGoodService: TflLineResponse[] = [
  {
    id: 'piccadilly',
    name: 'Piccadilly',
    modeName: 'tube',
    lineStatuses: [
      {
        statusSeverity: 10,
        statusSeverityDescription: 'Good Service',
        validityPeriods: [],
      },
    ],
  },
];

export const tflMinorDelays: TflLineResponse[] = [
  {
    id: 'piccadilly',
    name: 'Piccadilly',
    modeName: 'tube',
    lineStatuses: [
      {
        statusSeverity: 9,
        statusSeverityDescription: 'Minor Delays',
        reason:
          'Piccadilly line: Minor delays due to an earlier signal failure at Hammersmith.',
        validityPeriods: [
          {
            fromDate: '2026-03-05T06:00:00Z',
            toDate: '2026-03-05T23:59:00Z',
            isNow: true,
          },
        ],
      },
    ],
  },
];

export const tflSevereDelays: TflLineResponse[] = [
  {
    id: 'central',
    name: 'Central',
    modeName: 'tube',
    lineStatuses: [
      {
        statusSeverity: 6,
        statusSeverityDescription: 'Severe Delays',
        reason:
          'Central line: Severe delays due to a person ill on a train at Oxford Circus. Tickets accepted on local buses.',
        validityPeriods: [
          {
            fromDate: '2026-03-05T07:30:00Z',
            toDate: '2026-03-05T23:59:00Z',
            isNow: true,
          },
        ],
      },
    ],
  },
];

export const tflPartSuspended: TflLineResponse[] = [
  {
    id: 'piccadilly',
    name: 'Piccadilly',
    modeName: 'tube',
    lineStatuses: [
      {
        statusSeverity: 3,
        statusSeverityDescription: 'Part Suspended',
        reason:
          'Piccadilly line: No service between Hammersmith and Heathrow Terminal 5 due to a signal failure. Tickets accepted on the Elizabeth line.',
        validityPeriods: [
          {
            fromDate: '2026-03-05T06:00:00Z',
            toDate: '2026-03-05T23:59:00Z',
            isNow: true,
          },
        ],
      },
      {
        statusSeverity: 9,
        statusSeverityDescription: 'Minor Delays',
        reason:
          'Piccadilly line: Minor delays on the rest of the line due to the part suspension.',
        validityPeriods: [
          {
            fromDate: '2026-03-05T06:00:00Z',
            toDate: '2026-03-05T23:59:00Z',
            isNow: true,
          },
        ],
      },
    ],
  },
];

export const tflSuspended: TflLineResponse[] = [
  {
    id: 'victoria',
    name: 'Victoria',
    modeName: 'tube',
    lineStatuses: [
      {
        statusSeverity: 2,
        statusSeverityDescription: 'Suspended',
        reason:
          'Victoria line: Suspended due to a safety incident. Use alternative routes.',
        validityPeriods: [
          {
            fromDate: '2026-03-05T08:00:00Z',
            toDate: '2026-03-05T23:59:00Z',
            isNow: true,
          },
        ],
      },
    ],
  },
];

export const tflPlannedClosure: TflLineResponse[] = [
  {
    id: 'northern',
    name: 'Northern',
    modeName: 'tube',
    lineStatuses: [
      {
        statusSeverity: 4,
        statusSeverityDescription: 'Planned Closure',
        reason:
          'Northern line: No service on Saturday 8 and Sunday 9 March due to planned engineering works.',
        validityPeriods: [
          {
            fromDate: '2026-03-08T00:00:00Z',
            toDate: '2026-03-09T23:59:00Z',
            isNow: false,
          },
        ],
      },
    ],
  },
];
