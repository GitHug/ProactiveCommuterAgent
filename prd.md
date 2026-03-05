I want you to act as a **senior product engineer / mobile architect** and help me plan a project **before any code is written**.

# IMPORTANT MODE (read carefully)

You are in **planning mode only**.

I want a **thoughtful technical plan** first, in Markdown, that I can review and refine before implementation.

---

# Project idea: Proactive commute/context assistant (mobile app)

I want to build a **mobile phone app** that proactively tells me useful things **before I need to remember to check them manually**, especially for commuting and travel disruption info.

## Core product concept

The app should combine:

* **Location awareness** (home, office, common places)
* **Behavior learning** (when I usually leave home / office)
* **Calendar awareness** (upcoming events/trips)
* **Transport disruption/status data** (e.g., train delays/cancellations/engineering works)
* **Proactive notifications** at the right time

The goal is not “chat with AI.”
The goal is **timely, relevant, proactive alerts** that reduce manual checking.

## Example use cases

### Commute check before departure

* The app knows my **home** and **office** locations
* It learns (or lets me configure) that I often leave around **08:03**
* Around **07:48** (15 min before), it checks my route/train and notifies me:

  * on time / delayed / cancelled
  * if I should leave earlier
  * if there is a disruption affecting my usual journey

### Planned trip / weekend warning

* I have a calendar event on **Saturday**
* The app infers I may need travel (based on location/time)
* It checks for **planned engineering works / rail replacement buses**
* It proactively warns me (e.g. night before or morning-of)

## Product qualities I care about

* **Actually useful**
* **Privacy-conscious** (location + calendar are sensitive)
* **Not spammy**
* **Reliable enough to trust**
* Starts simple, gets smarter over time

---

# Constraints / preferences (important)

* I want a **deterministic MVP first** (rules/heuristics), not heavy AI/ML.
* “Learning” should start simple:

  * infer usual departure windows by weekday
  * adapt over time
  * handle WFH / irregular schedules gracefully
* I care about **real mobile platform constraints**:

  * background execution limits
  * battery impact
  * permissions
  * geofencing reliability
* I am open to a **backend service** if needed for reliable proactive checks/notifications.
* I’m in the **UK**, so planning should consider **UK transport use cases** (trains, disruptions, engineering works, TfL/National Rail-style sources).

---

# What I want from you now (planning deliverable)

Please produce a **practical technical plan** in Markdown, not code.

## Deliverables

### 1) Product summary

* What the app is
* Who it is for
* Why it is valuable
* What makes it hard / what makes it defensible

### 2) MVP scope (in/out)

Define a **realistic MVP** that is genuinely useful.
Include:

* what features are in v1
* what is explicitly out of scope
* what assumptions v1 makes
* MVP success criteria

### 3) Architecture options comparison

Compare at least these options:

* **A. Mostly on-device**
* **B. Mobile app + backend service**
* **C. Hybrid (on-device learning + backend checks/notifications)**

For each option, compare:

* reliability of proactive alerts
* battery impact
* privacy
* implementation complexity
* ongoing operational cost
* platform constraints (iOS/Android)

### 4) Recommended architecture (with reasoning)

Pick one and explain why.
Include a high-level component diagram in text form (not an image), e.g.:

* mobile app
* local storage
* background tasks/geofencing
* backend scheduler
* transport data adapters
* notification pipeline

### 5) Data model / entities

Propose a clean data model for the MVP and future versions. Include entities like:

* User settings/preferences
* Places (home, office, common destinations)
* Commute profiles/routes
* Calendar events (linked/inferred travel relevance)
* Departure observations (for learning)
* Notification rules
* Transport status snapshots/disruptions
* Alert decisions / notification history (for anti-spam + debugging)

For each entity, include:

* purpose
* key fields
* whether stored on-device vs backend
* privacy sensitivity notes

### 6) Notification logic and “learning” logic (deterministic first)

This is a key part — please think deeply here.

I want explicit logic for:

* commute vs non-commute detection
* weekday departure-window learning (rolling median / clustering etc.)
* handling WFH days and irregular routines
* avoiding one-off trips poisoning the model
* when to notify:

  * e.g. 15 min before usual departure
  * night before for planned engineering works
  * morning-of for major disruptions
* anti-spam rules:

  * dedupe
  * cooldowns
  * severity thresholds
  * “notify only if actionable”
* explainability:

  * each alert should have a simple reason (“Why am I seeing this?”)

Please include **example scenarios** and how the logic behaves.

### 7) Mobile platform constraints (iOS + Android)

I want a realistic section on:

* background location
* geofencing
* calendar permissions
* notification permissions
* scheduled/background tasks limits
* battery optimization constraints
* what can/can’t be relied on for exact timing

Explain how these constraints impact product design.

### 8) External integrations strategy

Focus on:

* calendar access
* transport status/disruption data
* planned engineering works data (UK context)

I do not need exact API credentials now, but I want:

* integration categories
* likely API/data source options
* fallback strategies
* normalization strategy (different providers, inconsistent formats)
* how to design transport provider adapters so I can swap providers later

### 9) Privacy & security approach

Propose a privacy-first design:

* data minimization
* on-device vs backend storage boundaries
* what sensitive data should never leave device (if possible)
* how to store tokens/secrets
* notification privacy considerations (lock screen)
* deletion/export controls
* auditability (“why this alert happened” log)

### 10) Testing strategy

I want a realistic testing plan for this kind of app:

* unit tests for decision logic
* integration tests for transport adapters
* simulated time-based tests (notification timing)
* geofence/location event simulation
* false positive / false negative testing
* manual field testing plan (commute days, weekends, disruptions)
* observability/logging needed during testing

### 11) Step-by-step build plan (small milestones)

I prefer **one step at a time** development.

Please propose a milestone plan where each milestone:

* has a clear goal
* is small enough to complete and verify
* includes acceptance criteria
* identifies what to stub/mock initially
* notes key risks

I want the plan to start with something testable quickly (e.g., backend transport-check prototype or notification decision engine), not a huge all-at-once build.

### 12) Risks / unknowns / assumptions to validate early

Please list the biggest risks, such as:

* API access limitations
* background execution reliability
* low-signal calendar events
* noisy location inference
* user trust if alerts are wrong
* notification fatigue

Then suggest how to validate each risk early in the project.

---

# Output format requirements

Please return your response as a **single Markdown planning document** with these exact headings:

1. Product Summary
2. MVP Scope (In/Out)
3. Architecture Options Comparison
4. Recommended Architecture
5. Data Model
6. Notification & Learning Logic
7. iOS / Android Platform Constraints
8. External Integrations Strategy
9. Privacy & Security Approach
10. Testing Strategy
11. Step-by-Step Milestone Plan
12. Risks, Unknowns, and Assumptions to Validate

---

# How to behave if something is ambiguous

If you see ambiguities:

* **Do not block on questions**
* State your assumptions clearly
* Proceed with a best-practice plan
* Add an “Open Questions” subsection at the end

---

# Final instruction (critical)

Again: **planning only**.
Do not generate code, files, scaffolding, commands, or implementation snippets yet.
I want a practical, buildable plan I can review first.
