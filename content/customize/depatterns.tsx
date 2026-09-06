import { MarkdownContent } from "@/components/markdown-content";
import { PatternCard, type PatternCardData } from "@/components/pattern-card";
import type { CustomizedComponentProps } from ".";

type Pattern = PatternCardData;

const patterns: Pattern[] = [
	{
		name: "ETL Pattern",
		tags: ["Batch", "Transform", "Warehouse"],
		definition:
			"Extract data from source systems, apply business-rule transformations in a dedicated processing step, then load the validated result into a target warehouse.",
		whenToUse:
			"Use ETL when the target has strict schema requirements, transformations are compute-intensive, or data quality must be guaranteed before loading.",
		pros: [
			"Schema enforced before load",
			"Easier compliance and auditing",
			"Mature tooling ecosystem",
		],
		cons: [
			"Slower time to insight",
			"Processing step can become a bottleneck",
			"Schema changes need coordination",
		],
		examples: {
			"Pure Python": `raw_rows = extract("raw_sales.csv")
clean_rows = []
for row in raw_rows:
	if row["customer_id"] and float(row["amount"]) >= 0:
		clean_rows.append({
			"customer_id": int(row["customer_id"]),
			"amount": float(row["amount"]),
			"sale_date": row["sale_date"],
		})

load(clean_rows, "warehouse.db")
print(f"loaded {len(clean_rows)} valid rows")`,
			"AWS Glue": `glue = GlueContext(SparkContext.getOrCreate())
raw = glue.create_dynamic_frame.from_catalog(
    database="raw", table_name="sales"
)
clean = DropNullFields.apply(raw)
clean = ApplyMapping.apply(clean, mappings=[
	("customer_id", "long", "customer_id", "long"),
	("amount", "double", "amount", "double"),
])
glue.write_dynamic_frame.from_catalog(
	frame=clean, database="analytics", table_name="sales"
)`,
		},
	},
	{
		name: "ELT Pattern",
		tags: ["Cloud", "Raw Load", "Data Lake"],
		definition:
			"Load raw data directly into a lake or warehouse, then transform it in place using the target system's compute engine.",
		whenToUse:
			"Ideal for cloud-native stacks where cheap storage and powerful SQL engines make in-place transformation more efficient than pre-processing.",
		pros: [
			"Raw data is always preserved",
			"Transformations are flexible and repeatable",
			"Fast initial load",
		],
		cons: [
			"Raw sensitive data may land first",
			"Query costs can spike",
			"Requires capable warehouse compute",
		],
		examples: {
			Snowflake: `COPY INTO raw.events
FROM @landing/events
FILE_FORMAT = (TYPE = JSON);

CREATE OR REPLACE TABLE analytics.events AS
SELECT
		value:id::NUMBER AS event_id,
		value:type::VARCHAR AS event_type,
		value:occurred_at::TIMESTAMP AS occurred_at
FROM raw.events;

SELECT COUNT(*) FROM analytics.events;`,
			BigQuery: `LOAD DATA INTO raw.events
FROM FILES (format = 'PARQUET',
	uris = ['gs://landing/events/*.parquet']);

CREATE OR REPLACE TABLE analytics.events AS
SELECT event_id, event_type, occurred_at
FROM raw.events
WHERE occurred_at IS NOT NULL;`,
		},
	},
	{
		name: "Change Data Capture",
		tags: ["CDC", "Real-time", "Replication"],
		definition:
			"Capture INSERT, UPDATE, and DELETE operations from a source database and publish only those changes downstream instead of polling the whole table.",
		whenToUse:
			"Use CDC to synchronize databases with low latency, build event-driven services, maintain audit history, or keep a warehouse aligned with OLTP data.",
		pros: [
			"Near real-time replication",
			"Minimal source database load",
			"Full change history",
		],
		cons: [
			"Requires log access and operational setup",
			"Schema changes need care",
			"Ordering guarantees vary",
		],
		examples: {
			"Debezium + Kafka": `{"op":"u","before":{"id":7,"status":"new"},
 "after":{"id":7,"status":"paid"},"source":{"table":"orders"}}

# Register the connector once; offsets make restarts resumable.
curl -X POST http://connect:8083/connectors \\
  -H 'Content-Type: application/json' \\
  -d @postgres-orders-connector.json`,
			Python: `for change in consume_changes("orders"):
	if change.operation == "DELETE":
		warehouse.delete("orders", change.key)
	else:
		warehouse.upsert("orders", change.after)
	checkpoint(change.source_lsn)

print("CDC consumer caught up")`,
		},
	},
	{
		name: "Data Lakehouse",
		tags: ["Delta Lake", "ACID", "Unified"],
		definition:
			"Put a transactional metadata and indexing layer such as Delta Lake or Apache Iceberg on object storage to combine lake economics with warehouse-style reliability.",
		whenToUse:
			"Use a lakehouse when one storage tier must support raw files, ML workloads, ACID updates, time travel, and fast analytical SQL.",
		pros: [
			"One copy of data",
			"ACID transactions on object storage",
			"Time travel and versioning",
		],
		cons: [
			"Newer tooling has a learning curve",
			"Compaction adds operations",
			"Some features create cloud lock-in",
		],
		examples: {
			PySpark: `from delta.tables import DeltaTable

target_path = "s3://lake/sales"
df.write.format("delta").mode("append").save(target_path)

table = DeltaTable.forPath(spark, target_path)
table.alias("target").merge(
    updates.alias("source"), "target.id = source.id"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()

table.vacuum(168)`,
			SQL: `SELECT * FROM lake.sales
VERSION AS OF 42
WHERE sale_date >= DATE '2026-01-01';

DESCRIBE HISTORY lake.sales;`,
		},
	},
	{
		name: "Real-time Streaming",
		tags: ["Kafka", "Stream", "Low-latency"],
		definition:
			"Continuously ingest, process, and act on events as they are generated, usually within milliseconds or seconds.",
		whenToUse:
			"Choose streaming for fraud detection, live dashboards, IoT telemetry, recommendations, or any workload where stale data loses value.",
		pros: [
			"Immediate insights",
			"Event-driven architecture",
			"Scales horizontally",
		],
		cons: [
			"Complex state management",
			"Exactly-once semantics are difficult",
			"Higher operational cost",
		],
		examples: {
			Python: `for event in consumer:
    if event["amount"] > 10000:
        alert("high-value transaction", event)
	sink.write(event)
	consumer.commit(event["offset"])

consumer.close()`,
			Kafka: `kafka-console-consumer.sh \\
  --topic orders --group fraud-detector \\
  --bootstrap-server localhost:9092 \\
  --from-beginning \\
  --property print.key=true`,
		},
	},
	{
		name: "Batch Processing",
		tags: ["Scheduled", "High-volume", "Hadoop/Spark"],
		definition:
			"Accumulate data over a period and process it in a scheduled, high-throughput run. Batch workloads trade freshness for efficiency and simplicity.",
		whenToUse:
			"Use batch for nightly reports, end-of-day reconciliation, periodic model training, or workloads that are latency-tolerant.",
		pros: [
			"Simple to reason about",
			"Cost-effective for large volumes",
			"Straightforward failure recovery",
		],
		cons: [
			"Data is stale between runs",
			"Long failures are costly",
			"Poor fit for real-time needs",
		],
		examples: {
			Spark: `daily = spark.read.parquet("s3://lake/events/")
daily.groupBy("country").sum("revenue") \\
	.withColumnRenamed("sum(revenue)", "revenue") \\
	.write.mode("overwrite").partitionBy("country") \\
	.parquet("s3://mart/daily")

print("daily batch published")`,
			Airflow: `@dag(schedule="0 2 * * *", start_date=start)
def daily_pipeline():
	extract = PythonOperator(task_id="extract", python_callable=extract_data)
	transform = PythonOperator(task_id="transform", python_callable=transform_data)
	publish = PythonOperator(task_id="publish", python_callable=publish_data)
	extract >> transform >> publish`,
		},
	},
	{
		name: "Data Cataloging Pattern",
		tags: ["Metadata", "Discovery", "Governance"],
		definition:
			"Maintain a searchable inventory of datasets, columns, owners, lineage, classifications, and quality signals so teams can discover and trust data.",
		whenToUse:
			"A catalog pays off when many teams and sources make datasets hard to find, or compliance requires knowing where sensitive data lives.",
		pros: [
			"Improves discoverability",
			"Enables governance",
			"Reduces duplicate datasets",
		],
		cons: [
			"High initial setup cost",
			"Requires cultural adoption",
			"Metadata can go stale",
		],
		examples: {
			Python: `catalog.register(
    name="sales_daily",
    location="s3://lake/sales/",
    owner="data-platform",
    tags=["finance", "pii"],
)
catalog.set_schema("sales_daily", {
	"customer_id": "integer",
	"amount": "decimal(12, 2)",
})
catalog.set_lineage("sales_daily", upstream=["raw.orders"])`,
			SQL: `COMMENT ON TABLE mart.sales_daily
IS 'Owner: data-platform; SLA: daily';

COMMENT ON COLUMN mart.sales_daily.customer_id
IS 'Stable customer identifier; classified as internal';`,
		},
	},
	{
		name: "Data Quality Gates",
		tags: ["Validation", "Contracts", "Trust"],
		definition:
			"Validate schema, completeness, uniqueness, freshness, and business rules at pipeline boundaries before bad data reaches downstream consumers.",
		whenToUse:
			"Add quality gates to critical pipelines, shared datasets, and any flow where silent corruption is more expensive than a delayed run.",
		pros: [
			"Failures are caught early",
			"Rules become executable documentation",
			"Downstream trust improves",
		],
		cons: [
			"Checks add runtime",
			"Rules need ownership",
			"Bad thresholds create alert fatigue",
		],
		examples: {
			GreatExpectations: `expectation = {
  "expectation_type": "expect_column_values_to_not_be_null",
	"kwargs": {"column": "customer_id"}
}
result = validator.expect_table_row_count_to_be_between(
		min_value=1, max_value=10_000_000
)
assert result["success"], result["result"]`,
			SQL: `SELECT COUNT(*) AS invalid_rows
FROM staging.orders
WHERE customer_id IS NULL
	 OR amount < 0;

-- Fail the load when this returns any rows.
SELECT order_id
FROM staging.orders
GROUP BY order_id
HAVING COUNT(*) > 1;`,
		},
	},
	{
		name: "Idempotent Pipelines",
		tags: ["Reliability", "Retries", "Backfill"],
		definition:
			"Design each run so repeating it produces the same correct result instead of duplicate rows, duplicate side effects, or a corrupted destination.",
		whenToUse:
			"Make every retriable load and backfill idempotent, especially when orchestration retries after timeouts or partial failures.",
		pros: ["Safe retries", "Reliable backfills", "Simpler incident recovery"],
		cons: [
			"Needs stable keys or run markers",
			"Some external side effects are difficult",
			"Often requires merge logic",
		],
		examples: {
			SQL: `MERGE INTO mart.orders AS target
USING staging.orders AS source
ON target.order_id = source.order_id
WHEN MATCHED THEN UPDATE SET status = source.status
WHEN NOT MATCHED THEN INSERT (order_id, status)
VALUES (source.order_id, source.status);`,
			Python: `run_key = f"orders:{run_date}"
if not ledger.exists(run_key):
    load_partition(run_date)
	ledger.record(run_key)
else:
	print(f"{run_key} already completed; skipping")`,
		},
	},
	{
		name: "Slowly Changing Dimensions",
		tags: ["Warehouse", "History", "Dimensions"],
		definition:
			"Preserve or overwrite dimension history deliberately when business attributes change, commonly through Type 1 overwrite or Type 2 versioned rows.",
		whenToUse:
			"Use SCDs when analysts need to report facts according to the attributes that were true at the time of the event.",
		pros: [
			"Historical reporting stays accurate",
			"Business changes are explicit",
			"Works across warehouse tools",
		],
		cons: [
			"Adds joins and storage",
			"Late-arriving changes are tricky",
			"Grain must be documented",
		],
		examples: {
			SQL: `UPDATE dim_customer
SET valid_to = CURRENT_DATE, is_current = false
WHERE customer_id = :id AND is_current = true;

INSERT INTO dim_customer (..., is_current)
VALUES (..., true);

-- Facts join the dimension version valid at event time.
SELECT f.order_id, d.segment
FROM fact_orders f
JOIN dim_customer d ON f.customer_id = d.customer_id
 AND f.order_date >= d.valid_from
 AND f.order_date < COALESCE(d.valid_to, DATE '9999-12-31');`,
			dbt: `{{ config(materialized="snapshot") }}
{% snapshot customers_snapshot %}
{{ config(unique_key="customer_id", strategy="timestamp", updated_at="updated_at") }}
SELECT * FROM {{ source("crm", "customers") }}
{% endsnapshot %}`,
		},
	},
	{
		name: "Orchestration and DAGs",
		tags: ["Dependencies", "Scheduling", "Recovery"],
		definition:
			"Represent pipeline work as a dependency graph so tasks run in the right order, parallelize safely, and expose retries and failure states.",
		whenToUse:
			"Use orchestration when a workflow has multiple steps, schedules, dependencies, retries, notifications, or backfills.",
		pros: [
			"Dependencies are visible",
			"Retries and alerts are centralized",
			"Backfills become manageable",
		],
		cons: [
			"Schedulers need operations",
			"DAGs can become tightly coupled",
			"Sensors can waste capacity",
		],
		examples: {
			Airflow: `extract = PythonOperator(task_id="extract", ...)
transform = PythonOperator(task_id="transform", ...)
publish = PythonOperator(task_id="publish", ...)
extract >> transform >> publish

# Independent branches can run in parallel.
extract >> [transform, quality_check]
[transform, quality_check] >> publish`,
			StepFunctions: `{"StartAt":"Extract","States":{
	"Extract":{"Type":"Task","Retry":[{"ErrorEquals":["States.ALL"],"MaxAttempts":3}],"Next":"Transform"},
	"Transform":{"Type":"Task","Next":"Publish"},
	"Publish":{"Type":"Task","End":true}
}}`,
		},
	},
	{
		name: "Schema Evolution",
		tags: ["Compatibility", "Contracts", "Streaming"],
		definition:
			"Change data structures over time while keeping producers, consumers, storage, and historical data compatible.",
		whenToUse:
			"Plan schema evolution for shared tables, event streams, APIs, and any dataset consumed by teams you do not deploy together.",
		pros: [
			"Consumers can upgrade independently",
			"Breaking changes become visible",
			"Historical data remains queryable",
		],
		cons: [
			"Compatibility rules need enforcement",
			"Old and new fields coexist",
			"Breaking migrations take coordination",
		],
		examples: {
			Avro: `{
  "type": "record",
  "name": "Order",
  "fields": [{"name":"id","type":"string"},
			 {"name":"currency","type":"string","default":"USD"}] 
}

# Backward-compatible consumers can ignore the new field.`,
			SQL: `ALTER TABLE mart.orders
ADD COLUMN currency VARCHAR DEFAULT 'USD';

-- Deploy additively first, backfill, then make it required later.
UPDATE mart.orders
SET currency = 'USD'
WHERE currency IS NULL;`,
		},
	},
];

export function DataEngineeringPatterns({ item }: CustomizedComponentProps) {
	return (
		<div className='w-full'>
			<div className='mb-8'>
				<div className='font-mono text-xs uppercase tracking-[0.16em] text-primary mb-3'>
					Top 12 · Reference Guide · Code Examples
				</div>
				<h2 className='text-3xl md:text-4xl font-semibold tracking-tight text-foreground'>
					{item.name}
				</h2>
				<p className='mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground'>
					{item.covers}
				</p>
			</div>

			<div className='space-y-3'>
				{patterns.map((pattern, index) => (
					<PatternCard
						key={pattern.name}
						index={index}
						pattern={pattern}
						codeByStack={Object.fromEntries(
							Object.entries(pattern.examples).map(([stack, code]) => [
								stack,
								<MarkdownContent
									key={stack}
									source={`\`\`\`${languageFor(stack)}\n${code}\n\`\`\``}
								/>,
							]),
						)}
					/>
				))}
			</div>

			<p className='mt-8 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-faint'>
				Data Engineering Patterns · Reference Guide
			</p>
		</div>
	);
}

function languageFor(stack: string) {
	if (
		stack === "SQL" ||
		stack === "Snowflake" ||
		stack === "BigQuery" ||
		stack === "dbt"
	) {
		return "sql";
	}
	if (
		stack === "AWS Glue" ||
		stack === "PySpark" ||
		stack === "Python" ||
		stack === "Pure Python" ||
		stack === "GreatExpectations" ||
		stack === "Airflow"
	) {
		return "python";
	}
	if (stack === "Kafka" || stack === "StepFunctions") return "json";
	if (stack === "Avro") return "json";
	return "text";
}
