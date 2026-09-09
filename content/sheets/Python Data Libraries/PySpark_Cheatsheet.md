# PySpark Cheatsheet for Data & Analytics Engineers

> A structured PySpark reference for data & analytics engineering — DataFrame creation and I/O through aggregation, window functions, joins, ETL patterns, and performance tuning. Added the lazy-evaluation primer, UDF and broadcast/accumulator sections, and a gotchas list that weren't in the original.

## 📑 Table of Contents

1. [🚀 Setup & Initialization](#setup-initialization)
2. [🧠 Transformations vs Actions (Lazy Evaluation)](#transformations-vs-actions-lazy-evaluation)
3. [📊 Creating DataFrames](#creating-dataframes)
4. [🔍 Data Profiling & Quality Checks](#data-profiling-quality-checks)
5. [🎯 Advanced Column Operations](#advanced-column-operations)
6. [🔧 Data Type Conversions & Validations](#data-type-conversions-validations)
7. [🚰 Advanced Filtering & Conditions](#advanced-filtering-conditions)
8. [📈 Advanced Aggregations](#advanced-aggregations)
9. [🪟 Advanced Window Functions](#advanced-window-functions)
10. [🔗 Advanced Joins & Merges](#advanced-joins-merges)
11. [🧩 User-Defined Functions (Use Sparingly)](#user-defined-functions-use-sparingly)
12. [📡 Broadcast Variables & Accumulators](#broadcast-variables-accumulators)
13. [🧹 Advanced Data Cleaning](#advanced-data-cleaning)
14. [📅 Advanced Date & Time Operations](#advanced-date-time-operations)
15. [💾 Advanced Read/Write Patterns](#advanced-readwrite-patterns)
16. [🏗️ ETL Pipeline Patterns](#etl-pipeline-patterns)
17. [🔍 Debugging & Optimization](#debugging-optimization)
18. [📊 Analytics Patterns](#analytics-patterns)
19. [🔐 Security & Governance](#security-governance)
20. [⚠️ Common Gotchas](#common-gotchas)
21. [🎯 Performance Tuning Tips](#performance-tuning-tips)
22. [🧰 Handy One-Liners](#handy-one-liners)
23. [📚 Best Practices for Data Engineers](#best-practices-for-data-engineers)

## ⚡ Quick Reference

**Syntax cheatsheet**

| Task              | Syntax                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Read / write      | `spark.read.parquet(p)` / `df.write.mode('overwrite').parquet(p)`        |
| Inspect           | `df.show()`, `df.printSchema()`, `df.describe()`, `df.count()`           |
| Select / filter   | `df.select('a','b')`, `df.filter(col('x') > 0)`                          |
| New column        | `df.withColumn('total', col('a') * col('b'))`                            |
| Group & aggregate | `df.groupBy('col').agg(F.sum('x').alias('total'))`                       |
| Sort              | `df.orderBy(col('a').desc())`                                            |
| Join              | `df1.join(df2, on='key', how='left')`, `df1.join(broadcast(df2), 'key')` |
| Window function   | `F.row_number().over(Window.partitionBy('g').orderBy('x'))`              |
| Register SQL view | `df.createOrReplaceTempView('t')` then `spark.sql('SELECT ...')`         |
| Cache             | `df.cache()` / `df.persist(StorageLevel.MEMORY_AND_DISK)`                |
| Explain plan      | `df.explain(True)`                                                       |

**Transformations vs actions**

| Transformations (lazy)                              | Actions (trigger execution)                 |
| --------------------------------------------------- | ------------------------------------------- |
| `select`, `filter`, `withColumn`, `join`, `groupBy` | `show`, `count`, `collect`, `write`, `take` |

## 🚀 Setup & Initialization

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.sql.window import Window

# Create SparkSession with optimized configs
spark = SparkSession.builder \
    .appName("DataEngineering") \
    .config("spark.sql.adaptive.enabled", "true") \
    .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
    .config("spark.sql.adaptive.skewJoin.enabled", "true") \
    .config("spark.sql.execution.arrow.pyspark.enabled", "true") \
    .config("spark.sql.legacy.timeParserPolicy", "CORRECTED") \
    .config("spark.sql.shuffle.partitions", "200") \
    .enableHiveSupport() \
    .getOrCreate()

# Set log level
spark.sparkContext.setLogLevel("WARN")
```

## 🧠 Transformations vs Actions (Lazy Evaluation)

```python
# Transformations are lazy — they just build up a query plan, nothing runs yet
df2 = df.filter(col('amount') > 0).withColumn('total', col('price') * col('qty'))

# Actions trigger actual execution across the cluster
df2.show()          # action
df2.count()         # action
df2.collect()       # action - pulls ALL rows to the driver, use with caution
df2.write.parquet('path')  # action

# See the plan Spark will actually execute
df2.explain(True)
```

**Rule of thumb:** chain as many transformations as you like — they're free until an action runs. But avoid `.collect()`/`.toPandas()` on anything that isn't guaranteed to be small; both pull the full result set into the driver's memory.

## 📊 Creating DataFrames

```python
# From list of tuples
data = [("Alice", 25), ("Bob", 30)]
df = spark.createDataFrame(data, ["name", "age"])

# From list of dictionaries
data = [{"name": "Alice", "age": 25}, {"name": "Bob", "age": 30}]
df = spark.createDataFrame(data)

# From pandas DataFrame
import pandas as pd
pandas_df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [25, 30]})
df = spark.createDataFrame(pandas_df)

# Read from various sources
df = spark.read.csv("file.csv", header=True, inferSchema=True)
df = spark.read.json("file.json")
df = spark.read.parquet("file.parquet")
df = spark.read.option("multiline", "true").json("file.json")

# Read with schema enforcement
schema = StructType([
    StructField("id", IntegerType(), False),
    StructField("name", StringType(), True),
    StructField("timestamp", TimestampType(), True)
])
df = spark.read.schema(schema).csv("file.csv")

# Read from Delta Lake
df = spark.read.format("delta").load("/path/to/delta-table")

# Read from Hive tables
df = spark.table("database.table_name")
df = spark.sql("SELECT * FROM database.table_name")
```

## 🔍 Data Profiling & Quality Checks

```python
# Comprehensive data profiling
def profile_dataframe(df):
    print("=== DataFrame Profile ===")
    print(f"Row Count: {df.count():,}")
    print(f"Column Count: {len(df.columns)}")
    print(f"Partitions: {df.rdd.getNumPartitions()}")

    # Null counts per column
    null_counts = df.select([
        count(when(col(c).isNull(), c)).alias(c)
        for c in df.columns
    ])
    print("\n=== Null Counts ===")
    null_counts.show()

    # Distinct counts per column
    distinct_counts = df.agg(*[
        countDistinct(c).alias(c)
        for c in df.columns
    ])
    print("\n=== Distinct Counts ===")
    distinct_counts.show()

    # Data types
    print("\n=== Data Types ===")
    df.printSchema()

    return df

# Check for duplicates
duplicate_count = df.count() - df.dropDuplicates().count()
print(f"Duplicate rows: {duplicate_count}")

# Find duplicate records based on key columns
duplicates = df.groupBy("id", "name") \
    .agg(count("*").alias("count")) \
    .filter(col("count") > 1)

# Data quality checks
quality_checks = df.select(
    count("*").alias("total_rows"),
    count(when(col("id").isNull(), 1)).alias("null_ids"),
    count(when(col("amount") < 0, 1)).alias("negative_amounts"),
    count(when(col("email").rlike(r'^[^@]+@[^@]+\.[^@]+$'), 1)).alias("valid_emails"),
    countDistinct("user_id").alias("unique_users")
)

# Outlier detection using IQR
def detect_outliers(df, column):
    quantiles = df.approxQuantile(column, [0.25, 0.75], 0.01)
    q1, q3 = quantiles[0], quantiles[1]
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr

    outliers = df.filter(
        (col(column) < lower_bound) | (col(column) > upper_bound)
    )
    return outliers, lower_bound, upper_bound
```

## 🎯 Advanced Column Operations

```python
# Complex column transformations
df = df.withColumn("full_name", concat_ws(" ", col("first_name"), col("last_name"))) \
    .withColumn("age_group",
        when(col("age") < 18, "0-17")
        .when(col("age") < 30, "18-29")
        .when(col("age") < 50, "30-49")
        .otherwise("50+")
    ) \
    .withColumn("is_valid",
        when((col("amount") > 0) & (col("status") == "active"), True)
        .otherwise(False)
    )

# Struct operations
df = df.withColumn("address_struct",
    struct(
        col("street").alias("street"),
        col("city").alias("city"),
        col("zipcode").alias("zip")
    )
)

# Extract from struct
df = df.withColumn("city", col("address_struct.city"))

# Array operations
df = df.withColumn("tags", split(col("tag_string"), ","))
df = df.withColumn("tag_count", size(col("tags")))
df = df.withColumn("first_tag", col("tags")[0])
df = df.withColumn("tags_concat", concat_ws("|", col("tags")))

# Explode arrays
df = df.withColumn("tag", explode(col("tags")))

# Map operations
df = df.withColumn("properties",
    create_map(
        lit("key1"), col("value1"),
        lit("key2"), col("value2")
    )
)

# JSON operations
df = df.withColumn("parsed_json", from_json(col("json_string"), schema))
df = df.withColumn("json_field", col("parsed_json.field_name"))
df = df.withColumn("json_string", to_json(struct(col("field1"), col("field2"))))
```

## 🔧 Data Type Conversions & Validations

```python
# Safe casting with validation
df = df.withColumn("amount_clean",
    when(col("amount").cast("double").isNotNull(),
         col("amount").cast("double"))
    .otherwise(lit(0.0))
)

# Date parsing with multiple formats
from pyspark.sql.functions import coalesce

df = df.withColumn("parsed_date",
    coalesce(
        to_date(col("date_string"), "yyyy-MM-dd"),
        to_date(col("date_string"), "MM/dd/yyyy"),
        to_date(col("date_string"), "dd-MMM-yyyy")
    )
)

# Unix timestamp conversions
df = df.withColumn("timestamp_from_unix", from_unixtime(col("unix_time")))
df = df.withColumn("unix_from_timestamp", unix_timestamp(col("timestamp_col")))

# Handle timezone conversions
df = df.withColumn("utc_time",
    from_utc_timestamp(col("timestamp_col"), "America/New_York")
)
```

## 🚰 Advanced Filtering & Conditions

```python
# Complex filter conditions
df_filtered = df.filter(
    (col("status").isin(["active", "pending"])) &
    (col("amount").between(100, 1000)) &
    (~col("email").like("%test%")) &
    (col("created_date") >= "2024-01-01")
)

# Filter with SQL expressions
df_filtered = df.filter("""
    amount > 100
    AND status IN ('active', 'pending')
    AND date >= '2024-01-01'
""")

# Anti-patterns to filter out
bad_emails = ["test@test.com", "admin@admin.com"]
df_clean = df.filter(~col("email").isin(bad_emails))

# Use exists/not exists pattern with subqueries
valid_users = df_users.select("user_id")
df_filtered = df_transactions.join(
    broadcast(valid_users),
    "user_id",
    "left_semi"
)
```

## 📈 Advanced Aggregations

```python
# Multiple aggregations with different conditions
df_agg = df.groupBy("department").agg(
    count("*").alias("total_count"),
    count(when(col("status") == "active", 1)).alias("active_count"),
    sum(when(col("amount") > 0, col("amount")).otherwise(0)).alias("positive_sum"),
    avg("salary").alias("avg_salary"),
    expr("percentile_approx(salary, 0.5)").alias("median_salary"),
    expr("percentile_approx(salary, array(0.25, 0.75))").alias("quartiles"),
    collect_list("name").alias("names_list"),
    collect_set("category").alias("unique_categories"),
    first("hire_date").alias("first_hire"),
    last("termination_date").alias("last_termination")
)

# Pivot with aggregations
pivot_df = df.groupBy("year", "quarter") \
    .pivot("product_category") \
    .agg(
        sum("revenue").alias("revenue"),
        count("*").alias("count")
    )

# Rollup and Cube for subtotals
rollup_df = df.rollup("year", "quarter", "category") \
    .agg(sum("amount").alias("total_amount"))

cube_df = df.cube("region", "product", "channel") \
    .agg(sum("sales").alias("total_sales"))

# Custom aggregation using expr
df_custom_agg = df.groupBy("category").agg(
    expr("sum(case when status = 'completed' then amount else 0 end)").alias("completed_amount"),
    expr("count(distinct user_id)").alias("unique_users"),
    expr("max(case when priority = 1 then created_date end)").alias("latest_priority_date")
)
```

## 🪟 Advanced Window Functions

```python
# Running totals and moving averages
window_running = Window.partitionBy("user_id").orderBy("date") \
    .rowsBetween(Window.unboundedPreceding, Window.currentRow)

df = df.withColumn("running_total", sum("amount").over(window_running))
df = df.withColumn("running_avg", avg("amount").over(window_running))

# Moving average (7-day window)
window_7day = Window.partitionBy("product_id").orderBy("date") \
    .rowsBetween(-6, 0)
df = df.withColumn("ma_7day", avg("sales").over(window_7day))

# Lag and Lead for period-over-period comparisons
window_ordered = Window.partitionBy("product_id").orderBy("date")
df = df.withColumn("prev_month_sales", lag("sales", 1).over(window_ordered))
df = df.withColumn("next_month_sales", lead("sales", 1).over(window_ordered))
df = df.withColumn("mom_growth",
    (col("sales") - col("prev_month_sales")) / col("prev_month_sales") * 100
)

# Percent rank and ntile for percentiles
window_rank = Window.partitionBy("department").orderBy(col("salary").desc())
df = df.withColumn("salary_rank", rank().over(window_rank))
df = df.withColumn("salary_percentile", percent_rank().over(window_rank))
df = df.withColumn("salary_quartile", ntile(4).over(window_rank))

# First and last value in window
df = df.withColumn("first_order_date",
    first("order_date").over(window_ordered)
)
df = df.withColumn("last_order_date",
    last("order_date").over(window_ordered)
)

# Cumulative distribution
df = df.withColumn("cumulative_dist",
    cume_dist().over(window_rank)
)
```

## 🔗 Advanced Joins & Merges

```python
# Join with conditions and broadcasting
from pyspark.sql.functions import broadcast

large_df.join(
    broadcast(small_df),
    (large_df.user_id == small_df.id) &
    (large_df.date >= small_df.start_date) &
    (large_df.date <= small_df.end_date),
    "left"
)

# Self-join for hierarchical data
df_employees.alias("e").join(
    df_employees.alias("m"),
    col("e.manager_id") == col("m.employee_id"),
    "left"
).select(
    col("e.employee_id"),
    col("e.name").alias("employee_name"),
    col("m.name").alias("manager_name")
)

# Cross join (use with caution)
df1.crossJoin(df2)

# Union with schema alignment
df_combined = df1.unionByName(df2, allowMissingColumns=True)

# Anti-join to find non-matches
df_unmatched = df1.join(df2, "key", "left_anti")

# Deduplication logic with window functions
window_dedup = Window.partitionBy("user_id", "date").orderBy(col("timestamp").desc())
df_dedup = df.withColumn("row_num", row_number().over(window_dedup)) \
    .filter(col("row_num") == 1) \
    .drop("row_num")
```

## 🧩 User-Defined Functions (Use Sparingly)

```python
from pyspark.sql.functions import udf, pandas_udf
from pyspark.sql.types import StringType, DoubleType

# Standard Python UDF — row-by-row, serializes through the JVM<->Python boundary (slow)
@udf(returnType=StringType())
def classify(amount):
    if amount is None:
        return None
    return 'high' if amount > 100 else 'low'

df = df.withColumn('tier', classify(col('amount')))

# Pandas UDF (vectorized) — operates on batches via Arrow, much faster than a plain UDF
@pandas_udf(DoubleType())
def discounted(price: 'pd.Series') -> 'pd.Series':
    return price * 0.9

df = df.withColumn('discounted_price', discounted(col('price')))

# Register a UDF for use in Spark SQL
spark.udf.register('classify_sql', classify)
spark.sql("SELECT *, classify_sql(amount) AS tier FROM my_view")
```

**Rule of thumb:** reach for a built-in `pyspark.sql.functions` first — it runs entirely on the JVM and can be optimized by Catalyst. Only write a UDF when there's truly no built-in equivalent, and prefer a `pandas_udf` over a plain `udf` when you do.

## 📡 Broadcast Variables & Accumulators

```python
# Broadcast variable: ship a read-only lookup value to every executor once,
# instead of re-sending it with every task (different from a broadcast JOIN hint)
lookup = {'A': 'Alpha', 'B': 'Beta', 'C': 'Gamma'}
bc_lookup = spark.sparkContext.broadcast(lookup)

@udf(returnType=StringType())
def expand_code(code):
    return bc_lookup.value.get(code, 'Unknown')

df = df.withColumn('category_name', expand_code(col('category_code')))

# Release it from executor memory when no longer needed
bc_lookup.unpersist()

# Accumulator: a write-only, cluster-wide counter useful for monitoring/debugging
bad_record_count = spark.sparkContext.accumulator(0)

def validate(row):
    global bad_record_count
    if row['amount'] is None:
        bad_record_count.add(1)
    return row

df.foreach(validate)
print(f"Bad records: {bad_record_count.value}")
```

**Rule of thumb:** accumulators are best for monitoring/debugging counts, not for driving business logic — their value is only reliable after an action has fully completed.

## 🧹 Advanced Data Cleaning

```python
# Standardize text fields
df = df.withColumn("email_clean",
    lower(trim(regexp_replace(col("email"), r'\s+', '')))
)

# Remove special characters
df = df.withColumn("name_clean",
    regexp_replace(col("name"), r'[^a-zA-Z0-9\s]', '')
)

# Handle mixed data types in string columns
df = df.withColumn("amount_clean",
    when(col("amount").rlike(r'^\d+\.?\d*$'), col("amount").cast("double"))
    .when(col("amount").rlike(r'^\$[\d,]+\.?\d*$'),
          regexp_replace(col("amount"), r'[\$,]', '').cast("double"))
    .otherwise(None)
)

# Impute missing values with different strategies
from pyspark.ml.feature import Imputer

imputer = Imputer(
    inputCols=["age", "income"],
    outputCols=["age_imputed", "income_imputed"],
    strategy="median"  # or "mean", "mode"
)
df = imputer.fit(df).transform(df)

# Conditional imputation
df = df.withColumn("salary_filled",
    when(col("salary").isNull(),
         avg("salary").over(Window.partitionBy("department")))
    .otherwise(col("salary"))
)

# Trim whitespace from all string columns
string_columns = [field.name for field in df.schema.fields
                  if isinstance(field.dataType, StringType)]
for col_name in string_columns:
    df = df.withColumn(col_name, trim(col(col_name)))
```

## 📅 Advanced Date & Time Operations

```python
# Date arithmetic
df = df.withColumn("next_week", date_add(col("date"), 7))
df = df.withColumn("last_month", add_months(col("date"), -1))
df = df.withColumn("days_diff", datediff(col("end_date"), col("start_date")))
df = df.withColumn("months_diff", months_between(col("end_date"), col("start_date")))

# Extract date parts
df = df.withColumn("year", year(col("date")))
df = df.withColumn("quarter", quarter(col("date")))
df = df.withColumn("month", month(col("date")))
df = df.withColumn("week", weekofyear(col("date")))
df = df.withColumn("day_of_week", dayofweek(col("date")))
df = df.withColumn("day_name", date_format(col("date"), "EEEE"))

# Business day calculations (pseudo-code pattern)
df = df.withColumn("is_weekend",
    when(dayofweek(col("date")).isin([1, 7]), True).otherwise(False)
)

# Date truncation for grouping
df = df.withColumn("month_start", trunc(col("date"), "month"))
df = df.withColumn("year_start", trunc(col("date"), "year"))

# Create date ranges
date_range = spark.range(0, 365).select(
    date_add(lit("2024-01-01"), col("id").cast("int")).alias("date")
)

# Time-based windows for sessionization
df = df.withColumn("session_gap_minutes",
    (unix_timestamp(col("timestamp")) -
     unix_timestamp(lag("timestamp", 1).over(
         Window.partitionBy("user_id").orderBy("timestamp")
     ))) / 60
)
df = df.withColumn("new_session",
    when(col("session_gap_minutes") > 30, 1).otherwise(0)
)
```

## 💾 Advanced Read/Write Patterns

```python
# Incremental data loading
latest_date = spark.sql("""
    SELECT MAX(process_date) as max_date
    FROM target_table
""").collect()[0]["max_date"]

df_incremental = spark.read.parquet("source/") \
    .filter(col("date") > latest_date)

# Read with partition pruning
df = spark.read.parquet("partitioned_data/") \
    .filter((col("year") == 2024) & (col("month") == 12))

# Write with dynamic partitioning
df.write \
    .mode("append") \
    .partitionBy("year", "month", "day") \
    .format("parquet") \
    .option("compression", "snappy") \
    .save("output/partitioned/")

# Optimize small files with coalesce
df.coalesce(1).write \
    .mode("overwrite") \
    .parquet("output/single_file/")

# Delta Lake operations
df.write \
    .format("delta") \
    .mode("overwrite") \
    .option("mergeSchema", "true") \
    .save("/path/to/delta-table")

# Upsert (merge) operation with Delta
from delta.tables import DeltaTable

deltaTable = DeltaTable.forPath(spark, "/path/to/delta-table")

deltaTable.alias("target").merge(
    df_updates.alias("source"),
    "target.id = source.id"
).whenMatchedUpdateAll() \
 .whenNotMatchedInsertAll() \
 .execute()

# Time travel with Delta
df_historical = spark.read \
    .format("delta") \
    .option("versionAsOf", 5) \
    .load("/path/to/delta-table")

df_timestamp = spark.read \
    .format("delta") \
    .option("timestampAsOf", "2024-01-01") \
    .load("/path/to/delta-table")

# Optimize and vacuum Delta tables
deltaTable.optimize().executeCompaction()
deltaTable.vacuum(168)  # 7 days retention
```

## 🏗️ ETL Pipeline Patterns

```python
# Slowly Changing Dimension (SCD) Type 2
def scd_type2_upsert(source_df, target_table, key_cols, track_cols):
    """Implement SCD Type 2 logic"""

    # Load existing data
    target_df = spark.table(target_table)

    # Find changed records
    changed = source_df.alias("s").join(
        target_df.filter(col("is_current") == True).alias("t"),
        key_cols,
        "inner"
    ).filter(
        # Compare tracking columns for changes
        reduce(lambda x, y: x | y,
               [col(f"s.{c}") != col(f"t.{c}") for c in track_cols])
    )

    # Expire old records
    expired = changed.select(
        *[col(f"t.{c}") for c in target_df.columns if c not in ["is_current", "end_date"]]
    ).withColumn("is_current", lit(False)) \
     .withColumn("end_date", current_date())

    # Insert new records
    new_records = source_df.withColumn("is_current", lit(True)) \
        .withColumn("start_date", current_date()) \
        .withColumn("end_date", lit(None).cast("date"))

    # Combine and write
    final_df = target_df.union(expired).union(new_records)
    return final_df

# Data quality validation pipeline
def validate_data_quality(df, rules):
    """Apply data quality rules and generate report"""
    results = []

    for rule_name, condition in rules.items():
        failed_count = df.filter(~expr(condition)).count()
        total_count = df.count()
        pass_rate = (total_count - failed_count) / total_count * 100

        results.append({
            "rule": rule_name,
            "failed_records": failed_count,
            "pass_rate": pass_rate
        })

    return spark.createDataFrame(results)

# Example usage
rules = {
    "not_null_id": "id IS NOT NULL",
    "positive_amount": "amount > 0",
    "valid_email": "email RLIKE '^[^@]+@[^@]+\\.[^@]+$'",
    "future_date": "event_date <= current_date()"
}
quality_report = validate_data_quality(df, rules)
```

## 🔍 Debugging & Optimization

```python
# Analyze query execution plan
df.explain(mode="extended")  # Show physical plan
df.explain(mode="cost")      # Show cost-based optimization
df.explain(mode="formatted") # Pretty print

# Check partition distribution
df.rdd.glom().map(len).collect()

# Monitor stage execution
spark.sparkContext.statusTracker().getActiveStageIds()

# Cache management
spark.catalog.clearCache()
spark.catalog.cacheTable("table_name")
spark.catalog.uncacheTable("table_name")

# Skew handling
df_skewed = df.withColumn("salted_key",
    concat(col("key"), lit("_"), (rand() * 10).cast("int"))
)

# Adaptive query execution monitoring
spark.sql("SET spark.sql.adaptive.enabled=true")
spark.sql("SET spark.sql.adaptive.skewJoin.enabled=true")

# Broadcasting hint
df_result = df_large.join(
    broadcast(df_small),
    "key"
)

# Check DataFrame lineage
print(df._jdf.toDebugString())

# Memory usage estimation
df.cache()
print(f"Cached memory: {spark.sparkContext._jvm.org.apache.spark.storage.StorageUtils.memoryBytesToString(df.storageLevel)}")
```

## 📊 Analytics Patterns

```python
# Cohort analysis
cohort_analysis = df.withColumn("cohort_month",
    trunc(col("first_purchase_date"), "month")
).groupBy("cohort_month") \
 .pivot("months_since_first_purchase") \
 .agg(countDistinct("user_id"))

# Retention analysis
retention = df.groupBy("signup_month") \
    .agg(
        countDistinct("user_id").alias("cohort_size"),
        countDistinct(when(col("months_active") >= 1, col("user_id"))).alias("month_1"),
        countDistinct(when(col("months_active") >= 3, col("user_id"))).alias("month_3"),
        countDistinct(when(col("months_active") >= 6, col("user_id"))).alias("month_6")
    )

# RFM Analysis (Recency, Frequency, Monetary)
rfm = df.groupBy("customer_id").agg(
    datediff(current_date(), max("order_date")).alias("recency"),
    count("order_id").alias("frequency"),
    sum("order_value").alias("monetary")
)

# Calculate percentile ranks for RFM scoring
window_spec = Window.orderBy(col("recency"))
rfm = rfm.withColumn("r_score",
    ntile(5).over(window_spec.orderBy(col("recency").asc()))
).withColumn("f_score",
    ntile(5).over(Window.orderBy(col("frequency").desc()))
).withColumn("m_score",
    ntile(5).over(Window.orderBy(col("monetary").desc()))
)

# Funnel analysis
funnel = df.groupBy("user_id").agg(
    max(when(col("event") == "page_view", 1).otherwise(0)).alias("step_1_view"),
    max(when(col("event") == "add_to_cart", 1).otherwise(0)).alias("step_2_cart"),
    max(when(col("event") == "checkout", 1).otherwise(0)).alias("step_3_checkout"),
    max(when(col("event") == "purchase", 1).otherwise(0)).alias("step_4_purchase")
)

funnel_summary = funnel.agg(
    sum("step_1_view").alias("views"),
    sum("step_2_cart").alias("carts"),
    sum("step_3_checkout").alias("checkouts"),
    sum("step_4_purchase").alias("purchases")
)
```

## 🔐 Security & Governance

```python
# Column-level encryption (pseudo-pattern)
from pyspark.sql.functions import sha2

df = df.withColumn("email_hash", sha2(col("email"), 256))

# Data masking
df = df.withColumn("masked_ssn",
    concat(lit("XXX-XX-"), substring(col("ssn"), -4, 4))
)

# Row-level security (filter based on user access)
def apply_row_level_security(df, user_role, user_id):
    if user_role == "admin":
        return df
    elif user_role == "manager":
        return df.filter(col("department") == user_id)
    else:
        return df.filter(col("created_by") == user_id)

# Audit logging
df_with_audit = df.withColumn("processed_by", lit("etl_job")) \
    .withColumn("processed_at", current_timestamp())
```

## ⚠️ Common Gotchas

- **`.collect()` / `.toPandas()` pull everything to the driver** — fine on an aggregated summary, dangerous on a raw fact table. Filter/aggregate down first.
- **Default shuffle partitions (200) rarely match your data size** — too many partitions on a small dataset wastes time on scheduling overhead; too few on a big one causes skew and spill. Tune `spark.sql.shuffle.partitions` deliberately.
- **Lazy evaluation delays errors** — a bad column reference or type mismatch may not surface until an action runs, far from the line that actually caused it.
- **`==` on DataFrame columns needs `col('a') == col('b')`**, not Python's `is`/`==` on the columns directly — and comparisons involving `null` follow SQL three-valued logic (`null == null` is `null`, not `True`).
- **Skewed joins silently slow everything down** — one huge key value can make a single task (and the whole stage) take far longer than the rest; consider salting or an explicit broadcast join for the small side.
- **Repeated use of the same DataFrame re-computes it** unless you `.cache()`/`.persist()` it — but caching everything "just in case" wastes executor memory. Cache deliberately, and `.unpersist()` when done.
- **Schema inference on read (`inferSchema=True`) is slow and can guess wrong** — pass an explicit `StructType` schema for production pipelines.

## 🎯 Performance Tuning Tips

```python
# Repartition before expensive operations
df_optimized = df.repartition(200, "key_column") \
    .groupBy("key_column") \
    .agg(sum("value"))

# Use broadcast joins for small tables (< 10MB)
df_result = large_df.join(broadcast(small_df), "id")

# Avoid UDFs - use built-in functions
# BAD: udf(lambda x: x.upper())
# GOOD: upper(col("column"))

# Cache strategically
df.cache()
df.count()  # Trigger caching
# ... use df multiple times ...
df.unpersist()

# Write to optimized formats
df.write.mode("overwrite") \
    .format("parquet") \
    .option("compression", "snappy") \
    .partitionBy("year", "month") \
    .save("optimized_output/")

# Use columnar formats for analytical queries
# Parquet > ORC > JSON > CSV

# Avoid shuffles when possible
df.repartition("column").write.partitionBy("column")  # No shuffle!

# Use salting for skewed joins
df1_salted = df1.withColumn("salt", (rand() * 10).cast("int"))
df2_salted = df2.withColumn("salt", explode(array([lit(i) for i in range(10)])))
result = df1_salted.join(df2_salted, ["key", "salt"])
```

## 🧰 Handy One-Liners

```python
# Convert PySpark to Pandas (use with caution)
pandas_df = df.limit(10000).toPandas()

# SQL queries
spark.sql("""
    SELECT department, AVG(salary) as avg_salary
    FROM employees
    GROUP BY department
    HAVING AVG(salary) > 50000
""")

# Register DataFrame as temp view
df.createOrReplaceTempView("temp_table")

# Show execution plan
df.explain()

# Count operations
df.count()                    # Total rows
df.select("column").distinct().count()  # Distinct values

# Sample data for testing
df_sample = df.sample(fraction=0.01, seed=42)

# Checkpoint for long lineages
df.checkpoint()

# Persist with different storage levels
from pyspark import StorageLevel
df.persist(StorageLevel.MEMORY_AND_DISK)
```

## 📚 Best Practices for Data Engineers

1. **Always define schemas explicitly** for production pipelines
2. **Partition data wisely** - aim for 128MB-1GB per partition
3. **Use Delta Lake** for ACID transactions and time travel
4. **Implement data quality checks** at every stage
5. **Cache strategically** - only cache reused DataFrames
6. **Avoid collect()** on large datasets - use `show()` or `take()`
7. **Use broadcast joins** for small dimension tables
8. **Monitor skewness** - use salting for skewed joins
9. **Write idempotent pipelines** - handle reruns gracefully
10. **Document transformation logic** - future you will thank you
11. **Use configuration management** - externalize configs
12. **Implement proper logging** and monitoring
13. **Test with sample data** before running on full datasets
14. **Use appropriate file formats** - Parquet for analytics
15. **Implement incremental processing** to reduce compute costs
