# Apache Flink Cheatsheet for Data & Analytics Engineers

> A structured Flink reference for stream and batch processing — DataStream API, Table API/Flink SQL, event-time & windowing, state & checkpointing, connectors, and operations.

## 📑 Table of Contents

1. [🚀 Setup and Cluster Basics](#setup-and-cluster-basics)
2. [🧠 Core Concepts](#core-concepts)
3. [🌊 DataStream API](#datastream-api)
4. [🗃️ Table API & Flink SQL](#table-api-flink-sql)
5. [⏱️ Event Time, Watermarks & Windows](#event-time-watermarks-windows)
6. [💾 State Management](#state-management)
7. [✅ Checkpointing & Fault Tolerance](#checkpointing-fault-tolerance)
8. [🔌 Connectors (Sources & Sinks)](#connectors-sources-sinks)
9. [🐍 PyFlink](#pyflink)
10. [🚀 Deployment Modes](#deployment-modes)
11. [📊 Monitoring & Operations](#monitoring-operations)
12. [⚡ Performance Tuning](#performance-tuning)
13. [🎭 Complex Event Processing (Flink CEP)](#complex-event-processing-flink-cep)
14. [📡 Broadcast State & Async I/O](#broadcast-state-async-io)
15. [🧮 User-Defined Functions (Table API)](#user-defined-functions-table-api)
16. [🧪 Testing Flink Jobs](#testing-flink-jobs)
17. [☸️ Flink Kubernetes Operator](#flink-kubernetes-operator)
18. [⚠️ Common Gotchas](#common-gotchas)
19. [🎯 Best Practices](#best-practices)
20. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                    | Syntax / Command                                                             |
| ------------------------ | ----------------------------------------------------------------------------- |
| Start local cluster      | `./bin/start-cluster.sh` (Web UI at `localhost:8081`)                        |
| Submit a JAR job         | `./bin/flink run -c com.example.Job app.jar`                                 |
| List / cancel jobs       | `./bin/flink list`, `./bin/flink cancel <job-id>`                            |
| Stop with savepoint      | `./bin/flink stop --savepointPath s3://bucket/sp <job-id>`                   |
| Create stream env        | `StreamExecutionEnvironment.getExecutionEnvironment()`                       |
| Read Kafka source        | `KafkaSource.builder()...build()`                                            |
| Keyed transform          | `stream.keyBy(e -> e.getUserId())`                                           |
| Tumbling window          | `.window(TumblingEventTimeWindows.of(Time.minutes(5)))`                      |
| Enable checkpoints       | `env.enableCheckpointing(60000)`                                             |
| Flink SQL client         | `./bin/sql-client.sh`                                                        |
| Table from stream        | `tableEnv.fromDataStream(stream)`                                            |

## 🚀 Setup and Cluster Basics

```bash
# Download & start a local standalone cluster
tar -xzf flink-*.tgz && cd flink-*
./bin/start-cluster.sh          # Web UI: http://localhost:8081
./bin/stop-cluster.sh

# Submit a job (JAR-based)
./bin/flink run -c com.example.WordCount ./examples/wordcount.jar --input in.txt --output out.txt

# Run in detached mode with parallelism override
./bin/flink run -d -p 8 -c com.example.Job app.jar

# List running / cancel / savepoint
./bin/flink list -a
./bin/flink cancel <job_id>
./bin/flink savepoint <job_id> s3://bucket/savepoints/

# Maven dependency (Java, DataStream + Table API)
```

```xml
<dependency>
  <groupId>org.apache.flink</groupId>
  <artifactId>flink-streaming-java</artifactId>
  <version>1.19.0</version>
</dependency>
<dependency>
  <groupId>org.apache.flink</groupId>
  <artifactId>flink-table-api-java-bridge</artifactId>
  <version>1.19.0</version>
</dependency>
<dependency>
  <groupId>org.apache.flink</groupId>
  <artifactId>flink-connector-kafka</artifactId>
  <version>3.1.0-1.18</version>
</dependency>
```

## 🧠 Core Concepts

- **Unbounded vs bounded streams** — Flink models batch as a special case of streaming (a bounded stream). The same DataStream API runs both, controlled via `RuntimeExecutionMode`.
- **JobManager / TaskManager** — the JobManager coordinates scheduling, checkpoints, and recovery; TaskManagers execute tasks in slots (parallel instances of operators).
- **Operator chaining** — Flink fuses compatible operators into a single task to avoid serialization/network overhead; visible as boxes in the Web UI job graph.
- **Parallelism & slots** — each TaskManager offers a number of task slots; parallelism of an operator determines how many parallel instances run, up to the total slot count in the cluster.
- **Backpressure** — when a downstream operator is slower than upstream, Flink's credit-based flow control naturally slows producers; visible in the Web UI backpressure monitor.

```java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
env.setParallelism(4);
env.setRuntimeMode(RuntimeExecutionMode.STREAMING); // or BATCH, AUTOMATIC
```

## 🌊 DataStream API

```java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

DataStream<String> lines = env.socketTextStream("localhost", 9999);

DataStream<Tuple2<String, Integer>> counts = lines
    .flatMap((String line, Collector<Tuple2<String, Integer>> out) -> {
        for (String word : line.split("\\s")) {
            out.collect(Tuple2.of(word, 1));
        }
    })
    .returns(Types.TUPLE(Types.STRING, Types.INT))
    .keyBy(t -> t.f0)
    .sum(1);

counts.print();
env.execute("Word Count");
```

```java
// Common transformations
stream.map(x -> x * 2);
stream.filter(x -> x > 0);
stream.flatMap((x, out) -> out.collect(x));
stream.keyBy(x -> x.getKey());
stream.union(otherStream);
stream.connect(otherStream).map(new CoMapFunction<>() { ... });   // two input types
stream.process(new ProcessFunction<In, Out>() {                    // low-level, access to timers/state
    @Override
    public void processElement(In value, Context ctx, Collector<Out> out) { ... }
});

// Side outputs (route records without a separate filter pass)
final OutputTag<String> lateTag = new OutputTag<>("late-data") {};
SingleOutputStreamOperator<Out> main = stream.process(new ProcessFunction<>() {
    public void processElement(In v, Context ctx, Collector<Out> out) {
        if (isLate(v)) ctx.output(lateTag, "late: " + v);
        else out.collect(transform(v));
    }
});
DataStream<String> lateStream = main.getSideOutput(lateTag);
```

## 🗃️ Table API & Flink SQL

```java
StreamTableEnvironment tableEnv = StreamTableEnvironment.create(env);

// Register a Kafka-backed table via DDL
tableEnv.executeSql("""
    CREATE TABLE orders (
        order_id STRING,
        user_id  STRING,
        amount   DECIMAL(10,2),
        order_time TIMESTAMP(3),
        WATERMARK FOR order_time AS order_time - INTERVAL '5' SECOND
    ) WITH (
        'connector' = 'kafka',
        'topic' = 'orders',
        'properties.bootstrap.servers' = 'localhost:9092',
        'format' = 'json',
        'scan.startup.mode' = 'latest-offset'
    )
""");

Table result = tableEnv.sqlQuery("""
    SELECT user_id, TUMBLE_START(order_time, INTERVAL '1' HOUR) AS window_start,
           SUM(amount) AS total
    FROM orders
    GROUP BY user_id, TUMBLE(order_time, INTERVAL '1' HOUR)
""");

// Sink to another table
tableEnv.executeSql("INSERT INTO hourly_totals SELECT * FROM " + result);

// Interop: DataStream <-> Table
DataStream<Row> ds = tableEnv.toDataStream(result);
Table t = tableEnv.fromDataStream(ds, Schema.newBuilder().build());
```

```sql
-- Flink SQL CLI examples (./bin/sql-client.sh)
SET 'execution.runtime-mode' = 'streaming';
SET 'sql-client.execution.result-mode' = 'table';

-- Windowed aggregation (TVF window syntax, preferred over legacy GROUP BY TUMBLE)
SELECT window_start, window_end, user_id, SUM(amount) AS total
FROM TABLE(
    TUMBLE(TABLE orders, DESCRIPTOR(order_time), INTERVAL '1' HOUR)
)
GROUP BY window_start, window_end, user_id;

-- Temporal join (point-in-time correctness, e.g. exchange rates)
SELECT o.order_id, o.amount * r.rate AS amount_usd
FROM orders AS o
JOIN currency_rates FOR SYSTEM_TIME AS OF o.order_time AS r
ON o.currency = r.currency;

-- Pattern matching (CEP-in-SQL)
SELECT *
FROM orders
MATCH_RECOGNIZE (
    PARTITION BY user_id
    ORDER BY order_time
    MEASURES A.order_id AS start_order, C.order_id AS spike_order
    PATTERN (A B* C)
    DEFINE C AS C.amount > 3 * A.amount
);
```

## ⏱️ Event Time, Watermarks & Windows

```java
// Assign timestamps & watermarks (bounded out-of-orderness)
DataStream<Event> withWatermarks = stream.assignTimestampsAndWatermarks(
    WatermarkStrategy.<Event>forBoundedOutOfOrderness(Duration.ofSeconds(10))
        .withTimestampAssigner((event, ts) -> event.getEventTime())
);

// Window types
stream.keyBy(Event::getKey).window(TumblingEventTimeWindows.of(Time.minutes(5)));
stream.keyBy(Event::getKey).window(SlidingEventTimeWindows.of(Time.minutes(10), Time.minutes(5)));
stream.keyBy(Event::getKey).window(EventTimeSessionWindows.withGap(Time.minutes(15)));
stream.keyBy(Event::getKey).countWindow(100);          // count-based, not time-based

// Allowed lateness + late-data side output
stream.keyBy(Event::getKey)
    .window(TumblingEventTimeWindows.of(Time.minutes(5)))
    .allowedLateness(Time.minutes(1))
    .sideOutputLateData(lateTag)
    .aggregate(new MyAggregateFunction());
```

| Concept | What it controls |
| --- | --- |
| Event time | Timestamp embedded in the record (business time) — use for correctness/reproducibility |
| Processing time | Wall-clock time of the machine — lowest latency, not deterministic on replay |
| Watermark | "No more events older than X will arrive" signal that triggers window evaluation |
| Allowed lateness | Keeps window state around after the watermark passes so late events can still update it |
| Idle sources | Mark a partition/source idle so it doesn't stall the overall watermark (`withIdleness(...)`) |

## 💾 State Management

```java
// Keyed state inside a RichFunction
public class CountFunction extends RichFlatMapFunction<Event, Long> {
    private transient ValueState<Long> countState;

    @Override
    public void open(OpenContext ctx) {
        ValueStateDescriptor<Long> desc = new ValueStateDescriptor<>("count", Long.class);
        countState = getRuntimeContext().getState(desc);
    }

    @Override
    public void flatMap(Event value, Collector<Long> out) throws Exception {
        Long current = countState.value();
        current = (current == null) ? 1L : current + 1;
        countState.update(current);
        out.collect(current);
    }
}

// State primitives: ValueState<T>, ListState<T>, MapState<K,V>, ReducingState<T>, AggregatingState<IN,OUT>

// State TTL (auto-expire state, e.g. for GDPR / bounded growth)
StateTtlConfig ttlConfig = StateTtlConfig
    .newBuilder(Time.days(7))
    .setUpdateType(StateTtlConfig.UpdateType.OnCreateAndWrite)
    .setStateVisibility(StateTtlConfig.StateVisibility.NeverReturnExpired)
    .build();
ValueStateDescriptor<Long> desc = new ValueStateDescriptor<>("count", Long.class);
desc.enableTimeToLive(ttlConfig);
```

## ✅ Checkpointing & Fault Tolerance

```java
env.enableCheckpointing(60_000);                        // every 60s
CheckpointConfig cfg = env.getCheckpointConfig();
cfg.setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
cfg.setMinPauseBetweenCheckpoints(30_000);
cfg.setCheckpointTimeout(120_000);
cfg.setMaxConcurrentCheckpoints(1);
cfg.setExternalizedCheckpointCleanup(ExternalizedCheckpointCleanup.RETAIN_ON_CANCELLATION);
cfg.setUnalignedCheckpointsEnabled(true);                // helps under backpressure

env.setStateBackend(new EmbeddedRocksDBStateBackend());  // scales beyond heap
env.getCheckpointConfig().setCheckpointStorage("s3://bucket/checkpoints/");
```

```bash
# Restart a job from a savepoint (deliberate, e.g. for upgrades)
./bin/flink run -s s3://bucket/savepoints/savepoint-abc123 -c com.example.Job app.jar

# Stop-with-savepoint (graceful drain + snapshot)
./bin/flink stop --savepointPath s3://bucket/savepoints/ <job_id>
```

| | Checkpoint | Savepoint |
| --- | --- | --- |
| Trigger | Automatic, periodic | Manual, on demand |
| Purpose | Failure recovery | Planned restarts, version upgrades, rescaling |
| Format | Backend-optimized (fast) | Portable, self-contained |

## 🔌 Connectors (Sources & Sinks)

```java
// Kafka source (DataStream API)
KafkaSource<String> source = KafkaSource.<String>builder()
    .setBootstrapServers("localhost:9092")
    .setTopics("input-topic")
    .setGroupId("my-group")
    .setStartingOffsets(OffsetsInitializer.earliest())
    .setValueOnlyDeserializer(new SimpleStringSchema())
    .build();

DataStream<String> stream = env.fromSource(source, WatermarkStrategy.noWatermarks(), "Kafka Source");

// Kafka sink (exactly-once via transactions)
KafkaSink<String> sink = KafkaSink.<String>builder()
    .setBootstrapServers("localhost:9092")
    .setRecordSerializer(KafkaRecordSerializationSchema.builder()
        .setTopic("output-topic")
        .setValueSerializationSchema(new SimpleStringSchema())
        .build())
    .setDeliveryGuarantee(DeliveryGuarantee.EXACTLY_ONCE)
    .build();
stream.sinkTo(sink);

// JDBC sink
stream.addSink(JdbcSink.sink(
    "INSERT INTO metrics (k, v) VALUES (?, ?)",
    (stmt, e) -> { stmt.setString(1, e.key); stmt.setDouble(2, e.value); },
    JdbcExecutionOptions.builder().withBatchSize(1000).build(),
    new JdbcConnectionOptions.JdbcConnectionOptionsBuilder()
        .withUrl("jdbc:postgresql://localhost:5432/db").withDriverName("org.postgresql.Driver").build()
));

// FileSystem sink (bucketing / rolling files, e.g. to a data lake)
FileSink<String> fileSink = FileSink
    .forRowFormat(new Path("s3://bucket/output"), new SimpleStringEncoder<String>("UTF-8"))
    .withRollingPolicy(DefaultRollingPolicy.builder()
        .withMaxPartSize(MemorySize.ofMebiBytes(128))
        .withRolloverInterval(Duration.ofMinutes(15))
        .build())
    .build();
```

| Connector | Common use |
| --- | --- |
| `flink-connector-kafka` | Streaming ingestion/egress |
| `flink-connector-jdbc` | Lookup joins, sink to RDBMS/warehouse |
| `flink-connector-files` | Read/write to S3/HDFS/GCS in row or bulk (Parquet) format |
| `flink-connector-elasticsearch` | Sink to Elasticsearch/OpenSearch |
| `flink-sql-connector-debezium-json` / CDC connectors | Consume CDC change streams directly as SQL tables |

## 🐍 PyFlink

```python
from pyflink.table import EnvironmentSettings, TableEnvironment

env_settings = EnvironmentSettings.in_streaming_mode()
t_env = TableEnvironment.create(env_settings)

t_env.execute_sql("""
    CREATE TABLE source (
        id INT,
        name STRING,
        ts TIMESTAMP(3),
        WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
    ) WITH (
        'connector' = 'kafka',
        'topic' = 'events',
        'properties.bootstrap.servers' = 'localhost:9092',
        'format' = 'json'
    )
""")

t_env.execute_sql("""
    CREATE TABLE sink (name STRING, cnt BIGINT)
    WITH ('connector' = 'print')
""")

t_env.execute_sql("""
    INSERT INTO sink SELECT name, COUNT(*) AS cnt FROM source GROUP BY name
""").wait()

# DataStream API in Python
from pyflink.datastream import StreamExecutionEnvironment
env = StreamExecutionEnvironment.get_execution_environment()
ds = env.from_collection([1, 2, 3, 4, 5])
ds.map(lambda x: x * 2).print()
env.execute()
```

## 🚀 Deployment Modes

| Mode | Description | Typical use |
| --- | --- | --- |
| Session cluster | Long-running cluster, submit many jobs to it | Shared dev/test cluster |
| Application cluster | One cluster per job, `main()` runs on JobManager | Production isolation |
| Per-job (legacy) | Deprecated in favor of Application mode | — |
| Kubernetes (native) | Flink manages K8s resources directly | Cloud-native production |
| YARN | Flink runs as a YARN application | Hadoop-based clusters |

```bash
# Application mode on Kubernetes
./bin/flink run-application \
  --target kubernetes-application \
  -Dkubernetes.cluster-id=my-flink-cluster \
  -Dkubernetes.container.image=my-flink-image:latest \
  local:///opt/flink/usrlib/app.jar

# Session cluster on YARN
./bin/yarn-session.sh -d -jm 1600m -tm 4096m
./bin/flink run -m yarn-cluster app.jar
```

## 📊 Monitoring & Operations

```bash
# REST API (also backs the Web UI)
curl localhost:8081/jobs
curl localhost:8081/jobs/<job-id>
curl localhost:8081/jobs/<job-id>/checkpoints
curl -X PATCH "localhost:8081/jobs/<job-id>?mode=cancel"
```

- **Web UI** (`:8081`) — job graph, backpressure, checkpoint history, TaskManager logs/metrics, flame graphs (1.13+).
- **Metrics reporters** — Prometheus, Datadog, Graphite, JMX; export operator-level throughput, latency, checkpoint duration, state size.
- **Key metrics to watch**: `numRecordsInPerSecond`/`OutPerSecond`, `checkpointDuration`, `checkpointSize`, `currentInputWatermark` skew across subtasks, `busyTimeMsPerSecond` (backpressure proxy).

## ⚡ Performance Tuning

```java
// Object reuse (avoid defensive copies between operators — unsafe if you mutate objects downstream)
env.getConfig().enableObjectReuse();

// RocksDB tuning for large state
EmbeddedRocksDBStateBackend backend = new EmbeddedRocksDBStateBackend();
backend.setPredefinedOptions(PredefinedOptions.SPINNING_DISK_OPTIMIZED_HIGH_MEM);

// Mini-batch aggregation for high-throughput SQL aggregations
tableEnv.getConfig().set("table.exec.mini-batch.enabled", "true");
tableEnv.getConfig().set("table.exec.mini-batch.allow-latency", "5 s");
tableEnv.getConfig().set("table.exec.mini-batch.size", "5000");

// Local-global aggregation (two-phase, reduces skew from hot keys)
tableEnv.getConfig().set("table.optimizer.agg-phase-strategy", "TWO_PHASE");
```

- Prefer **Parquet/ORC + columnar formats** for file sources/sinks in batch and table workloads.
- Set **parallelism close to partition count** for Kafka sources to avoid idle subtasks.
- Watch for **key skew** — a handful of hot keys can bottleneck a single subtask; consider two-phase aggregation or key salting.

## 🎭 Complex Event Processing (Flink CEP)

Flink CEP lets you detect patterns across a stream of events — fraud sequences, IoT alert chains, SLA breaches — without hand-rolling stateful `ProcessFunction`s.

```java
import org.apache.flink.cep.CEP;
import org.apache.flink.cep.pattern.Pattern;
import org.apache.flink.cep.pattern.conditions.SimpleCondition;

// Detect: a login failure followed by 2+ more failures within 1 minute (brute-force pattern)
Pattern<LoginEvent, ?> bruteForcePattern = Pattern.<LoginEvent>begin("first")
    .where(new SimpleCondition<LoginEvent>() {
        @Override
        public boolean filter(LoginEvent e) { return !e.isSuccess(); }
    })
    .next("second")
    .where(new SimpleCondition<LoginEvent>() {
        @Override
        public boolean filter(LoginEvent e) { return !e.isSuccess(); }
    })
    .timesOrMore(2)                       // 2 or more consecutive failures
    .within(Time.minutes(1));             // all within a 1-minute window

PatternStream<LoginEvent> patternStream = CEP.pattern(
    loginEvents.keyBy(LoginEvent::getUserId), bruteForcePattern
);

DataStream<Alert> alerts = patternStream.select(matches -> {
    List<LoginEvent> failures = matches.get("second");
    return new Alert(failures.get(0).getUserId(), "Possible brute-force attempt");
});
```

```java
// Quantifiers and combinators
Pattern.<Event>begin("start").where(...)
    .followedBy("middle").where(...)      // relaxed contiguity: other events may appear between
    .followedByAny("middle2").where(...)  // non-deterministic relaxed contiguity: all matches, not just first
    .next("end").where(...)               // strict contiguity: must immediately follow
    .oneOrMore()                          // 1+
    .optional()                           // 0 or 1
    .times(3)                             // exactly 3
    .greedy();                            // consume as many matching events as possible

// Timeout handling for patterns that don't complete in time
OutputTag<Alert> timeoutTag = new OutputTag<Alert>("timeout") {};
SingleOutputStreamOperator<Alert> result = patternStream.select(
    timeoutTag,
    (Map<String, List<LoginEvent>> pattern, long timeoutTimestamp) -> new Alert("timed out"),
    (Map<String, List<LoginEvent>> pattern) -> new Alert("matched")
);
DataStream<Alert> timeouts = result.getSideOutput(timeoutTag);
```

- CEP is best for **sequence/ordering-sensitive detection** (A then B then C); for simple threshold alerting (count > N in a window), a plain windowed aggregation is simpler and cheaper.
- `MATCH_RECOGNIZE` in Flink SQL (see the SQL section above) covers a large subset of CEP's use cases declaratively — prefer it when the pattern is expressible in SQL, and drop to the Java CEP library only for patterns SQL can't express.

## 📡 Broadcast State & Async I/O

```java
// Broadcast state: fan a low-throughput control stream (rules, config) out to every parallel
// instance of a high-throughput data stream, without a network shuffle per data event.
MapStateDescriptor<String, Rule> ruleStateDescriptor = new MapStateDescriptor<>(
    "rules", Types.STRING, Types.POJO(Rule.class));

BroadcastStream<Rule> ruleBroadcastStream = ruleStream.broadcast(ruleStateDescriptor);

DataStream<Alert> alerts = transactionStream
    .keyBy(Transaction::getAccountId)
    .connect(ruleBroadcastStream)
    .process(new KeyedBroadcastProcessFunction<String, Transaction, Rule, Alert>() {

        @Override
        public void processElement(Transaction tx, ReadOnlyContext ctx, Collector<Alert> out) throws Exception {
            for (Map.Entry<String, Rule> entry : ctx.getBroadcastState(ruleStateDescriptor).immutableEntries()) {
                if (entry.getValue().matches(tx)) {
                    out.collect(new Alert(tx, entry.getValue()));
                }
            }
        }

        @Override
        public void processBroadcastElement(Rule rule, Context ctx, Collector<Alert> out) throws Exception {
            ctx.getBroadcastState(ruleStateDescriptor).put(rule.getId(), rule);
        }
    });
```

```java
// Async I/O: call an external service (feature store, enrichment API) without blocking the
// operator thread per-record — critical when per-call latency (10-100ms) would otherwise
// throttle throughput to one record per RTT.
AsyncDataStream.unorderedWait(
    inputStream,
    new AsyncFunction<Order, EnrichedOrder>() {
        @Override
        public void asyncInvoke(Order order, ResultFuture<EnrichedOrder> resultFuture) {
            CompletableFuture
                .supplyAsync(() -> externalClient.lookup(order.getCustomerId()))
                .thenAccept(profile -> resultFuture.complete(
                    Collections.singleton(new EnrichedOrder(order, profile))));
        }
    },
    1000, TimeUnit.MILLISECONDS,   // per-request timeout
    100                            // max in-flight requests per parallel instance
);
```

| Pattern | Solves |
| --- | --- |
| Broadcast state | Distributing rules/config/reference data to every parallel task instance cheaply |
| Async I/O | Enriching a stream from a slow external system without collapsing throughput |
| Connect + CoProcessFunction | Joining two streams with custom, non-SQL logic (e.g., asymmetric buffering) |

## 🧮 User-Defined Functions (Table API)

```java
// Scalar UDF: one row in, one value out
public static class MaskEmail extends ScalarFunction {
    public String eval(String email) {
        int at = email.indexOf('@');
        return at <= 2 ? email : email.substring(0, 2) + "***" + email.substring(at);
    }
}
tableEnv.createTemporarySystemFunction("mask_email", MaskEmail.class);
tableEnv.executeSql("SELECT mask_email(email) FROM customers");

// Table function: one row in, zero-to-many rows out (used with LATERAL/CROSS JOIN)
public static class SplitTags extends TableFunction<String> {
    public void eval(String tags) {
        for (String tag : tags.split(",")) collect(tag.trim());
    }
}
tableEnv.createTemporarySystemFunction("split_tags", SplitTags.class);
tableEnv.executeSql("""
    SELECT o.order_id, t.tag
    FROM orders o, LATERAL TABLE(split_tags(o.tags)) AS t(tag)
""");

// Aggregate UDF: many rows in, one value out, with explicit accumulator state
public static class WeightedAvg extends AggregateFunction<Double, WeightedAvgAccumulator> {
    @Override public WeightedAvgAccumulator createAccumulator() { return new WeightedAvgAccumulator(); }
    @Override public Double getValue(WeightedAvgAccumulator acc) {
        return acc.count == 0 ? null : acc.sum / acc.count;
    }
    public void accumulate(WeightedAvgAccumulator acc, double value, double weight) {
        acc.sum += value * weight;
        acc.count += weight;
    }
}
```

```python
# PyFlink Python UDFs (crosses a serialization boundary — see gotchas below)
from pyflink.table import DataTypes
from pyflink.table.udf import udf

@udf(result_type=DataTypes.STRING())
def mask_email(email: str) -> str:
    at = email.index('@')
    return email if at <= 2 else email[:2] + "***" + email[at:]

t_env.create_temporary_function("mask_email", mask_email)
t_env.execute_sql("SELECT mask_email(email) FROM customers")
```

## 🧪 Testing Flink Jobs

```java
// Unit test a stateful function directly with a test harness — no cluster needed
@Test
public void testCountFunction() throws Exception {
    KeyedOneInputStreamOperatorTestHarness<String, Event, Long> harness =
        ProcessFunctionTestHarnesses.forKeyedProcessFunction(
            new CountFunction(), Event::getKey, Types.STRING);

    harness.open();
    harness.processElement(new Event("a", 1), 0L);
    harness.processElement(new Event("a", 2), 10L);

    assertEquals(2L, harness.extractOutputValues().get(1).longValue());
}
```

```java
// Full mini-cluster integration test — runs a real (small) Flink cluster in-process
public class WordCountIntegrationTest {
    @RegisterExtension
    static final MiniClusterExtension miniCluster = new MiniClusterExtension(
        new MiniClusterResourceConfiguration.Builder()
            .setNumberSlotsPerTaskManager(2)
            .setNumberTaskManagers(1)
            .build());

    @Test
    void testJobProducesExpectedOutput() throws Exception {
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        DataStream<String> result = buildWordCountPipeline(env, testInputStream());
        CollectSink.values.clear();
        result.addSink(new CollectSink());
        env.execute();
        assertThat(CollectSink.values).contains("hello: 2");
    }
}
```

```python
# PyFlink: assert on collected output from a bounded test source
from pyflink.datastream import StreamExecutionEnvironment

def test_pipeline():
    env = StreamExecutionEnvironment.get_execution_environment()
    ds = env.from_collection([1, 2, 3])
    result = list(ds.map(lambda x: x * 2).execute_and_collect())
    assert result == [2, 4, 6]
```

- **Test harnesses** (`ProcessFunctionTestHarnesses`, `KeyedOneInputStreamOperatorTestHarness`) let you unit-test timers, state, and watermarks without spinning up any cluster — the fastest feedback loop.
- **`MiniClusterExtension`** gives true end-to-end confidence (serialization, scheduling, checkpointing) at the cost of slower tests — reserve for a smaller set of integration tests.

## ☸️ Flink Kubernetes Operator

```yaml
# FlinkDeployment CRD — the standard way to run Flink natively on Kubernetes in production
apiVersion: flink.apache.org/v1beta1
kind: FlinkDeployment
metadata:
  name: order-processor
spec:
  image: flink:1.19
  flinkVersion: v1_19
  flinkConfiguration:
    taskmanager.numberOfTaskSlots: "2"
    state.backend: rocksdb
    state.checkpoints.dir: s3://bucket/checkpoints
    high-availability: kubernetes
    high-availability.storageDir: s3://bucket/ha
  serviceAccount: flink
  jobManager:
    resource: { memory: "2048m", cpu: 1 }
  taskManager:
    resource: { memory: "4096m", cpu: 2 }
  job:
    jarURI: local:///opt/flink/usrlib/app.jar
    parallelism: 4
    upgradeMode: savepoint       # graceful savepoint-based upgrades on spec change
```

```bash
kubectl apply -f order-processor.yaml
kubectl get flinkdeployments
kubectl logs deploy/order-processor
```

- The operator manages the full lifecycle — deployment, upgrades (via automatic savepoints), and restarts on failure — declaratively, instead of hand-scripted `flink run` calls against a native Kubernetes session.
- `upgradeMode: savepoint` means changing the spec (new image, new parallelism) triggers a safe stop-with-savepoint and restart automatically — the Kubernetes-native equivalent of the manual CLI workflow shown earlier.

## ⚠️ Common Gotchas

- **Operators must be serializable** — lambdas capturing non-serializable state (a DB connection, for example) fail at job submission, not at runtime; initialize such resources in `open()` of a `RichFunction` instead.
- **Watermarks don't advance without events** — an idle Kafka partition can stall time-based windows across all keys unless you configure `withIdleness(...)`.
- **`enableObjectReuse()` is unsafe if you mutate and hold onto objects** across operator boundaries — only enable it once you've verified operators don't retain references to reused buffers.
- **Changing job topology breaks savepoint compatibility** unless operators have explicit `uid()`s — always set `.uid("stable-name")` on stateful operators so Flink can map state back correctly after code changes.
- **`GROUP BY` without a window in streaming SQL** produces an ever-updating (retracting) result, not a one-shot batch aggregate — make sure downstream sinks support updates/retractions (`changelog` semantics) or use a windowed TVF aggregation instead.
- **RocksDB state backend serializes on every access** — much slower per-access than the heap backend, but scales far beyond available heap; choose based on state size, not habit.

## 🎯 Best Practices

- Always assign `uid()`s to stateful operators before going to production, to keep savepoint restores safe across code changes.
- Use the **Table API/SQL** for standard ETL and aggregation; drop to the DataStream API only for custom logic (complex event processing, non-standard state access, fine-grained timers).
- Externalize checkpoints and store them in durable, versioned object storage (S3/GCS) — never rely solely on local disk.
- Set explicit watermark strategies with idleness handling for any source that can have gaps.
- Load-test with realistic data skew, not just volume — skew is what actually breaks Flink jobs in production.

## 💡 Pro Tips

1. **Prefer TVF windows (`TABLE(TUMBLE(...))`) over legacy `GROUP BY TUMBLE`** in Flink SQL — more expressive and composable with joins.
2. **Use `EXPLAIN` on Table API/SQL queries** to see the physical plan before running at scale.
3. **Savepoints are your upgrade lever** — always stop-with-savepoint before deploying new job code.
4. **Unaligned checkpoints** help enormously when backpressure is high, at the cost of slightly larger checkpoint size.
5. **Side outputs** are cheaper than a second filtered stream — use them for late data, errors, and dead-letter routing.
6. **The Web UI backpressure tab** is the fastest way to find your bottleneck operator.
7. **Test with `MiniClusterWithClientResource`** (JUnit) for realistic integration tests without a full cluster.
8. **PyFlink is a thin wrapper over the JVM** — Python UDFs cross a serialization boundary and are slower than Java/SQL built-ins; keep hot-path logic in SQL where possible.
