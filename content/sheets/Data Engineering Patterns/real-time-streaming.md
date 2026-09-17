# Real-time Streaming

Real-time streaming continuously ingests, processes, and acts on events as they are generated.

## Use when

- Fraud detection, alerts, recommendations, or live dashboards need fresh data.
- Event-driven services are a better fit than scheduled jobs.
- The value of data drops quickly with latency.

## Example

```python
for event in consumer:
    if event["amount"] > 10000:
        alert("high-value transaction", event)
    sink.write(event)
    consumer.commit(event["offset"])
```

## Trade-offs

Streaming reduces latency and scales horizontally, but state management, replay, ordering, and exactly-once behavior require deliberate design.
