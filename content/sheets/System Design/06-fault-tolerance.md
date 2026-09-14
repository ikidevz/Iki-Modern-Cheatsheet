# Designing for Fault Tolerance — System Design for Data Engineers

> Idempotency, exactly-once semantics, retries, checkpointing, and replay — building
> failure recovery into the design from the start rather than bolting it on after an
> incident.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Quick-Reference Table](#quick-reference-table)
3. [Delivery Guarantees: The Real Picture](#delivery-guarantees-the-real-picture)
4. [Retries with Exponential Backoff & Jitter](#retries-with-exponential-backoff--jitter)
5. [Checkpointing & Offset Management](#checkpointing--offset-management)
6. [Python: Simulating Crash-Safe Consumption](#python-simulating-crash-safe-consumption)
7. [Circuit Breakers](#circuit-breakers)
8. [Python: A Circuit Breaker Implementation](#python-a-circuit-breaker-implementation)
9. [The Saga Pattern (Compensating Transactions)](#the-saga-pattern-compensating-transactions)
10. [Chaos Engineering: Fault Injection](#chaos-engineering-fault-injection)
11. [Multi-Region Failover: RPO/RTO in Practice](#multi-region-failover-rporto-in-practice)
12. [Dead-Letter Queues](#dead-letter-queues)
13. [Replay & Backfill as First-Class Design](#replay--backfill-as-first-class-design)
14. [RPO & RTO](#rpo--rto)
15. [Gotchas](#gotchas)
16. [Pro Tips](#pro-tips)

---

## Core Concepts

Fault tolerance is not a bolt-on feature — it's a set of decisions made *while* designing the
happy path: what happens if a consumer crashes mid-batch, if a downstream system is
temporarily unreachable, if a message is delivered twice, or if an entire day of data needs
to be reprocessed because of a bug discovered a week later. A design that only works when
nothing goes wrong isn't a complete design in a DE system design interview.

## Quick-Reference Table

| Mechanism | Problem It Solves |
|---|---|
| Idempotent writes (see `05-cdc-idempotent-processing.md`) | Makes at-least-once delivery safe to reprocess without duplication |
| Checkpointing / offset commit | Ensures a crashed consumer resumes from the last known-safe point, not from scratch or from a lost position |
| Exponential backoff + jitter | Prevents a thundering-herd retry storm against a struggling downstream system |
| Circuit breaker | Stops hammering a failing downstream dependency, giving it room to recover |
| Dead-letter queue (DLQ) | Isolates poison/malformed messages so they don't block the rest of the stream |
| Replay / reprocessing | Recovers from bugs discovered after the fact, without needing a special "fix-up" code path |
| Replication (of data and of compute) | Survives a single node/broker/AZ failure without data loss or downtime |

## Delivery Guarantees: The Real Picture

| Guarantee | What It Actually Means | How You Get "Effectively-Once" |
|---|---|---|
| **At-most-once** | A message might be lost, but never duplicated | Rarely acceptable for DE pipelines — silent data loss |
| **At-least-once** | A message might be duplicated, but never silently lost | The realistic default for most brokers/consumers |
| **Exactly-once** | Marketed as "never lost, never duplicated" | In practice: **at-least-once delivery + idempotent processing** — very few systems provide true end-to-end exactly-once across a heterogeneous pipeline |

The practical takeaway for an interview: don't chase a literal "exactly-once" delivery
guarantee from your message broker as the whole solution. Design for at-least-once delivery
and make every write idempotent — that combination *behaves* like exactly-once from the
consumer's point of view, without depending on an end-to-end guarantee that's fragile the
moment a third-party system enters the pipeline.

## Retries with Exponential Backoff & Jitter

Naive retries (fixed delay, or worse, immediate retry-in-a-loop) tend to synchronize across
many failing clients and hit the recovering downstream system with a retry storm right as it
comes back up. **Full jitter** exponential backoff — picking a random delay between 0 and an
exponentially growing ceiling — spreads retries out and avoids that pattern.

```python
import random

def exponential_backoff_with_jitter(attempt: int, base_delay: float = 0.1,
                                     max_delay: float = 10.0) -> float:
    """Full jitter exponential backoff (the AWS-recommended form):
    delay = random(0, min(max_delay, base_delay * 2^attempt))."""
    exp_delay = min(max_delay, base_delay * (2 ** attempt))
    return round(random.uniform(0, exp_delay), 3)


for attempt in range(5):
    print(f"attempt {attempt+1}: would wait {exponential_backoff_with_jitter(attempt)}s before retrying")
```

Example output (randomized, illustrative):

```
attempt 1: would wait 0.032s before retrying
attempt 2: would wait 0.03s before retrying
attempt 3: would wait 0.26s before retrying
attempt 4: would wait 0.058s before retrying
attempt 5: would wait 0.857s before retrying
```

Always pair retries with a **maximum attempt count** and a fallback (dead-letter queue or
alert) — unbounded retries just turn a transient failure into an infinite loop.

## Checkpointing & Offset Management

A streaming/batch consumer should only advance its "I've safely processed up to here"
marker (a Kafka consumer offset, a watermark row in a control table, a checkpoint file in
Spark/Flink) **after** the corresponding output has been durably written — never before. This
ordering is what makes crash recovery correct: on restart, the consumer resumes from the last
committed point, reprocessing at most one in-flight batch, which idempotent writes make safe.

## Python: Simulating Crash-Safe Consumption

```python
class Consumer:
    """Simulates a streaming consumer that only advances its committed offset AFTER a
    batch is durably processed -- a crash mid-batch causes reprocessing of that one
    batch (at-least-once), not data loss, relying on idempotent writes to make the
    reprocessing safe."""

    def __init__(self, events):
        self.events = events
        self.committed_offset = -1

    def run(self, crash_after_offset=None):
        processed = []
        pos = self.committed_offset + 1
        while pos < len(self.events):
            event = self.events[pos]
            processed.append(event)
            if crash_after_offset is not None and pos == crash_after_offset:
                print(f"  [simulated crash after processing offset {pos}, BEFORE commit]")
                return processed  # crash before committing -- offset NOT advanced
            self.committed_offset = pos
            pos += 1
        return processed


events = ["e0", "e1", "e2", "e3", "e4"]
consumer = Consumer(events)

print("First run (crashes after offset 2, before committing):")
first_pass = consumer.run(crash_after_offset=2)
print("Processed:", first_pass, "| committed_offset:", consumer.committed_offset)

print("\nRestart -- resumes from last committed offset:")
second_pass = consumer.run()
print("Processed:", second_pass, "| committed_offset:", consumer.committed_offset)
```

Output:

```
First run (crashes after offset 2, before committing):
  [simulated crash after processing offset 2, BEFORE commit]
Processed: ['e0', 'e1', 'e2'] | committed_offset: 1

Restart -- resumes from last committed offset:
Processed: ['e2', 'e3', 'e4'] | committed_offset: 4
```

`e2` is processed twice across the two runs — this is at-least-once delivery in action, and
it's exactly why the write for `e2` needs to be idempotent (per `05-cdc-idempotent-processing.md`)
rather than, say, an unconditional `INSERT` that would create a duplicate row.

## Circuit Breakers

When a downstream dependency (an API, a database, another service) starts failing, a circuit
breaker stops sending it traffic for a cooldown period instead of retrying indefinitely
against something that's clearly down — protecting both the caller (which stops wasting time
waiting on failures) and the callee (which gets breathing room to recover instead of being
retried into the ground). Three states: **CLOSED** (normal, calls go through), **OPEN**
(failing fast without even attempting the call), **HALF_OPEN** (a trial call to see if the
dependency has recovered).

## Python: A Circuit Breaker Implementation

```python
import time

class CircuitBreaker:
    def __init__(self, failure_threshold=3, reset_timeout=5.0):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.state = "CLOSED"
        self.opened_at = None

    def call(self, fn):
        if self.state == "OPEN":
            if time.monotonic() - self.opened_at >= self.reset_timeout:
                self.state = "HALF_OPEN"
            else:
                return "short_circuited"
        try:
            result = fn()
            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failures = 0
            return result
        except Exception:
            self.failures += 1
            if self.failures >= self.failure_threshold:
                self.state = "OPEN"
                self.opened_at = time.monotonic()
            return "call_failed"


def flaky_downstream_call(fail=True):
    if fail:
        raise ConnectionError("downstream unavailable")
    return "ok"


cb = CircuitBreaker(failure_threshold=3, reset_timeout=0.2)
for i in range(5):
    result = cb.call(lambda: flaky_downstream_call(fail=True))
    print(f"call {i}: {result} (state={cb.state})")
```

Output:

```
call 0: call_failed (state=CLOSED)
call 1: call_failed (state=CLOSED)
call 2: call_failed (state=OPEN)
call 3: short_circuited (state=OPEN)
call 4: short_circuited (state=OPEN)
```

After 3 consecutive failures the breaker trips to `OPEN` and subsequent calls fail instantly
(`short_circuited`) without even attempting the downstream call, until `reset_timeout`
elapses and it moves to `HALF_OPEN` to test recovery.

## The Saga Pattern (Compensating Transactions)

When a single logical operation spans multiple services/systems (reserve inventory, charge
payment, schedule shipment), there's no distributed transaction that can atomically commit
or roll back all three together. The **saga pattern** handles this by running each step as
its own local transaction, and defining an explicit **compensating action** for each step —
if a later step fails, the orchestrator undoes the already-completed steps in reverse order.

```python
class SagaStep:
    def __init__(self, name, action, compensation):
        self.name = name
        self.action = action
        self.compensation = compensation


class SagaOrchestrator:
    """A sequence of local transactions across services; a failure partway through
    triggers COMPENSATING actions to undo the steps that already succeeded, in
    reverse order."""

    def __init__(self, steps):
        self.steps = steps

    def run(self, fail_at_step=None):
        completed = []
        for i, step in enumerate(self.steps):
            if fail_at_step is not None and i == fail_at_step:
                print(f"  [FAILURE at step '{step.name}']")
                self._compensate(completed)
                return "failed_and_compensated"
            step.action()
            completed.append(step)
        return "succeeded"

    def _compensate(self, completed_steps):
        for step in reversed(completed_steps):
            print(f"  compensating: {step.name}")
            step.compensation()


log = []
steps = [
    SagaStep("reserve_inventory", lambda: log.append("inventory reserved"), lambda: log.append("inventory released")),
    SagaStep("charge_payment", lambda: log.append("payment charged"), lambda: log.append("payment refunded")),
    SagaStep("schedule_shipment", lambda: log.append("shipment scheduled"), lambda: log.append("shipment cancelled")),
]

saga = SagaOrchestrator(steps)
result = saga.run(fail_at_step=2)  # shipment scheduling fails
print("Saga result:", result)
print("Log:", log)
```

Output:

```
  [FAILURE at step 'schedule_shipment']
  compensating: charge_payment
  compensating: reserve_inventory
Saga result: failed_and_compensated
Log: ['inventory reserved', 'payment charged', 'payment refunded', 'inventory released']
```

This is directly relevant to DE pipelines that orchestrate multi-system side effects (e.g. a
pipeline step that writes to a warehouse **and** triggers a downstream notification/webhook)
— if the notification step fails, the compensating action for the warehouse write (e.g.
marking that batch as "needs republish" rather than silently leaving it half-done) is what
keeps the overall pipeline consistent.

## Chaos Engineering: Fault Injection

Rather than waiting for production failures to test your fault-tolerance design, chaos
engineering deliberately injects failures to verify the retry/circuit-breaker/idempotency
mechanisms actually behave as designed:

```python
import random

def with_fault_injection(fn, failure_rate=0.3, seed=None):
    """Wraps any function so it randomly raises, simulating a flaky downstream
    dependency -- useful for testing that retry/circuit-breaker logic actually
    behaves as designed, rather than assuming it does."""
    rng = random.Random(seed)
    def wrapped(*args, **kwargs):
        if rng.random() < failure_rate:
            raise ConnectionError("[chaos] injected failure")
        return fn(*args, **kwargs)
    return wrapped


def call_downstream():
    return "ok"


flaky_call = with_fault_injection(call_downstream, failure_rate=0.5, seed=3)
results = []
for i in range(6):
    try:
        results.append(flaky_call())
    except ConnectionError as e:
        results.append(f"error: {e}")
print("Chaos test results:", results)
```

Output:

```
Chaos test results: ['error: [chaos] injected failure', 'ok', 'error: [chaos] injected failure', 'ok', 'ok', 'error: [chaos] injected failure']
```

In an interview, naming a specific chaos-testing practice ("we'd wrap downstream calls with
fault injection in staging to verify the circuit breaker actually trips at the expected
threshold, rather than trusting the design on paper") is a strong signal of operational
maturity — tools like Chaos Monkey, Gremlin, or AWS Fault Injection Simulator operationalize
exactly this pattern at the infrastructure level (killing nodes, injecting network latency)
rather than at the function level shown here.

## Multi-Region Failover: RPO/RTO in Practice

Turning the RPO/RTO concepts from earlier into concrete numbers for a specific replication
design:

```python
def replication_lag_to_rpo(replication_interval_sec):
    """Async replication every N seconds means, worst case, you lose up to one full
    interval of data if the primary fails right before a replication cycle completes."""
    return replication_interval_sec

def failover_rto_estimate(detection_time_sec, dns_propagation_sec, standby_warmup_sec):
    """RTO is the sum of every sequential step in the failover path -- detecting the
    failure, redirecting traffic, and the standby actually being ready to serve."""
    return detection_time_sec + dns_propagation_sec + standby_warmup_sec

print("RPO (async replication every 30s):", replication_lag_to_rpo(30), "sec")
print("RTO estimate:", failover_rto_estimate(detection_time_sec=60, dns_propagation_sec=30, standby_warmup_sec=45), "sec")
```

Output:

```
RPO (async replication every 30s): 30 sec
RTO estimate: 135 sec
```

If a stated requirement is "at most 15 minutes of data loss and 5 minutes of downtime," this
immediately tells you the 30-second async replication easily satisfies the RPO, but a
135-second failover comfortably meets a 5-minute RTO too — and if the requirement had instead
been RTO ≤ 60 seconds, this same calculation would tell you exactly which step (detection,
DNS, or standby warmup) needs to be optimized to close the gap, rather than vaguely
"making failover faster."

## Dead-Letter Queues

Not every failure should be retried forever — a malformed message (schema violation,
unparseable payload) will fail identically no matter how many times you retry it, and
leaving it at the head of the queue blocks every message behind it ("head-of-line
blocking"). A **dead-letter queue (DLQ)** is a separate destination for messages that fail
processing after a bounded number of retries, letting the main pipeline continue while the
bad messages wait for manual inspection or an automated remediation job.

```python
def process_with_dlq(events, process_fn, max_retries=2):
    dlq = []
    succeeded = []
    for event in events:
        attempts = 0
        while attempts <= max_retries:
            try:
                process_fn(event)
                succeeded.append(event)
                break
            except ValueError:
                attempts += 1
        else:
            dlq.append(event)
    return succeeded, dlq


def parse_amount(event):
    if event["amount"] == "not_a_number":
        raise ValueError("unparseable amount")
    return float(event["amount"])


events = [{"id": 1, "amount": "10.5"}, {"id": 2, "amount": "not_a_number"}, {"id": 3, "amount": "42"}]
ok, dead_lettered = process_with_dlq(events, parse_amount)
print("Succeeded:", [e["id"] for e in ok])
print("Dead-lettered:", [e["id"] for e in dead_lettered])
```

Output:

```
Succeeded: [1, 3]
Dead-lettered: [2]
```

## Replay & Backfill as First-Class Design

A design that can't reprocess historical data cleanly will eventually need to — a
transformation bug discovered a week later, a new business rule that must apply
retroactively, or a downstream consumer that needs to rebuild its state from scratch. Design
for this from day one:

- Keep raw/bronze data around long enough to support replay (a common default: 30-90 days
  hot, longer in cold storage).
- Make transformations **deterministic and idempotent** so replaying the same input always
  produces the same output — never dependent on wall-clock time or external mutable state.
- Prefer a replay mechanism that reuses the *same* processing code path as normal operation
  (this is the Kappa architecture's core argument) rather than a bespoke one-off backfill
  script that can drift from the real pipeline logic.

## RPO & RTO

Two standard reliability metrics worth naming explicitly when discussing disaster recovery:

- **RPO (Recovery Point Objective)**: how much data can you afford to lose, measured in time
  — "at most 5 minutes of data loss" implies replication/checkpointing at least that
  frequently.
- **RTO (Recovery Time Objective)**: how long can the system be down before it must be back
  up — drives decisions like hot standby replicas vs. cold backups.

Stating a concrete RPO/RTO ("we can tolerate 15 minutes of data loss and 1 hour of downtime")
turns a vague "make it reliable" requirement into something you can design specific
replication/checkpointing intervals against.

## Gotchas

- Retrying without a maximum attempt count or a fallback — this quietly turns "temporary
  downstream outage" into "our own pipeline never makes progress again."
- Committing an offset/checkpoint *before* the corresponding write is durable — this is the
  one ordering mistake that turns "occasionally reprocess a batch" into "silently lose data
  on crash."
- Treating a circuit breaker as a substitute for actual retry/backoff logic — they solve
  different problems and are normally used together, not as alternatives.
- Assuming replay/backfill will "just work" without deterministic, idempotent transformation
  logic — non-deterministic logic (e.g. anything keyed off `NOW()`) makes replay produce a
  different result than the original run, defeating the whole point.
- Designing fault tolerance only for the "cluster/node crash" scenario and forgetting
  "downstream dependency is slow/degraded but not fully down" — the latter is far more
  common in practice and is exactly what circuit breakers and backoff address.

## Pro Tips

- Proactively name a failure scenario during your design, even before the interviewer asks
  — "if the consumer crashes here, we resume from the last committed offset and the
  idempotent MERGE makes reprocessing safe" is a complete, confident sentence that often
  short-circuits (no pun intended) a whole line of follow-up questioning.
- Connect fault tolerance explicitly back to idempotency (`05-cdc-idempotent-processing.md`)
  every time — interviewers are listening for whether you understand these as one coherent
  mechanism, not a checklist of unrelated buzzwords.
- Have RPO/RTO numbers ready as a way to make "how reliable does this need to be"
  concrete and quantifiable rather than a vague adjective.
- If asked "what's the failure mode of your failure-handling mechanism" (e.g. "what if the
  DLQ itself fills up?"), have an answer ready — alerting on DLQ depth, a size-bounded DLQ
  with overflow alerting, is a reasonable one.
