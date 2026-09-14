# Batch vs. Streaming vs. Hybrid Design — System Design for Data Engineers

> Choosing an architecture shape once scale and latency requirements are known — and
> defending that choice when the interviewer asks "why not just do it in batch?"

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table](#quick-reference-table)
3. [Batch Processing](#batch-processing)
4. [Streaming Processing](#streaming-processing)
5. [Event Time vs. Processing Time](#event-time-vs-processing-time)
6. [Watermarks & Late Data](#watermarks--late-data)
7. [Python: Simulating Event-Time Windowing with Watermarks](#python-simulating-event-time-windowing-with-watermarks)
8. [Window Types: Tumbling, Sliding, and Session](#window-types-tumbling-sliding-and-session)
9. [Lambda Architecture](#lambda-architecture)
10. [Kappa Architecture](#kappa-architecture)
11. [Lambda vs. Kappa: Decision Table](#lambda-vs-kappa-decision-table)
12. [Micro-Batching as a Middle Ground](#micro-batching-as-a-middle-ground)
13. [Gotchas](#gotchas)
14. [Pro Tips](#pro-tips)

---

## Core Concepts

The batch-vs-streaming decision is driven almost entirely by **one** requirement: how fresh
does the output need to be? Everything else (windowing complexity, operational overhead,
cost) follows from that. A common interview mistake is picking streaming because it "sounds
more impressive," when the stated freshness requirement (e.g. "a daily sales dashboard is
fine") was actually a batch problem the whole time.

## Quick-Reference Table

| Dimension | Batch | Streaming | Hybrid (Lambda/Kappa) |
|---|---|---|---|
| Freshness | Minutes to hours (or daily) | Sub-second to seconds | Streaming path fast, batch path authoritative |
| Typical tools | Spark batch, dbt, Airflow-scheduled jobs | Kafka Streams, Flink, Spark Structured Streaming | Both, reconciled |
| Correctness model | Easier — reprocess the whole dataset each run | Harder — must handle out-of-order/late events | Batch corrects streaming's approximations |
| Operational complexity | Lower | Higher (24/7 running jobs, backpressure, state stores) | Highest (two systems to maintain) |
| Cost model | Pay for compute only during scheduled runs | Continuously running compute | Continuously running + periodic batch compute |
| Best for | Reporting, historical analysis, ML training sets | Fraud detection, real-time dashboards, alerting | Systems needing both real-time approximate views and later-corrected accurate views |

## Batch Processing

Data is collected over a period, then processed as a complete, bounded set on a schedule
(hourly, daily). The defining advantage is **simplicity of correctness**: because you're
processing a complete dataset, there's no concept of "late data" — everything that happened
before the batch's cutoff is already there.

```
Sources ──▶ Land in storage (unprocessed) ──▶ Scheduled job reads full/incremental slice
                                                        │
                                                        ▼
                                          Transform, aggregate, write result
                                                        │
                                                        ▼
                                              Available to consumers
```

Trade-off: freshness is bounded by the schedule interval. If the job runs every 24 hours,
consumers never see data fresher than ~24 hours old, no matter how fast the job itself runs.

## Streaming Processing

Data is processed continuously, record-by-record or in small micro-batches, as it arrives.
This enables sub-second to low-second freshness, but introduces real complexity: events can
arrive out of order, late, or duplicated, and the processing job runs 24/7 rather than on a
schedule (which means it must handle its own failure/restart/backpressure story, covered in
`06-fault-tolerance.md`).

## Event Time vs. Processing Time

- **Event time**: when the event actually occurred (e.g. when a user clicked a button).
- **Processing time**: when the pipeline received/processed the event.

These diverge under network delay, retries, mobile devices buffering events offline, and
backpressure. Correct streaming systems window and aggregate by **event time**, not
processing time — otherwise a burst of late-arriving events gets attributed to the wrong
time window, silently skewing every downstream aggregate that depends on "what happened
during window X."

## Watermarks & Late Data

A **watermark** is the streaming engine's declaration: "I don't expect to see events with an
event time earlier than W anymore." It's how a system decides a window is safe to close and
emit a final result, trading off a bit of latency (waiting for stragglers) against
correctness (not waiting forever for data that may never arrive).

## Python: Simulating Event-Time Windowing with Watermarks

A minimal simulation of the mechanism real engines (Flink, Spark Structured Streaming) use
internally — useful for building intuition about *why* late data gets dropped past a point:

```python
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Event:
    event_id: str
    event_time: int    # seconds since epoch -- when it actually happened
    arrival_time: int  # seconds since epoch -- when the pipeline saw it
    value: float


class TumblingWindowAggregator:
    """Minimal simulation of event-time windowing with a watermark: illustrates how
    streaming engines decide when a window is 'done' and how late-arriving events
    are handled once that decision has been made."""

    def __init__(self, window_size_sec: int, watermark_delay_sec: int):
        self.window_size = window_size_sec
        self.watermark_delay = watermark_delay_sec
        self.windows: Dict[int, List[Event]] = defaultdict(list)
        self.closed_windows: set = set()
        self.late_events: List[Event] = []
        self.max_event_time_seen = 0

    def _window_start(self, event_time: int) -> int:
        return (event_time // self.window_size) * self.window_size

    def process(self, event: Event) -> str:
        self.max_event_time_seen = max(self.max_event_time_seen, event.event_time)
        watermark = self.max_event_time_seen - self.watermark_delay
        window_start = self._window_start(event.event_time)

        if window_start + self.window_size <= watermark and window_start in self.closed_windows:
            self.late_events.append(event)
            return "dropped_late"

        self.windows[window_start].append(event)
        return "accepted"

    def fire_ready_windows(self) -> Dict[int, dict]:
        watermark = self.max_event_time_seen - self.watermark_delay
        fired = {}
        for window_start, events in list(self.windows.items()):
            if window_start + self.window_size <= watermark and window_start not in self.closed_windows:
                fired[window_start] = {"count": len(events), "sum": round(sum(e.value for e in events), 2)}
                self.closed_windows.add(window_start)
        return fired


agg = TumblingWindowAggregator(window_size_sec=60, watermark_delay_sec=30)
events = [
    Event("e1", event_time=10, arrival_time=11, value=5.0),
    Event("e2", event_time=45, arrival_time=46, value=7.5),
    Event("e3", event_time=95, arrival_time=96, value=3.0),   # advances watermark past window [0,60)
    Event("e4", event_time=55, arrival_time=130, value=2.0),  # arrives after that window already fired
]

for e in events:
    result = agg.process(e)
    print(f"{e.event_id} (t={e.event_time}) -> {result}")
    for w_start, agg_result in agg.fire_ready_windows().items():
        print(f"  window [{w_start}, {w_start+60}) fired: {agg_result}")

late = Event("e5", event_time=20, arrival_time=200, value=99.0)
print(f"{late.event_id} (t={late.event_time}) -> {agg.process(late)}")
print("Late events dropped:", [e.event_id for e in agg.late_events])
```

Output:

```
e1 (t=10) -> accepted
e2 (t=45) -> accepted
e3 (t=95) -> accepted
  window [0, 60) fired: {'count': 2, 'sum': 12.5}
e4 (t=55) -> dropped_late
e5 (t=20) -> dropped_late
Late events dropped: ['e4', 'e5']
```

`e3` (event time 95) pushes the watermark to `95 - 30 = 65`, which is past the end of window
`[0, 60)`, so that window fires with only `e1` and `e2` (sum 12.5). `e4` (event time 55,
belongs to that same window) arrives afterward and is dropped — this is the concrete
trade-off a `watermark_delay_sec` (30 here) encodes: a bigger delay tolerates more lateness
at the cost of higher latency before any window ever fires.

## Window Types: Tumbling, Sliding, and Session

The windowing example above used a tumbling window, but three distinct window types show up
constantly in streaming design:

```python
def tumbling_windows(event_time, size):
    """Fixed-size, non-overlapping -- each event belongs to exactly one window."""
    start = (event_time // size) * size
    return [(start, start + size)]


def sliding_windows(event_time, size, slide):
    """Fixed-size but overlapping -- an event can belong to MULTIPLE windows at once,
    useful for smoothed/rolling metrics (e.g. 'trailing 5-minute average, updated every
    minute')."""
    windows = []
    first_start = event_time - (event_time % slide) - size + slide
    start = (first_start // slide) * slide
    while start <= event_time:
        if start <= event_time < start + size:
            windows.append((start, start + size))
        start += slide
    return windows


class SessionWindowTracker:
    """Groups events into a session that closes after `gap` seconds of inactivity --
    unlike tumbling/sliding windows, session boundaries are DATA-DEPENDENT (driven by
    actual event timing), not fixed on the clock. Common for user-activity sessionization."""
    def __init__(self, gap):
        self.gap = gap
        self.sessions = {}

    def add_event(self, key, event_time):
        if key not in self.sessions:
            self.sessions[key] = [event_time, event_time]
            return "new_session"
        start, last = self.sessions[key]
        if event_time - last > self.gap:
            self.sessions[key] = [event_time, event_time]
            return "new_session_after_gap"
        self.sessions[key][1] = event_time
        return "extended_session"


print("Tumbling (size=60) for t=95:", tumbling_windows(95, 60))
print("Sliding (size=60, slide=20) for t=95:", sliding_windows(95, 60, 20))

tracker = SessionWindowTracker(gap=30)
for t in [0, 10, 25, 100, 110, 500]:
    print(f"t={t}: {tracker.add_event('user_1', t)} | session so far: {tracker.sessions['user_1']}")
```

Output:

```
Tumbling (size=60) for t=95: [(60, 120)]
Sliding (size=60, slide=20) for t=95: [(40, 100), (60, 120), (80, 140)]
t=0: new_session | session so far: [0, 0]
t=10: extended_session | session so far: [0, 10]
t=25: extended_session | session so far: [0, 25]
t=100: new_session_after_gap | session so far: [100, 100]
t=110: extended_session | session so far: [100, 110]
t=500: new_session_after_gap | session so far: [500, 500]
```

| Window Type | Boundaries | Typical Use |
|---|---|---|
| **Tumbling** | Fixed, non-overlapping | "Revenue per 5-minute bucket" — each event counted exactly once |
| **Sliding** | Fixed size, overlapping | "Trailing 5-minute average, recomputed every minute" — smoother metric, higher compute cost (each event contributes to multiple windows) |
| **Session** | Data-dependent (gap-based) | "Group a user's clicks into a single browsing session" — boundary is defined by *inactivity*, not the clock |

Choosing wrong is a common subtle bug: using a tumbling window for something that's actually
a session-based concept (e.g. counting "sessions" by fixed 30-minute clock buckets instead of
by actual gaps in activity) silently splits or merges what a human would call one session.

## Lambda Architecture

Runs **two parallel pipelines** over the same source data:
- **Speed layer** (streaming): produces fast, approximate results with low latency.
- **Batch layer** (batch): reprocesses the complete dataset periodically, producing slower
  but authoritative/corrected results.
- **Serving layer**: merges both views, typically letting the batch layer's result
  eventually overwrite the speed layer's approximate one for the same time range.

```
Sources ──┬──▶ Streaming (speed layer)  ──▶ Fast, approximate view ──┐
          │                                                          ├──▶ Serving layer
          └──▶ Batch (batch layer)       ──▶ Slow, correct view    ──┘
```

Trade-off: you maintain **two separate codebases** doing conceptually the same
transformation (once in a streaming framework, once in a batch framework), which is real,
ongoing operational and correctness-drift risk — the two implementations can subtly diverge.

**Reconciliation** — how the serving layer actually merges the two views — is worth making
concrete rather than hand-waved:

```python
def reconcile_lambda(speed_layer_view: dict, batch_layer_view: dict) -> dict:
    """The batch layer is authoritative for any time range it has fully reprocessed;
    the speed layer fills in only the time ranges the batch layer hasn't caught up to yet."""
    reconciled = dict(speed_layer_view)
    reconciled.update(batch_layer_view)  # batch overwrites speed for overlapping keys
    return reconciled


speed_layer = {"2026-09-13T10": 120, "2026-09-13T11": 95, "2026-09-13T12": 40}  # approximate, incl. partial hour 12
batch_layer = {"2026-09-13T10": 118, "2026-09-13T11": 97}  # corrected, hasn't processed hour 12 yet

print("Reconciled view:", reconcile_lambda(speed_layer, batch_layer))
```

Output:

```
Reconciled view: {'2026-09-13T10': 118, '2026-09-13T11': 97, '2026-09-13T12': 40}
```

Hours 10 and 11 show the batch-corrected numbers (118, 97 — slightly different from the
streaming layer's 120, 95 approximation); hour 12 still shows the streaming layer's
approximate 40, because the batch layer hasn't reprocessed that hour yet. This is the
concrete mechanic behind "the batch layer eventually overwrites the speed layer's
approximate result" — a simple dictionary merge in this simplified illustration, and
typically a partition-overwrite or time-range-scoped `MERGE` in a real implementation.

## Kappa Architecture

Simplifies Lambda by using a **single streaming pipeline** for everything, including
historical reprocessing — treating batch as just "replaying the stream from an earlier
offset" rather than running a genuinely separate batch system.

```
Sources ──▶ Durable, replayable log (Kafka, retained long enough for full reprocessing)
                          │
                          ▼
              Single streaming processing pipeline
                          │
                          ▼
            Reprocess = replay the log from an earlier offset
                    through the SAME pipeline
```

Requires the source log to retain data long enough to support full reprocessing (or a
periodic re-seed from a durable data lake) and a streaming engine capable of processing
historical replay at high throughput, not just live low-latency streams.

## Lambda vs. Kappa: Decision Table

| Situation | Lean Toward |
|---|---|
| Team already has strong batch tooling (Spark/dbt) and streaming is a new capability being bolted on | Lambda (reuse existing batch investment, add a speed layer) |
| Team wants to minimize the number of distinct codebases/frameworks to maintain | Kappa (one pipeline, one mental model) |
| Reprocessing logic is genuinely different in batch vs. streaming (e.g. ML feature backfill needs a fundamentally different join strategy) | Lambda |
| Source system can retain/replay a long history economically (e.g. Kafka with tiered storage, or a lakehouse as the replayable source) | Kappa |
| Correctness requirements are strict enough that an authoritative "second pass" is valuable regardless of engineering cost | Lambda |

## Micro-Batching as a Middle Ground

Frameworks like Spark Structured Streaming process data in small, frequent batches (e.g.
every few seconds) rather than either a single daily job or true per-record streaming. This
is often the pragmatic default: most freshness requirements ("within a minute or two" rather
than genuinely sub-second) are satisfiable with micro-batching, at meaningfully lower
operational complexity than a true low-latency streaming engine.

```python
def micro_batch_latency_estimate(batch_interval_sec: float, avg_processing_time_sec: float) -> dict:
    """Rough end-to-end latency for a micro-batch pipeline: on average, an event waits
    half a batch interval before its batch even starts, plus the processing time itself."""
    avg_wait_for_batch_start = batch_interval_sec / 2
    return {
        "avg_end_to_end_latency_sec": round(avg_wait_for_batch_start + avg_processing_time_sec, 2),
        "worst_case_latency_sec": round(batch_interval_sec + avg_processing_time_sec, 2),
    }


print(micro_batch_latency_estimate(batch_interval_sec=10, avg_processing_time_sec=2))
```

Output:

```
{'avg_end_to_end_latency_sec': 7.0, 'worst_case_latency_sec': 12.0}
```

A 10-second micro-batch interval yields ~7 seconds average latency and a 12-second worst
case — often good enough, at far lower operational cost than a sub-second streaming engine.

## Gotchas

- Picking streaming when the actual freshness requirement is measured in hours, not seconds
  — this adds real operational cost (24/7 running infra, state management, late-data
  handling) for no requirement anyone actually stated.
- Forgetting that **streaming correctness is harder, not just faster** — out-of-order events,
  duplicate delivery, and late data are streaming-specific problems that batch mostly
  sidesteps by processing complete, bounded datasets.
- Assuming Kappa is strictly simpler than Lambda — it shifts complexity into needing a
  durable, replayable log and a streaming engine that can also do historical batch-speed
  reprocessing efficiently, which isn't free either.
- Using processing time instead of event time for windowing, which silently misattributes
  delayed events to the wrong window and skews aggregates in a way that's hard to detect
  after the fact.

## Pro Tips

- Always open this discussion by stating the freshness requirement explicitly, then let that
  single number drive the batch/streaming/hybrid decision — it's the cleanest way to show
  the interviewer your reasoning isn't just "streaming is trendy."
- If asked to justify a hybrid design, lead with the *specific* tension it resolves (fast
  approximate view now, corrected authoritative view later) rather than reciting "Lambda has
  a speed layer and a batch layer."
- Mention watermark delay as an explicit, tunable trade-off (latency vs. late-data tolerance)
  — it's a concrete design lever that shows real understanding beyond the buzzwords.
- Have one clean sentence ready for "why not Kappa/why not Lambda" in either direction — this
  is one of the most common deep-dive follow-ups in this category.
