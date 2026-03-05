# Proactive Commuter Agent -- Technical Plan

## 1. Product Summary

### What the app is

Proactive Commuter Agent is a mobile application that monitors a user's commute routes and proactively sends timely notifications about transport disruptions, delays, cancellations, and planned engineering works -- before the user needs to check manually. It combines location awareness, departure-time learning, calendar integration, and real-time UK transport data to deliver alerts at the moment they are most useful.

### Who it is for

UK-based commuters who rely on trains (National Rail, TfL rail services), the London Underground, DLR, buses, or trams. The primary user persona is someone with a regular weekday commute who occasionally travels on weekends and wants to stop manually checking apps like Trainline, National Rail Enquiries, or TfL every morning.

### Why it is valuable

Existing transport apps are reactive: you open them, search your route, and check. This app inverts that model. It tells you what you need to know, when you need to know it, without you lifting a finger. The value is time saved, stress reduced, and earlier awareness of problems so the user can adapt (leave earlier, take an alternative route, work from home).

### What makes it hard / defensible

- **Timing is everything.** Alerting 15 minutes before departure requires combining learned behaviour, live transport data, and reliable notification delivery -- across two mobile platforms with aggressive background execution limits.
- **Signal-to-noise ratio.** Most transport apps over-notify. Getting the anti-spam logic right -- only alerting when it is genuinely actionable -- is a product-design challenge, not just a technical one.
- **Multi-source data normalisation.** UK transport data is fragmented across Darwin, TfL, Network Rail, and commercial aggregators, each with different formats, reliability characteristics, and rate limits.
- **Trust.** If the app sends one wrong alert or misses a real disruption, users lose trust quickly. The bar for reliability is high.

---

## 2. MVP Scope (In/Out)

### Features in v1

| Feature | Detail |
|---|---|
| **Place registration** | User manually sets Home and Office locations (map pin or address search) |
| **Single commute route** | User configures one primary commute route (origin station, destination station, optional via) |
| **Departure-window learning** | App observes when the user leaves Home on weekdays and builds a per-weekday departure window (rolling median) |
| **Pre-departure transport check** | 15 minutes before learned departure time, backend checks route status and sends push notification if disruption detected |
| **Morning summary alert** | At a configurable time (default 06:30), backend checks for major disruptions or cancellations on the user's route and sends a summary if anything is wrong |
| **Engineering works alert** | Night before (default 20:00) or morning of a weekend/bank holiday, alert if planned engineering works affect the user's route |
| **Notification history** | In-app screen showing past alerts with "why this alert" explanation |
| **Manual route check** | User can open the app and see current status of their configured route at any time |
| **Basic anti-spam** | Cooldown periods, severity thresholds, deduplication |
| **Privacy controls** | View what data is stored, delete all data, opt out of location learning |

### Explicitly out of scope for v1

- Multiple commute routes or multi-leg journeys
- Calendar integration (deferred to v2)
- Weather-based alerts
- Traffic / driving directions
- Social features or route sharing
- AI/ML-based predictions beyond deterministic heuristics
- Bus-only or tram-only routes (focus on rail for MVP)
- Automatic route inference (user must configure their route)
- Widget / watch complications
- Multi-language support

### Assumptions for v1

- The user has a broadly regular weekday commute schedule
- The user travels by train (National Rail or TfL rail) for at least part of their commute
- The user is willing to grant location permission (at least "while using" for initial setup, ideally "always" for departure learning)
- The user has a stable internet connection on their phone
- Backend infrastructure is acceptable (not purely on-device)
- A single backend timezone (Europe/London) is sufficient

### MVP success criteria

1. User receives a useful, accurate pre-departure alert on 80%+ of disrupted commute days within the first two weeks of use.
2. False positive rate (alert sent but no real disruption) is below 10%.
3. User does not receive more than 3 notifications per day on a normal commute day.
4. User can go from install to first useful alert within 5 minutes of setup.
5. Battery impact is negligible (less than 2% daily drain attributable to the app).

---

## 3. Architecture Options Comparison

### Option A: Mostly On-Device

The app runs all logic on the phone. It uses background tasks to periodically check transport APIs, applies notification logic locally, and fires local notifications.

| Dimension | Assessment |
|---|---|
| **Reliability of proactive alerts** | Poor. iOS BGTaskScheduler provides no timing guarantees. A check scheduled for 07:48 might run at 08:15 or not at all. Android WorkManager has a 15-minute minimum period and is subject to Doze mode. The core product promise (timely pre-departure alerts) cannot be reliably met. |
| **Battery impact** | Moderate. Frequent location checks and network requests from the foreground/background will drain battery, especially on iOS where background network access is heavily throttled. |
| **Privacy** | Excellent. All data stays on device. No backend means no server-side data exposure. |
| **Implementation complexity** | High. Must handle both iOS and Android background task APIs differently. Must implement transport API polling, caching, and decision logic entirely on-device. Must handle offline/poor-connectivity gracefully. |
| **Operational cost** | Near zero. No servers to run. Transport API calls come from user devices. |
| **Platform constraints** | Severe. iOS kills background tasks aggressively. Cannot maintain persistent network connections. Geofence callbacks are coarse (100m+ accuracy, up to 3-minute delay). |

**Verdict:** Not viable for the core use case. Timing reliability is the product's primary value proposition, and on-device-only cannot deliver it.

### Option B: Mobile App + Backend Service

The backend handles all scheduling, transport API polling, decision logic, and push notification delivery. The mobile app is primarily a configuration UI and notification receiver.

| Dimension | Assessment |
|---|---|
| **Reliability of proactive alerts** | Excellent. Backend cron/scheduler runs exactly when needed. Push notifications (APNs / FCM) are the most reliable way to wake a phone and show an alert. No dependency on mobile background task timing. |
| **Battery impact** | Low. The app does minimal background work. Push notifications are the OS's most battery-efficient notification mechanism. |
| **Privacy** | Moderate concern. Backend must know: user's stations, departure window, and notification preferences. Does not need continuous location data if departure window is configured rather than learned. If learning from location, the backend needs departure events (timestamps), but not continuous GPS tracks. |
| **Implementation complexity** | Moderate. Backend is a straightforward scheduler + transport API adapter + notification sender. Mobile app is simpler (UI + push registration). Clear separation of concerns. |
| **Operational cost** | Low-moderate. A single backend instance can serve thousands of users. Transport API calls are batched and cached. Push notification delivery is free (APNs/FCM). Hosting cost for MVP: a single small VM or serverless functions. |
| **Platform constraints** | Minimal. Push notifications work reliably on both platforms. No dependency on background task scheduling. |

**Verdict:** Strong option. Reliable, simpler mobile app, reasonable privacy trade-offs. The main drawback is that departure-time learning requires some mechanism to get departure signals to the backend.

### Option C: Hybrid (On-Device Learning + Backend Checks/Notifications)

Location monitoring and departure-time learning happen on-device. The app periodically syncs a learned "departure window" (not raw location data) to the backend. The backend handles transport API polling, decision logic, and push notification delivery.

| Dimension | Assessment |
|---|---|
| **Reliability of proactive alerts** | Excellent. Same as Option B for the notification path. Departure-time learning is best-effort on-device but degrades gracefully (user can also manually configure departure times). |
| **Battery impact** | Low-moderate. Geofencing (significant location change) is low-power. No continuous GPS. Push notifications are efficient. Slightly more battery than pure Option B due to on-device geofence monitoring. |
| **Privacy** | Good. Raw location data never leaves the device. Only abstracted data (departure window per weekday, e.g. "Monday: 08:03 +/- 7 min") is synced to backend. User's home/office coordinates can be stored as station codes rather than precise GPS on the backend. |
| **Implementation complexity** | Moderate-high. Requires on-device geofence monitoring, local departure observation storage, learning algorithm, and a sync mechanism. Backend is same as Option B. More moving parts overall. |
| **Operational cost** | Same as Option B. |
| **Platform constraints** | Moderate. Geofencing works on both platforms but with caveats (accuracy, delay). Learning quality depends on how reliably the OS delivers geofence events. Falls back gracefully to user-configured times. |

**Verdict:** Best balance of privacy and reliability. The on-device learning is a "nice to have" that improves over time, while the backend ensures alerts are always timely. The fallback to manual configuration means the product works even if on-device learning is unreliable.

---

## 4. Recommended Architecture

**Recommendation: Option C (Hybrid)** with the following reasoning:

1. **Reliability is non-negotiable.** The backend-driven push notification path ensures alerts arrive on time regardless of mobile OS background restrictions.
2. **Privacy is a stated priority.** Keeping raw location data on-device and only syncing abstracted departure windows is a meaningful privacy improvement over sending continuous location to a server.
3. **Graceful degradation.** If on-device learning is unreliable (and on iOS it will be imperfect), the user can manually set departure times and still get full value. The learning is an enhancement, not a dependency.
4. **UK transport APIs are better consumed server-side.** Darwin's SOAP/XML feeds and Network Rail's data feeds are not well-suited to direct mobile consumption. A backend adapter layer that normalises these into a clean internal format is the right design regardless.

### Component Diagram

```
+------------------------------------------------------------------+
|                        MOBILE APP (Flutter)                       |
|                                                                   |
|  +---------------------+  +--------------------+                  |
|  |   Setup & Config UI |  | Notification History|                 |
|  |  - Place picker     |  | - Past alerts list  |                 |
|  |  - Route config     |  | - "Why this alert?" |                 |
|  |  - Preferences      |  +--------------------+                  |
|  +---------------------+                                          |
|                                                                   |
|  +---------------------+  +--------------------+                  |
|  | On-Device Learning  |  |  Local Storage     |                  |
|  | - Geofence monitor  |  |  (SQLite / Hive)   |                  |
|  | - Departure observer|  |  - Departure log   |                  |
|  | - Rolling median    |  |  - Alert history   |                  |
|  | - Window calculator |  |  - Place coords    |                  |
|  +---------------------+  +--------------------+                  |
|                                                                   |
|  +---------------------+                                          |
|  | Sync Service        |                                          |
|  | - Push token reg    |                                          |
|  | - Departure window  |                                          |
|  |   upload (abstract) |                                          |
|  | - Route config sync |                                          |
|  +---------------------+                                          |
+------------------------------------------------------------------+
         |                          |                    ^
         | HTTPS (REST API)         | FCM / APNs         | Push
         v                          v                    |
+------------------------------------------------------------------+
|                       BACKEND SERVICE                             |
|                                                                   |
|  +---------------------+  +--------------------+                  |
|  | API Gateway         |  | Auth / User Mgmt   |                 |
|  | - REST endpoints    |  | - Anonymous accounts|                 |
|  | - Rate limiting     |  | - API key per device|                 |
|  +---------------------+  +--------------------+                  |
|                                                                   |
|  +---------------------+  +--------------------+                  |
|  | Scheduler           |  | Decision Engine    |                  |
|  | - Per-user cron     |  | - Disruption eval  |                  |
|  | - Morning summary   |  | - Severity scoring |                  |
|  | - Evening eng. works|  | - Anti-spam rules  |                  |
|  | - Pre-departure     |  | - Explainability   |                  |
|  +---------------------+  +--------------------+                  |
|                                                                   |
|  +---------------------+  +--------------------+                  |
|  | Transport Adapters  |  | Notification        |                 |
|  | - Darwin adapter    |  | Pipeline            |                 |
|  | - TfL adapter       |  | - FCM sender       |                 |
|  | - Network Rail adpt |  | - APNs sender      |                 |
|  | - TransportAPI adpt |  | - Template engine  |                 |
|  | (common interface)  |  | - Delivery tracking|                 |
|  +---------------------+  +--------------------+                  |
|                                                                   |
|  +---------------------+                                          |
|  | Data Store          |                                          |
|  | (PostgreSQL)        |                                          |
|  | - User configs      |                                          |
|  | - Departure windows |                                          |
|  | - Alert log         |                                          |
|  | - Transport cache   |                                          |
|  +---------------------+                                          |
+------------------------------------------------------------------+
         |
         v
+------------------------------------------------------------------+
|                   EXTERNAL TRANSPORT APIs                         |
|                                                                   |
|  +----------+  +--------+  +--------------+  +--------------+    |
|  | Darwin   |  | TfL    |  | Network Rail |  | TransportAPI |    |
|  | (Nat'l   |  | Unified|  | Data Feeds   |  | (fallback /  |    |
|  |  Rail)   |  | API    |  | (eng. works) |  |  aggregator) |    |
|  +----------+  +--------+  +--------------+  +--------------+    |
+------------------------------------------------------------------+
```

### Technology Choices

| Component | Technology | Rationale |
|---|---|---|
| Mobile app | **Flutter** (Dart) | Single codebase for iOS and Android. Good geofencing plugin ecosystem (`geolocator`, `flutter_local_notifications`). Strong performance. The team does not need to maintain two native codebases. |
| Backend | **TypeScript on Node.js** | Fast to develop, good ecosystem for REST APIs and scheduled tasks. Alternatively, Python (FastAPI) if the team prefers. Either is fine for this scale. |
| Backend framework | **NestJS** or **Express + node-cron** | NestJS provides structure for larger projects; Express is lighter for MVP. |
| Database | **PostgreSQL** | Reliable, well-understood, handles the data model well. Free tier available on most cloud providers. |
| Task scheduling | **BullMQ** (Redis-backed job queue) | Per-user scheduled jobs with precise timing. More flexible than cron for per-user schedules. Redis is lightweight and cheap. |
| Push notifications | **Firebase Cloud Messaging (FCM)** for Android, **APNs** via FCM for iOS | FCM handles both platforms. Free. Well-documented. |
| Hosting | **Railway, Fly.io, or a single DigitalOcean droplet** | Low cost for MVP. Easily scalable later. |
| On-device storage | **SQLite** via `sqflite` (Flutter) | Reliable, well-supported, queryable. Better than SharedPreferences for structured data. |

---

## 5. Data Model

### 5.1 User Settings

| Field | Type | Notes |
|---|---|---|
| `user_id` | UUID | Generated at first app launch |
| `push_token` | string | FCM/APNs token |
| `platform` | enum (ios, android) | |
| `timezone` | string | Always "Europe/London" for MVP |
| `morning_summary_time` | time | Default 06:30 |
| `evening_works_alert_time` | time | Default 20:00 |
| `pre_departure_lead_minutes` | int | Default 15 |
| `notifications_enabled` | bool | Master toggle |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

- **Purpose:** Core user configuration.
- **Storage:** Backend (PostgreSQL). `push_token` and `user_id` are the minimum PII on the backend.
- **Privacy:** `user_id` is device-generated (anonymous). No email, name, or phone number required.

### 5.2 Places

| Field | Type | Notes |
|---|---|---|
| `place_id` | UUID | |
| `user_id` | FK | |
| `label` | enum (home, office, other) | |
| `display_name` | string | User-facing name |
| `latitude` | float | On-device only |
| `longitude` | float | On-device only |
| `nearest_station_code` | string (CRS code) | Synced to backend |
| `geofence_radius_m` | int | Default 200 |

- **Purpose:** Define the user's significant locations and map them to transport stations.
- **Storage:** Precise coordinates on-device only (SQLite). Backend receives only `nearest_station_code` and `label`.
- **Privacy:** High sensitivity. GPS coordinates never leave the device.

### 5.3 Commute Route

| Field | Type | Notes |
|---|---|---|
| `route_id` | UUID | |
| `user_id` | FK | |
| `origin_station` | string (CRS code) | e.g. "WAT" |
| `destination_station` | string (CRS code) | e.g. "SUR" |
| `via_station` | string (CRS code), nullable | Optional intermediate |
| `transport_mode` | enum (national_rail, tfl_tube, tfl_rail, tfl_dlr) | |
| `is_active` | bool | |
| `days_of_week` | int[] | e.g. [1,2,3,4,5] for Mon-Fri |

- **Purpose:** Define the user's commute for transport status checking.
- **Storage:** Backend (needed for server-side transport checks).
- **Privacy:** Moderate. Station-to-station route is less sensitive than GPS coordinates but still reveals commute pattern.

### 5.4 Departure Window

| Field | Type | Notes |
|---|---|---|
| `window_id` | UUID | |
| `user_id` | FK | |
| `route_id` | FK | |
| `day_of_week` | int (1=Mon, 7=Sun) | |
| `median_departure_time` | time | e.g. 08:03 |
| `std_deviation_minutes` | float | e.g. 7.0 |
| `sample_count` | int | Number of observations |
| `confidence` | enum (low, medium, high) | Based on sample count |
| `source` | enum (learned, manual) | |
| `updated_at` | timestamp | |

- **Purpose:** When the user typically departs, per weekday. Drives pre-departure check scheduling.
- **Storage:** Backend (needed for scheduling). Computed on-device from departure observations, then synced.
- **Privacy:** Low-moderate. Reveals departure habits but not precise location.

### 5.5 Departure Observation (On-Device Only)

| Field | Type | Notes |
|---|---|---|
| `observation_id` | int (autoincrement) | |
| `date` | date | |
| `day_of_week` | int | |
| `departure_time` | time | When user left home geofence |
| `arrival_detected` | bool | Whether arrival at office was detected |
| `is_commute` | bool | Inferred: did they go to office? |
| `is_outlier` | bool | Flagged by learning algo |

- **Purpose:** Raw data for departure-window learning.
- **Storage:** On-device only (SQLite). Never synced to backend. Only the computed `DepartureWindow` (abstract summary) is synced.
- **Privacy:** High sensitivity. Contains daily movement patterns.

### 5.6 Calendar Event (On-Device Only, v2)

| Field | Type | Notes |
|---|---|---|
| `event_id` | string | From OS calendar |
| `title` | string | |
| `location` | string, nullable | |
| `start_time` | datetime | |
| `end_time` | datetime | |
| `travel_relevant` | bool | Inferred by heuristics |
| `inferred_destination_station` | string, nullable | |

- **Purpose:** Detect upcoming trips that might need transport checks.
- **Storage:** On-device only. If travel-relevant, the app syncs only `inferred_destination_station` and `start_time` to backend for disruption checking -- never the event title or full details.
- **Privacy:** Very high. Calendar data stays on device.

### 5.7 Transport Status Cache (Backend)

| Field | Type | Notes |
|---|---|---|
| `status_id` | UUID | |
| `provider` | enum (darwin, tfl, network_rail) | |
| `route_key` | string | Normalised origin-destination key |
| `status` | enum (normal, minor_delays, major_delays, part_suspended, suspended, cancelled) | |
| `summary` | string | Human-readable summary |
| `affected_services` | JSONB | Service-level detail |
| `source_updated_at` | timestamp | When provider last updated |
| `fetched_at` | timestamp | When we last polled |
| `raw_response` | JSONB, nullable | For debugging |

- **Purpose:** Cache transport status to avoid redundant API calls and enable quick lookups.
- **Storage:** Backend only.
- **Privacy:** Not user-specific. Public transport data.

### 5.8 Engineering Works (Backend)

| Field | Type | Notes |
|---|---|---|
| `works_id` | UUID | |
| `provider` | enum (network_rail, tfl) | |
| `affected_routes` | string[] | Station pairs or line names |
| `start_date` | date | |
| `end_date` | date | |
| `description` | string | |
| `severity` | enum (minor, major, closure) | |
| `source_url` | string, nullable | Link to provider page |
| `fetched_at` | timestamp | |

- **Purpose:** Store planned engineering works for look-ahead alerting.
- **Storage:** Backend only.
- **Privacy:** Not user-specific.

### 5.9 Alert Decision / Notification History

| Field | Type | Notes |
|---|---|---|
| `alert_id` | UUID | |
| `user_id` | FK | |
| `route_id` | FK | |
| `alert_type` | enum (pre_departure, morning_summary, engineering_works, major_disruption) | |
| `trigger_reason` | string | Human-readable explanation |
| `transport_status_snapshot` | JSONB | Status at decision time |
| `severity` | enum (info, warning, critical) | |
| `decision` | enum (sent, suppressed_cooldown, suppressed_severity, suppressed_duplicate) | |
| `suppression_reason` | string, nullable | Why it was not sent |
| `notification_title` | string | |
| `notification_body` | string | |
| `sent_at` | timestamp, nullable | |
| `delivered_at` | timestamp, nullable | From FCM delivery receipt |
| `opened_at` | timestamp, nullable | If user tapped notification |
| `created_at` | timestamp | |

- **Purpose:** Full audit trail of every alert decision. Enables "why this alert?" explainability, anti-spam debugging, and false-positive analysis.
- **Storage:** Backend. Synced to device for in-app history view.
- **Privacy:** Moderate. Contains route and timing data but no location coordinates.

### 5.10 Notification Rule (Backend)

| Field | Type | Notes |
|---|---|---|
| `rule_id` | UUID | |
| `user_id` | FK | |
| `rule_type` | enum (pre_departure, morning_summary, engineering_works) | |
| `enabled` | bool | |
| `min_severity` | enum (info, warning, critical) | |
| `cooldown_minutes` | int | Minimum gap between same-type alerts |
| `schedule_time` | time, nullable | For fixed-time rules |
| `days_of_week` | int[] | |

- **Purpose:** User-configurable notification preferences per alert type.
- **Storage:** Backend.
- **Privacy:** Low sensitivity.

---

## 6. Notification and Learning Logic

This is the core of the product. Every design decision here directly affects whether users find the app useful or annoying.

### 6.1 Commute vs Non-Commute Detection

**Approach (deterministic, MVP):**

1. When the user exits the Home geofence on a weekday that is in their route's `days_of_week`, record a `DepartureObservation`.
2. If the user subsequently enters the Office geofence within 2 hours, mark `is_commute = true`.
3. If the user does not enter the Office geofence within 2 hours, mark `is_commute = false` (likely WFH, errand, or day off).
4. Days where no Home geofence exit is detected by 11:00 are marked as "no departure" (probable WFH).

**WFH detection:**
- If a user does not leave Home by `median_departure_time + 60 minutes` on a weekday, the backend should skip the pre-departure check for that day (or fire it but suppress notification if status is normal).
- After 3 consecutive weekdays with no departure detected, reduce confidence in learned departure window and eventually pause automated checks until activity resumes.

**Handling irregular schedules:**
- If a user's departure times have high variance (std_deviation > 30 minutes), lower confidence and widen the check window rather than trying to pinpoint a single time.
- Allow manual override: user can set "I leave at 08:00 on weekdays" and disable learning entirely.

### 6.2 Weekday Departure-Window Learning

**Algorithm: Rolling Weighted Median**

```
For each day_of_week:
  1. Collect all departure observations for that day where is_commute = true
  2. Exclude outliers: observations more than 2 hours from the current median (or from the overall mean if no median yet)
  3. Keep only the most recent 8 weeks of data (rolling window)
  4. Weight recent observations higher: weight = 1.0 for this week, 0.9 for last week, 0.8 for two weeks ago, etc.
  5. Compute weighted median as the departure window center
  6. Compute MAD (median absolute deviation) as the spread measure
  7. Set confidence:
     - < 3 observations: LOW (use manual time or default 08:00)
     - 3-6 observations: MEDIUM (use learned time but widen pre-departure window)
     - > 6 observations: HIGH (use learned time with normal pre-departure lead)
```

**Why rolling median, not mean:**
- Medians are robust to outliers (a single very early or very late departure does not skew the result).
- Weighted recency ensures the model adapts to gradual schedule changes (e.g., new job, new shift).

**When to recompute:**
- After each new commute departure observation.
- Sync updated `DepartureWindow` to backend after recomputation.
- Backend re-schedules the user's pre-departure check job based on new window.

### 6.3 Handling WFH Days and Irregular Routines

- **WFH days do not produce departure observations**, so they do not pollute the learned window.
- **Late departures** (e.g., a dentist appointment causing an 11:00 departure on a usually-08:00 day) are caught by the outlier filter (> 2 hours from median) and flagged as `is_outlier = true`. They are excluded from median computation.
- **Half-day or shifted schedules**: If a user regularly leaves at 06:00 on Fridays but 08:00 Mon-Thu, the per-weekday model handles this naturally.
- **Multi-modal departures**: If a user sometimes leaves at 07:00 and sometimes at 09:00 on the same day of the week (e.g., alternating early/late shifts), the MAD will be large. In v1, we widen the check window. In v2, a bimodal clustering approach could detect two distinct departure clusters.

### 6.4 Avoiding One-Off Trips Poisoning the Model

Three defences:

1. **Commute validation**: Only observations where `is_commute = true` (arrived at office geofence) feed into the model. A Saturday trip to the shops does not count.
2. **Outlier exclusion**: Departures > 2 hours from the current median are flagged and excluded.
3. **Minimum sample count**: The model requires at least 3 observations before it is used. Until then, the user's manual configuration (or the 08:00 default) is used.

### 6.5 When to Notify

| Trigger | Timing | What is Checked | Notify If |
|---|---|---|---|
| **Pre-departure check** | `median_departure_time - pre_departure_lead_minutes` (default: 15 min before) | Live status of user's route via Darwin/TfL | Any disruption with severity >= `warning`: delays > 5 min, cancellations, suspensions |
| **Morning summary** | `morning_summary_time` (default 06:30) | Live status of user's route | Any active disruption of severity >= `warning`. If all clear, no notification (silence = good news). |
| **Engineering works (weekend)** | Evening before (default 20:00 on Friday for Saturday, 20:00 Saturday for Sunday) | Planned engineering works affecting user's route | Any planned works on user's route for the next day |
| **Engineering works (weekday)** | Evening before at `evening_works_alert_time` | Planned engineering works affecting user's route for next weekday | Works that affect the user's commute window |
| **Major disruption (ad-hoc)** | When backend detects a new `critical` severity status on user's route during commute hours (06:00-10:00, 16:00-20:00) | Real-time status change | Full line suspension, mass cancellation, safety incident |

### 6.6 Anti-Spam Rules

These rules are applied in the Decision Engine before any notification is sent.

**Rule 1: Severity Threshold**
- Only notify if disruption severity meets user's configured minimum (default: `warning`).
- `info` severity (e.g., "minor delays of 1-2 minutes") is never pushed by default.

**Rule 2: Cooldown**
- Same `alert_type` for the same route: minimum 60 minutes between notifications.
- Exception: severity escalation (e.g., from `warning` to `critical`) overrides cooldown.

**Rule 3: Deduplication**
- If the disruption summary text is identical to the last sent alert for this user+route, suppress.
- Track disruption identity by provider incident ID where available.

**Rule 4: Actionability**
- Only notify if the user can still act on it. If `median_departure_time` has already passed and the user has not left home (no geofence exit), suppress (they are likely WFH).
- Exception: major disruption alerts for the return commute are still sent during commute hours.

**Rule 5: Daily Cap**
- Maximum 5 notifications per user per day (configurable). After cap, only `critical` severity overrides.

**Rule 6: Quiet Hours**
- No notifications between 22:00 and 06:00 (configurable) unless severity is `critical`.

**Rule 7: Resolved Status**
- If a disruption resolves within 5 minutes of detection, do not notify (transient blip).
- Wait 5 minutes after initial detection, re-check, then decide.

### 6.7 Decision Flow

```
1. Trigger fires (scheduled time reached)
2. Fetch current transport status for user's route
3. Normalise status to internal severity enum
4. IF severity < user's min_severity THEN log decision="suppressed_severity", STOP
5. IF same disruption already notified within cooldown THEN log decision="suppressed_cooldown", STOP
6. IF identical summary text as last alert THEN log decision="suppressed_duplicate", STOP
7. IF daily cap reached AND severity != critical THEN log decision="suppressed_cap", STOP
8. IF quiet hours AND severity != critical THEN log decision="suppressed_quiet", STOP
9. IF pre-departure AND departure time already passed AND user still at home THEN log decision="suppressed_actionability", STOP
10. Compose notification (title, body, reason)
11. Send via FCM/APNs
12. Log decision="sent" with full context
```

### 6.8 Explainability

Every sent notification includes a `trigger_reason` field stored in the alert log and accessible via the "Why this alert?" button in the app. Examples:

- "Your usual Monday departure is around 08:03. We checked your route (Surbiton to Waterloo) at 07:48 and found: South Western Railway reporting delays of 15-20 minutes due to a signal failure at Clapham Junction."
- "Tomorrow (Saturday) there are planned engineering works between Waterloo and Surbiton. No direct trains will run; a rail replacement bus service is in operation."
- "Your morning route check at 06:30 found: Piccadilly line part suspended between Hammersmith and Heathrow due to a signal failure."

### 6.9 Example Scenarios

**Scenario 1: Normal Commute Day with Delay**

- User: leaves home at ~08:03 on Mondays (learned, HIGH confidence, 6+ observations)
- Monday, 07:48: Backend fires pre-departure check
- Darwin API returns: SWR services from Surbiton to Waterloo delayed 15-20 min (signal failure)
- Severity: `warning` (meets threshold)
- No recent alerts (cooldown clear)
- Decision: SEND
- Notification: "Delays on your route: SWR Surbiton to Waterloo delayed 15-20 min (signal failure at Clapham Junction). Consider leaving earlier."
- Reason logged: "Pre-departure check, 15 min before learned Monday departure (08:03). SWR delay detected via Darwin."

**Scenario 2: WFH Day, Disruption Ignored**

- User: usually leaves at 08:03 on Tuesdays
- Tuesday, 07:48: Backend fires pre-departure check
- Darwin API returns: SWR cancellations on the Surbiton-Waterloo route
- Severity: `critical`
- However: it is 09:30 and no geofence exit from Home has been detected (app synced "still at home" status at 09:00)
- Decision: SUPPRESS (actionability rule -- user appears to be WFH)
- Reason logged: "Suppressed: user appears to be at home past departure window, likely WFH"

Note: For MVP, this requires either periodic location sync or a simpler heuristic. A simpler v1 approach: always send the pre-departure alert regardless of current location, and add the WFH suppression in v2 when on-device learning is more reliable.

**Scenario 3: Weekend Engineering Works**

- User has route Surbiton to Waterloo, active on weekdays
- Friday 20:00: Backend checks Network Rail planned works feed
- Finds: "No SWR services between Surbiton and Waterloo on Saturday 7 March due to engineering works. Rail replacement bus available."
- User's route days are Mon-Fri, so this is not a commute day
- However: in v2 with calendar integration, if the user has a Saturday calendar event with a location near Waterloo, this becomes relevant
- v1 decision: If user has opted into weekend engineering works alerts, SEND. Otherwise, SUPPRESS.
- Notification: "Engineering works this Saturday: No trains between Surbiton and Waterloo. Rail replacement buses running. Plan extra travel time."

**Scenario 4: Rapid Succession Alerts (Anti-Spam)**

- Monday 07:48: Pre-departure check finds minor delays (5-7 min) on user's route. Severity: `warning`. Decision: SEND.
- Monday 07:55: Morning monitoring detects status escalation to "major delays, 20+ min". Severity: `critical`.
- Cooldown check: last alert was 7 minutes ago (within 60-min cooldown). However, this is a severity escalation (`warning` -> `critical`), which overrides cooldown.
- Decision: SEND (escalation override).
- Notification: "Update: Major delays on your route now 20+ min. SWR Surbiton to Waterloo significantly disrupted."
- Monday 08:05: Status unchanged (still major delays). Another check fires.
- Cooldown check: last alert was 10 minutes ago, same severity, same summary. Decision: SUPPRESS (duplicate + cooldown).

---

## 7. iOS / Android Platform Constraints

### 7.1 Background Location

**iOS:**
- "Always" location permission requires strong justification in App Store review. Apple scrutinises apps requesting this. Must demonstrate clear user value.
- Significant location change monitoring is the recommended low-power alternative. It fires when the user moves ~500m, with no timing guarantee.
- Geofencing: limited to 20 registered regions. Fires on entry/exit with ~100m accuracy and up to 3-minute delay.
- iOS 17+ requires the app to declare `NSLocationAlwaysUsageDescription` and provide an in-app explanation before the permission prompt.

**Android:**
- Background location (`ACCESS_BACKGROUND_LOCATION`) requires separate permission prompt (Android 11+).
- Google Play requires a privacy policy and a "prominent disclosure" before requesting.
- Geofencing API: reliable, fires with ~100m accuracy, minimal delay in most cases.
- Doze mode can delay geofence events by up to 15 minutes when the device is stationary.

**Product impact:**
- Geofencing is feasible on both platforms for departure detection but not for precise timing.
- The departure observation may be delayed by up to 3-5 minutes from actual departure. This is acceptable for learning (the median smooths out noise) but means the app cannot use geofence events as real-time departure triggers for alerts.
- The backend must handle alert timing independently of geofence events.

### 7.2 Calendar Permissions

**iOS:**
- `NSCalendarsUsageDescription` required. User grants or denies access to all calendars or none (no per-calendar granularity in the permission prompt, though the app can filter programmatically).
- EventKit provides read access to events. Read-only is sufficient.

**Android:**
- `READ_CALENDAR` permission. Android 13+ requires runtime permission.
- CalendarContract provides structured access.

**Product impact:**
- Calendar integration is v2 but the permission architecture should be designed now. Request calendar permission only when the user enables the calendar feature, not at first launch.

### 7.3 Notification Permissions

**iOS:**
- Must request notification permission explicitly. iOS 16+ shows the permission prompt when requested.
- Users can disable notifications entirely or per-channel (introduced in iOS 15 focus modes).
- Critical alerts (bypass Do Not Disturb) require an Apple entitlement, which is nearly impossible to get for non-emergency apps. The app cannot guarantee delivery during DND.

**Android:**
- Android 13+ requires runtime notification permission (`POST_NOTIFICATIONS`).
- Notification channels allow users fine-grained control. The app should create separate channels for different alert types (pre-departure, engineering works, morning summary) so users can mute specific types.

**Product impact:**
- Request notification permission at setup completion, with a clear explanation of what the user will receive.
- Provide in-app notification preferences that mirror the OS channel settings.
- Accept that some notifications will be silenced by DND/Focus modes. Do not try to circumvent this.

### 7.4 Background Tasks and Scheduling

**iOS:**
- `BGAppRefreshTask`: system decides when to run. No timing guarantee. Typically runs at most a few times per day. Influenced by user engagement patterns.
- `BGProcessingTask`: for longer work, but even less frequent. Not suitable for time-sensitive checks.
- Silent push notifications: the system may throttle these. Apple documents a "budget" of silent pushes per hour (unpublished exact number, estimated 2-3/hour).
- **Conclusion:** iOS background tasks cannot be relied upon for time-critical transport checks.

**Android:**
- `WorkManager`: minimum periodic interval is 15 minutes. Can request exact timing with `setRequiresBatteryNotLow(false)` but Doze mode can still delay execution.
- `AlarmManager.setExactAndAllowWhileIdle()`: most reliable for exact timing but Google Play restricts use for foreground-related work. Android 12+ requires `SCHEDULE_EXACT_ALARM` permission.
- Foreground service: guaranteed execution but requires persistent notification. Not appropriate for an app that should be invisible until it has something to say.
- **Conclusion:** Android is more capable but still not 100% reliable for exact-minute scheduling.

**Product impact (critical):**
- This is the strongest argument for the backend-driven architecture. Neither platform can guarantee that a check will run at exactly 07:48.
- The backend scheduler (BullMQ, cron, etc.) runs on a server with no power management restrictions and can fire checks at the exact scheduled second.
- Push notifications (FCM/APNs) are the OS-blessed mechanism for waking the app and showing an alert. They are as reliable as anything can be on mobile.

### 7.5 Battery Optimisation

- Both platforms aggressively throttle background work for apps the user does not frequently open.
- Requesting "always" location uses more battery than geofencing alone.
- The app should minimise on-device background work to: geofence monitoring + periodic departure window sync. Everything else runs on the backend.
- Target: < 2% daily battery impact. This requires no continuous location tracking, no frequent network polls, and no background GPS use.

### 7.6 Summary: What the Platform Constraints Mean for Design

| Constraint | Design Decision |
|---|---|
| Cannot schedule exact background tasks on iOS | Backend handles all time-critical checks and sends push notifications |
| Geofence events delayed up to 3-5 min | Use geofence for learning (tolerant of delay), not for triggering real-time alerts |
| Battery budget is tight | Minimise on-device work: geofence + sync only |
| Notification permissions can be denied | Make the app useful even without push (in-app status view) |
| DND/Focus modes can suppress alerts | Accept this gracefully; do not try to bypass |
| Calendar permission is all-or-nothing on iOS | Request only when feature is enabled; filter to relevant calendars in code |

---

## 8. External Integrations Strategy

### 8.1 Calendar Access

**Approach:** Direct on-device access via platform APIs (EventKit on iOS, CalendarContract on Android).

- Read-only access.
- Scan events 7 days ahead nightly.
- Apply heuristics to identify travel-relevant events: events with a location field, events outside the user's home/office area, all-day events on weekends.
- Never sync raw calendar data to backend. Only sync: inferred destination station code + event start time (for scheduling a transport check).
- Deferred to v2.

### 8.2 Transport Data Sources

#### Category 1: Real-Time Train Status (National Rail)

**Primary: Darwin (National Rail Enquiries)**
- **Protocol:** SOAP/XML push feed (OpenLDBWS) or pull via Huxley2 (unofficial JSON REST proxy)
- **Coverage:** All UK train operating companies (TOCs). Real-time arrivals, departures, cancellations, delay reasons, platform assignments.
- **Rate limit:** 5 million requests per 4-week period (free tier). Approximately 2 requests/second sustained.
- **Registration:** Free at [National Rail Open Data](https://opendata.nationalrail.co.uk).
- **Reliability:** High. This is the canonical source for UK rail status.
- **Recommended usage:** Primary source for all National Rail route checks.

**Fallback: TransportAPI**
- **Protocol:** REST/JSON
- **Coverage:** Nationwide, aggregates multiple sources
- **Rate limit:** Commercial pricing. Free trial tier available.
- **Use as:** Fallback if Darwin is down or for routes where Darwin coverage is poor.

#### Category 2: London Transport (TfL)

**Primary: TfL Unified API**
- **Protocol:** REST/JSON
- **Coverage:** Tube, DLR, London Overground, Elizabeth line, buses, trams, TfL Rail, river buses, cable car.
- **Rate limit:** 500 requests/minute with API key (free).
- **Registration:** Free at [TfL API Portal](https://api.tfl.gov.uk).
- **Key endpoints:**
  - `/Line/{id}/Status` -- current status of a line
  - `/Line/{id}/Disruption` -- active disruptions
  - `/StopPoint/{id}/Arrivals` -- real-time arrivals at a stop
- **Reliability:** High. Well-maintained, excellent documentation with Swagger spec.
- **Recommended usage:** Primary source for all TfL services.

#### Category 3: Planned Engineering Works

**Primary: Network Rail Data Feeds**
- **Protocol:** STOMP/ActiveMQ push feeds (XML)
- **Coverage:** Planned engineering works, possessions, line closures across the UK rail network.
- **Rate limit:** Free access, registration required.
- **Caveat:** Network Rail is transitioning to the Rail Data Marketplace (RDM) in 2026. The existing feeds may be deprecated. Plan for migration.
- **Recommended usage:** Fetch planned works weekly, cache in backend, check user routes against cached works.

**Fallback: National Rail Enquiries website scraping or TransportAPI**
- Scraping is fragile. TransportAPI includes engineering works data in its commercial tier.

**TfL Planned Works:**
- TfL Unified API `/Line/{id}/Status` includes planned closures and part-suspensions for weekends/holidays. No separate feed needed.

#### Category 4: Future/General Purpose

**TransportAPI**
- Useful as a multi-modal aggregator and fallback.
- REST/JSON with GTFS support.
- Consider for v2 when adding bus routes or multi-leg journeys.

### 8.3 Normalisation Strategy

All transport data from different providers must be normalised to a common internal model before the Decision Engine processes it.

**Common `TransportStatus` model:**

```
{
  provider: "darwin" | "tfl" | "network_rail" | "transport_api",
  route_key: "SUR-WAT" | "piccadilly-line",
  checked_at: timestamp,
  overall_status: "normal" | "minor_delays" | "major_delays" | "part_suspended" | "suspended" | "cancelled",
  severity: "info" | "warning" | "critical",
  summary: "Delays of 15-20 minutes due to signal failure at Clapham Junction",
  affected_services: [...],
  source_incident_id: "darwin-12345" | null,
  expected_resolution: timestamp | null,
  alternatives: "Rail replacement bus from Surbiton" | null
}
```

**Severity mapping:**

| Provider Status | Internal Severity |
|---|---|
| Darwin: "On time", TfL: "Good Service" | `info` (normal) |
| Darwin: "Delayed 1-5 min", TfL: "Minor Delays" | `info` (minor) |
| Darwin: "Delayed 5-15 min" | `warning` |
| Darwin: "Delayed 15+ min", TfL: "Severe Delays" | `warning` (high) |
| Darwin: "Cancelled", TfL: "Part Suspended" | `critical` |
| TfL: "Suspended", Darwin: "All services cancelled" | `critical` |
| Planned engineering works (closure) | `critical` |
| Planned engineering works (reduced service) | `warning` |

### 8.4 Transport Provider Adapter Design

Each transport provider is implemented as an adapter behind a common interface:

```
Interface: TransportAdapter
  - name: string
  - checkRouteStatus(origin: StationCode, destination: StationCode, options?: CheckOptions): Promise<TransportStatus>
  - checkLineStatus(lineId: string): Promise<TransportStatus>
  - getPlannedWorks(dateRange: DateRange, affectedStations?: StationCode[]): Promise<EngineeringWorks[]>
  - healthCheck(): Promise<boolean>
```

**Adapter implementations:**

| Adapter | Class | Notes |
|---|---|---|
| Darwin | `DarwinAdapter` | Uses Huxley2 for JSON access (avoids SOAP complexity in MVP). Falls back to direct OpenLDBWS if Huxley2 is unavailable. |
| TfL | `TflAdapter` | Direct REST calls to TfL Unified API. |
| Network Rail | `NetworkRailAdapter` | Fetches planned works. May use STOMP consumer or periodic batch fetch. |
| TransportAPI | `TransportApiAdapter` | Fallback adapter. Used when primary adapters fail health checks. |

**Adapter selection at runtime:**
- The Decision Engine selects the appropriate adapter based on route `transport_mode`.
- National Rail routes use `DarwinAdapter` primarily, with `TransportApiAdapter` as fallback.
- TfL routes use `TflAdapter` primarily, with `TransportApiAdapter` as fallback.
- If primary adapter's `healthCheck()` fails, fall back automatically and log the failover.

**Caching:**
- Transport status is cached for 2 minutes (to avoid hammering APIs during batch user checks).
- Multiple users on the same route share the same cached status.
- Engineering works are cached for 6 hours (they change infrequently).

---

## 9. Privacy and Security Approach

### 9.1 Core Principle: Data Minimisation

The guiding question for every piece of data: "Does this need to leave the device for the product to work?"

### 9.2 On-Device vs Backend Storage Boundaries

| Data | Storage | Rationale |
|---|---|---|
| GPS coordinates (home, office) | **On-device only** | Backend only needs station codes, not precise locations |
| Departure observations (raw) | **On-device only** | Only computed departure windows (abstract) are synced |
| Calendar event details | **On-device only** | Only inferred station + time synced (v2) |
| Departure windows (computed) | **Backend** | Needed for scheduling checks |
| Route configuration (station codes) | **Backend** | Needed for transport status checks |
| Push token | **Backend** | Needed for notification delivery |
| Transport status cache | **Backend** | Not user-specific |
| Alert decision log | **Backend** | Needed for debugging and explainability |

### 9.3 What Never Leaves the Device

- GPS coordinates of home, office, or any place
- Raw departure/arrival timestamps with location data
- Calendar event titles, attendees, or descriptions
- Notification content previews (generated server-side but only the user's device displays them)

### 9.4 Token and Secret Storage

- **Mobile:** Push token and user API key stored in platform-secure storage (iOS Keychain, Android EncryptedSharedPreferences).
- **Backend:** API keys for transport providers stored in environment variables, never in code or database. Use a secrets manager (e.g., Doppler, AWS Secrets Manager, or `.env` with strict access controls) in production.
- **Communication:** All app-to-backend communication over HTTPS (TLS 1.3). Certificate pinning in v2.
- **Authentication:** Device-generated UUID as user identity. No passwords, no email. Anonymous by default. Optional email linkage in v2 for account recovery.

### 9.5 Notification Privacy (Lock Screen)

- Notification content should be useful on the lock screen (e.g., "Delays on your route: 15-20 min") but not reveal sensitive information.
- Do not include station names in notification titles if the user has enabled "hide notification content on lock screen" in their settings.
- Provide an in-app setting: "Show route details on lock screen" (default: on, user can turn off).
- iOS: use `UNNotificationContent.hiddenPreviewBody` for privacy-sensitive mode.
- Android: use `Notification.VISIBILITY_PRIVATE` with a redacted public version.

### 9.6 Deletion and Export Controls

- **Delete all data:** One-tap button in settings. Deletes all on-device data (SQLite, Keychain) and sends a DELETE request to the backend to purge user record, routes, windows, and alert history.
- **Export data:** User can export a JSON dump of all their data (on-device + backend) via an in-app "Export my data" button. This supports GDPR Article 15 (right of access) and Article 20 (data portability).
- **Account deletion confirmation:** Backend acknowledges deletion and provides a confirmation token. Data is hard-deleted, not soft-deleted, within 30 days.

### 9.7 Auditability

- Every alert decision (sent or suppressed) is logged with full context in the `AlertDecision` table.
- Users can view their alert history in-app and tap any alert to see: trigger type, time, transport status snapshot, severity, and the human-readable reason.
- Backend retains alert logs for 90 days, then auto-purges.
- Suppressed alerts are also visible (optionally) so users can understand why they did not receive a notification they expected.

---

## 10. Testing Strategy

### 10.1 Unit Tests for Decision Logic

- **Decision Engine:** Test every branch of the decision flow (Section 6.7) with deterministic inputs. Cover: severity thresholds, cooldown enforcement, deduplication, daily cap, quiet hours, actionability check.
- **Learning Algorithm:** Test rolling weighted median with known datasets. Test outlier detection with injected anomalies. Test confidence levels with varying sample sizes.
- **Anti-spam rules:** Parameterised tests for each rule with edge cases (exactly at cooldown boundary, exactly at daily cap, severity escalation during cooldown).
- **Severity mapping:** Test normalisation for every known provider status string.
- **Framework:** Jest (if TypeScript backend) or pytest (if Python). Aim for >95% coverage of the Decision Engine.

### 10.2 Integration Tests for Transport Adapters

- **Contract tests:** Each adapter must return data conforming to the `TransportStatus` interface. Test with recorded (VCR-style) responses from each API.
- **Error handling:** Test adapter behaviour when API returns 429 (rate limit), 500 (server error), timeout, or malformed response.
- **Fallback:** Test that the adapter selector correctly falls over to `TransportApiAdapter` when the primary adapter's health check fails.
- **Live smoke tests:** A scheduled CI job that makes real API calls to Darwin, TfL, and Network Rail once daily to detect API changes or breakage. Runs against staging, not production.
- **Tools:** Nock (Node.js) or responses (Python) for HTTP mocking. Recorded cassettes for each API.

### 10.3 Simulated Time-Based Tests

- **Clock injection:** The Decision Engine and Scheduler must accept an injectable clock (not `Date.now()` or `time.time()` directly). This allows tests to simulate any time of day.
- **Scenarios to simulate:**
  - User's departure window is 08:03; test that pre-departure check fires at 07:48.
  - Morning summary fires at 06:30.
  - Engineering works alert fires at 20:00 on Friday.
  - Quiet hours suppress a `warning` alert at 23:00 but allow a `critical` alert.
  - Cooldown expiry: alert at 07:48, suppress at 07:55, allow at 08:50.
- **Framework:** Fake timers (Jest `useFakeTimers`, Python `freezegun`).

### 10.4 Geofence and Location Simulation

- **On-device testing:**
  - iOS: Xcode location simulation with GPX files. Simulate a commute path (leave home, arrive at office) and verify departure observation is recorded.
  - Android: ADB mock locations via `adb emu geo fix` or a mock location provider app.
  - Flutter: Use `geolocator_platform_interface` with a mock implementation for unit tests. Use platform-specific simulation for integration tests.
- **Scenarios:**
  - User leaves home geofence -> departure observation recorded.
  - User arrives at office geofence -> observation marked as commute.
  - User leaves home but does not arrive at office -> observation marked as non-commute.
  - No geofence exit by 11:00 -> WFH day detected.

### 10.5 False Positive / False Negative Testing

- **False positive testing (alert sent, no real disruption):**
  - Record transport API responses for days with known normal service.
  - Run the Decision Engine against these snapshots and verify no alerts are sent.
  - Track false positive rate in production via alert log analysis (compare alert severity to actual disruption outcome).
- **False negative testing (disruption occurred, no alert sent):**
  - Record transport API responses for days with known disruptions.
  - Run the Decision Engine and verify alerts are generated.
  - Harder to test in production: requires user feedback ("Was your commute disrupted today but you didn't get an alert?").
- **Regression test suite:** Maintain a library of "golden" scenarios (recorded API responses + expected decisions) and run them on every commit.

### 10.6 Manual Field Testing Plan

| Phase | Duration | Focus |
|---|---|---|
| **Alpha (developer only)** | 2 weeks | Single developer's actual commute. Run the backend, receive real alerts, log everything. Validate timing, relevance, and anti-spam behaviour manually. |
| **Beta (5-10 testers)** | 4 weeks | Diverse commute routes (London Overground, mainline rail, Tube). Testers report: false positives, missed disruptions, notification timing, battery impact, clarity of alert text. |
| **Controlled disruption test** | 1 day | On a day with known engineering works or planned disruptions, verify alerts fire correctly for all affected testers. |
| **Weekend test** | 2 weekends | Verify engineering works alerts fire on Friday evening. Verify no spurious weekday alerts on Saturday/Sunday. |

### 10.7 Observability and Logging During Testing

- **Backend:**
  - Structured JSON logging (pino for Node.js, structlog for Python).
  - Log every scheduler trigger, API call (with latency), decision engine run (with outcome and reason), and notification send (with FCM/APNs response).
  - Metrics: alert sent count, suppressed count (by reason), API latency p50/p95/p99, API error rate, notification delivery rate.
  - Dashboard (Grafana or similar) showing: alerts sent per hour, suppression reasons breakdown, transport API health.

- **Mobile:**
  - On-device debug log (viewable in a hidden developer screen, accessible via Settings > About > tap version 5 times).
  - Log: geofence events, departure observations, sync attempts, push token registration.
  - Crash reporting (Sentry or Firebase Crashlytics).

---

## 11. Step-by-Step Milestone Plan

### Milestone 0: Project Bootstrap
**Goal:** Repository setup, tooling, CI pipeline.
**Acceptance criteria:**
- Monorepo structure: `/backend`, `/mobile`, `/shared` (common types/constants).
- Backend: TypeScript + NestJS (or Express) scaffolded with linting (ESLint), formatting (Prettier), and test runner (Jest).
- Mobile: Flutter project created with basic folder structure.
- CI: GitHub Actions running lint + test on every push.
- README with local development instructions.
**Duration:** 1-2 days.
**Key risks:** None (pure setup).

### Milestone 1: Transport Adapter Prototype
**Goal:** Prove that we can fetch real-time train status from Darwin and TfL and normalise it.
**Deliverables:**
- `DarwinAdapter` that calls Huxley2 and returns a `TransportStatus` object.
- `TflAdapter` that calls TfL Unified API and returns a `TransportStatus` object.
- Common `TransportStatus` interface and severity mapping.
- Unit tests with recorded API responses.
- A CLI command: `npm run check-route -- --from SUR --to WAT` that prints the current status.
**Stub/mock:** Network Rail adapter (engineering works) stubbed. TransportAPI adapter stubbed.
**Acceptance criteria:** Can query any National Rail or TfL route and get a normalised status with correct severity.
**Duration:** 3-4 days.
**Key risks:** Darwin registration may take 1-2 business days for API key approval. Huxley2 may have availability issues (it is a community-run proxy).

### Milestone 2: Decision Engine (Core Logic)
**Goal:** Implement the notification decision logic as a pure, testable module.
**Deliverables:**
- Decision Engine module that takes: user config, departure window, transport status, alert history, current time.
- Returns: decision (send/suppress), notification content, reason.
- Full anti-spam rule implementation (severity, cooldown, dedup, cap, quiet hours).
- 20+ unit tests covering all decision paths and edge cases.
- Example scenario tests matching Section 6.9.
**Stub/mock:** All external dependencies (transport adapters, notification sender) are interfaces/mocks.
**Acceptance criteria:** All unit tests pass. Decision Engine produces correct results for all documented scenarios.
**Duration:** 3-4 days.
**Key risks:** Getting the severity mapping nuances right requires real-world data.

### Milestone 3: Backend Scheduler and Notification Pipeline
**Goal:** Per-user job scheduling and push notification delivery.
**Deliverables:**
- BullMQ (or equivalent) job queue with Redis.
- Scheduler that creates per-user jobs based on departure windows.
- Job handler: fetches transport status, runs Decision Engine, sends notification if appropriate.
- FCM integration for push notification delivery.
- Morning summary and engineering works check jobs (time-based, not per-user departure).
- PostgreSQL schema and migrations for all backend entities.
- API endpoint: `POST /users` to register a device and configure a route.
**Stub/mock:** Mobile app not needed yet. Use curl/Postman to register test users.
**Acceptance criteria:** Register a test user with a route and departure window. Scheduler fires at the correct time. If the route is disrupted, a push notification arrives on a test device.
**Duration:** 5-7 days.
**Key risks:** FCM setup and APNs certificate provisioning. BullMQ job scheduling precision (should be fine for minute-level granularity).

### Milestone 4: Flutter App - Setup Flow
**Goal:** User can install the app, set home/office, configure a route, and register with the backend.
**Deliverables:**
- Onboarding flow: welcome screen, location permission request, home/office place picker (map with search), station selector, route configuration.
- Push notification permission request and FCM token registration.
- Backend API integration: create user, sync route config.
- Manual departure time configuration (fallback for when learning is not yet available).
- Local SQLite database setup.
**Stub/mock:** No geofencing yet. No departure learning. User manually sets departure time.
**Acceptance criteria:** User completes setup in under 5 minutes. Backend receives route config and departure window. Push notifications are delivered.
**Duration:** 7-10 days.
**Key risks:** App Store / Play Store permissions justification text. Map integration (Google Maps API key or OpenStreetMap).

### Milestone 5: End-to-End Happy Path
**Goal:** Full loop working: user sets up route, backend checks at the right time, notification arrives.
**Deliverables:**
- Integration of M1-M4.
- In-app route status screen (current status of configured route).
- Notification history screen with "why this alert?" detail.
- Settings screen (notification preferences, departure time, alert times).
**Stub/mock:** Departure learning still manual. Engineering works adapter stubbed.
**Acceptance criteria:** Developer uses the app for a real commute day. Receives a correct pre-departure alert (or confirms no alert on a normal day). Can view alert history.
**Duration:** 3-5 days.
**Key risks:** End-to-end timing issues. Push notification delivery reliability.

### Milestone 6: On-Device Departure Learning
**Goal:** App learns when the user leaves home and adjusts departure window automatically.
**Deliverables:**
- Geofence registration for home and office.
- Departure observation recording on geofence exit.
- Commute detection (arrival at office geofence).
- Rolling weighted median computation.
- Departure window sync to backend (abstract data only).
- Backend re-schedules checks when departure window updates.
**Stub/mock:** None.
**Acceptance criteria:** After 5 commute days, learned departure window is within 10 minutes of the user's actual median departure time. Backend check time adjusts accordingly.
**Duration:** 5-7 days.
**Key risks:** Geofence reliability on iOS. Battery impact of geofence monitoring.

### Milestone 7: Engineering Works Alerts
**Goal:** Proactive alerts for planned engineering works.
**Deliverables:**
- `NetworkRailAdapter` implementation (or batch fetch from Network Rail data feeds).
- Engineering works cache in backend.
- Friday evening check for weekend works affecting user's route.
- Weekday evening check for next-day works.
- Decision Engine integration for engineering works alert type.
**Stub/mock:** None.
**Acceptance criteria:** On a week with known engineering works on the user's route, an alert is sent the evening before.
**Duration:** 3-5 days.
**Key risks:** Network Rail data feed access and reliability. Matching engineering works to station-to-station routes (works are described in terms of line sections, not station pairs).

### Milestone 8: Polish, Hardening, and Beta Prep
**Goal:** App is ready for beta testers.
**Deliverables:**
- Error handling and retry logic in all adapters.
- Graceful degradation when APIs are down (informative error in-app, no silent failure).
- Privacy controls: delete data, export data.
- Battery optimisation audit.
- Lock screen notification privacy option.
- App icon, splash screen, basic visual design.
- TestFlight (iOS) and internal testing track (Android) deployment.
**Stub/mock:** None.
**Acceptance criteria:** 5-10 beta testers can install, set up, and use the app for one week without critical bugs.
**Duration:** 5-7 days.
**Key risks:** iOS App Review for TestFlight. Battery impact in real-world usage.

### Milestone 9: Beta Testing and Iteration
**Goal:** Validate with real users, fix issues, tune anti-spam rules.
**Deliverables:**
- Beta running for 4 weeks with 5-10 users.
- Weekly review of alert logs: false positive rate, missed disruptions, anti-spam effectiveness.
- Tune severity thresholds, cooldowns, and timing based on feedback.
- Fix bugs discovered during beta.
**Duration:** 4 weeks.

### Milestone 10: v1 Launch Preparation
**Goal:** App Store and Play Store submission.
**Deliverables:**
- App Store listing (screenshots, description, privacy policy).
- Play Store listing.
- Privacy policy and terms of service.
- Production backend deployment with monitoring and alerting.
- Backup and disaster recovery for database.
**Duration:** 3-5 days.

---

## 12. Risks, Unknowns, and Assumptions to Validate

### Risk 1: Transport API Access and Reliability

**Risk:** Darwin registration is delayed, rate limits are hit, or the API changes format. Huxley2 (unofficial proxy) may go offline. Network Rail's transition to Rail Data Marketplace in 2026 may break existing integrations.

**Impact:** High. No transport data means no alerts.

**Validation:**
- Register for Darwin API access in Week 1 (before any code).
- Build against Huxley2 but implement direct OpenLDBWS as fallback.
- Monitor Network Rail RDM transition announcements. Plan adapter migration for mid-2026.
- Implement TransportAPI as a paid fallback that covers all providers.

### Risk 2: Background Execution Reliability (iOS)

**Risk:** iOS geofence events are delayed or missed, making departure learning unreliable. Worse: iOS may terminate the app's background execution entirely if the user does not open it frequently.

**Impact:** Medium. Departure learning quality degrades, but manual configuration is the fallback.

**Validation:**
- Field test geofence reliability on iOS 17+ for 2 weeks during Milestone 6.
- Measure: what percentage of actual departures are detected? What is the average delay?
- If reliability is below 70%, consider: (a) prompting user to open app occasionally, (b) using significant location change monitoring as a supplement, (c) de-emphasising automatic learning and making manual configuration the primary mode on iOS.

### Risk 3: Noisy Location / Geofence Data

**Risk:** Urban environments (tall buildings, underground stations) cause GPS drift that triggers false geofence exits. User receives a departure observation when they have not actually left home.

**Impact:** Medium. Pollutes the learning model and could cause premature alert checks.

**Validation:**
- Require geofence exit to persist for 2+ minutes before recording an observation (debounce).
- Test in various urban environments during beta.
- Commute validation (arrival at office) filters out most false departures.

### Risk 4: Notification Fatigue / Trust

**Risk:** Users receive too many alerts, or alerts that are not actionable, and they disable notifications or uninstall.

**Impact:** High. This is an existential risk for the product.

**Validation:**
- Conservative defaults: `warning` minimum severity, 60-minute cooldown, daily cap of 5.
- "Silence means good news" principle: never notify when everything is fine.
- Track notification engagement (tap-through rate) and suppression rate during beta.
- Post-beta survey: "Were the alerts useful? Too many? Too few?"
- Provide easy per-type muting in settings.

### Risk 5: User Has No Regular Commute

**Risk:** Some users have highly irregular schedules (shift workers, freelancers, hybrid workers with no fixed days). The departure learning model produces low-confidence or meaningless windows.

**Impact:** Medium. Product is less useful for this segment.

**Validation:**
- Allow fully manual configuration as a first-class option.
- If confidence is LOW for all weekdays after 4 weeks of use, prompt user: "It looks like your schedule varies a lot. Would you like to set fixed check times instead?"
- v2: calendar integration can supplement or replace departure learning for irregular users.

### Risk 6: API Rate Limits Under Scale

**Risk:** At scale, the backend makes many transport API calls. Darwin's 5M/4-week limit allows ~2 req/sec. If each user check requires 1 API call, this supports ~170K checks/day. At 2 checks/user/day (pre-departure + morning), this is ~85K users. Sufficient for MVP but not for large-scale growth.

**Impact:** Low for MVP, medium for growth.

**Validation:**
- Implement aggressive caching: cache route status for 2 minutes, share cache across users on the same route.
- Batch users by route: all users on SUR-WAT share one API call per check window.
- Monitor API usage from Week 1. Set up alerting at 70% of rate limit.
- Explore Darwin's push feed (PushPort) for v2, which eliminates polling entirely.

### Risk 7: Matching Engineering Works to User Routes

**Risk:** Engineering works data describes affected line sections or junctions, not station-to-station routes. Mapping "Engineering works between Clapham Junction and Woking" to "Does this affect a SUR-WAT commute?" requires route topology knowledge.

**Impact:** Medium. False positives (alerting for works that do not actually affect the user's train service) erode trust. False negatives (missing works that do affect the route) are worse.

**Validation:**
- Start simple: match by station codes mentioned in works descriptions. If either `origin_station` or `destination_station` or `via_station` appears in the works' affected stations list, alert.
- Accept some false positives initially (over-alerting for engineering works is preferable to under-alerting for this specific case, since the alert goes out the evening before and is lower-urgency).
- Refine matching with TOC-specific route topology data over time.

### Risk 8: Huxley2 Availability

**Risk:** Huxley2 is an unofficial, community-maintained JSON proxy for Darwin. It could go offline, become rate-limited, or diverge from the Darwin API.

**Impact:** High if it is the only Darwin integration path.

**Validation:**
- Build the `DarwinAdapter` with Huxley2 as the primary path but architect it so that swapping to direct OpenLDBWS (SOAP) requires only a new implementation of the adapter interface, not a rewrite.
- Monitor Huxley2 uptime from Day 1.
- If Huxley2 proves unreliable during Milestone 1, invest in a direct SOAP client immediately. Libraries exist for Node.js (`strong-soap`, `soap`).

---

## Open Questions

1. **Station picker UX:** Should the user type station names, pick from a map, or both? A station name autocomplete (using the NaPTAN dataset or Darwin station list) is likely the best UX for UK rail.

2. **Multi-leg journeys (v2+):** Some commutes involve train + Tube (e.g., mainline to Waterloo, then Jubilee line to Canary Wharf). v1 supports only a single origin-destination pair. How should v2 model multi-leg routes? Likely as an ordered list of legs, each with its own adapter.

3. **Return commute:** v1 focuses on the morning outbound commute. Should there be a parallel "evening return" check? Architecturally it is identical (a second departure window for the return trip). Consider adding in a late v1 milestone or early v2.

4. **Offline behaviour:** What should the app show if the device is offline when the user opens it? Likely: last known status with a "last updated X minutes ago" timestamp and a warning that data may be stale.

5. **Account recovery:** v1 uses anonymous device-generated UUIDs. If the user changes phones, they lose their data. v2 should offer optional account linkage (email or Sign in with Apple/Google) for cross-device continuity.

6. **Rail Data Marketplace migration timeline:** Network Rail's RDM transition is planned for 2026. Exact timeline and API compatibility with existing feeds is unclear. Monitor announcements and plan adapter migration.

---

### Critical Files for Implementation

- `/home/fmakila/dev/ProactiveCommuterAgent/prd.md` - Product requirements document that defines all 12 required plan sections and constraints
- `/home/fmakila/dev/ProactiveCommuterAgent/CLAUDE.md` - Project instructions file that should be updated when the stack is chosen (TypeScript/NestJS backend + Flutter mobile)
- Backend `decision-engine.ts` (to be created) - Core notification decision logic module; the most critical piece of business logic in the entire system
- Backend `transport-adapter.ts` (to be created) - Common interface for transport provider adapters (Darwin, TfL, Network Rail); the integration boundary that must be designed for swappability
- Backend `scheduler.ts` (to be created) - Per-user job scheduling using BullMQ; orchestrates when transport checks fire and connects adapters to the decision engine