# Pandas Cheatsheet for Data & Analytics Engineers

> A structured pandas reference for data & analytics engineering — DataFrame creation and I/O through cleaning, aggregation, reshaping, joins, dates, ETL patterns, and performance. Fixed two broken regex strings (PII-masking and email validation), replaced the deprecated/removed `date_parser` argument with `date_format`, and added the reshaping and gotchas sections that were missing from the original.

## 📑 Table of Contents

1. [🚀 Import and Setup](#import-and-setup)
2. [📊 Creating DataFrames and Series](#creating-dataframes-and-series)
3. [🔍 Data Profiling & Quality Assessment](#data-profiling-quality-assessment)
4. [🎯 Advanced Indexing & Selection](#advanced-indexing-selection)
5. [🔧 Advanced Data Types & Conversions](#advanced-data-types-conversions)
6. [🧹 Advanced Data Cleaning](#advanced-data-cleaning)
7. [📈 Advanced Aggregations](#advanced-aggregations)
8. [🔄 Reshaping Data](#reshaping-data)
9. [🪟 Advanced Window Functions](#advanced-window-functions)
10. [🔗 Advanced Joins & Merges](#advanced-joins-merges)
11. [📅 Advanced Date & Time Operations](#advanced-date-time-operations)
12. [💾 Advanced I/O Operations](#advanced-io-operations)
13. [🏗️ ETL Pipeline Patterns](#etl-pipeline-patterns)
14. [📊 Analytics Patterns](#analytics-patterns)
15. [⚡ Performance Optimization](#performance-optimization)
16. [🔐 Security & Data Governance](#security-data-governance)
17. [⚠️ Common Gotchas](#common-gotchas)
18. [🎯 Best Practices](#best-practices)
19. [📚 Idioms, Performance & Memory Tips](#idioms-performance-memory-tips)
20. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**Syntax cheatsheet**

| Task              | Syntax                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Read / write      | `pd.read_csv(f)` / `df.to_csv(f, index=False)` (also `read_parquet`, `read_sql`, `read_excel`) |
| Inspect           | `df.head()`, `df.info()`, `df.describe()`, `df.shape`, `df.dtypes`                             |
| Select rows/cols  | `df.loc[rows, cols]`, `df.iloc[rows, cols]`, `df.query('expr')`                                |
| Filter            | `df[df['col'] > x]`, `df[df['col'].isin([...])]`                                               |
| New column        | `df['new'] = df['a'] * df['b']` or `df.assign(new=lambda d: d.a * d.b)`                        |
| Group & aggregate | `df.groupby('col').agg(total=('x','sum'), n=('x','count'))`                                    |
| Sort              | `df.sort_values(['a','b'], ascending=[True, False])`                                           |
| Join              | `pd.merge(df1, df2, on='key', how='left')`                                                     |
| Reshape           | `df.pivot_table(...)`, `df.melt(...)`, `df.explode(...)`                                       |
| Missing data      | `df.isnull().sum()`, `df.fillna(x)`, `df.dropna()`                                             |
| Window/rolling    | `df.groupby('g')['x'].rolling(7).mean()`, `.shift()`, `.rank()`                                |
| Apply a function  | `df['x'].apply(fn)` (avoid `axis=1` on large data — prefer vectorized ops)                     |

**dtype cheat sheet**

| Use case                                 | dtype                            |
| ---------------------------------------- | -------------------------------- |
| Small integers, may have nulls           | `'Int32'` / `'Int64'` (nullable) |
| Repeated string values (low cardinality) | `'category'`                     |
| Text with nulls                          | `'string'`                       |
| Timestamps                               | `'datetime64[ns]'`               |
| Memory-tight floats                      | `'float32'`                      |

## 🚀 Import and Setup

```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Optimized display options for analysis
pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', 100)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', 50)
pd.set_option('display.precision', 2)
pd.set_option('display.float_format', '{:.2f}'.format)

# Performance options
pd.set_option('mode.chained_assignment', None)
pd.set_option('compute.use_bottleneck', True)
pd.set_option('compute.use_numexpr', True)
```

## 📊 Creating DataFrames and Series

### From Various Sources

```python
# DataFrame from dictionary with explicit dtypes
df = pd.DataFrame({
    'user_id': pd.array([1, 2, 3], dtype='uint32'),
    'email': pd.array(['a@test.com', 'b@test.com', 'c@test.com'], dtype='string'),
    'revenue': pd.array([100.5, 200.3, 150.7], dtype='float64'),
    'category': pd.Categorical(['A', 'B', 'A'])
})

# From records (list of dicts)
records = [
    {'name': 'Alice', 'age': 25, 'city': 'NYC'},
    {'name': 'Bob', 'age': 30, 'city': 'LA'}
]
df = pd.DataFrame.from_records(records)

# From numpy arrays
data = np.array([[1, 2], [3, 4], [5, 6]])
df = pd.DataFrame(data, columns=['A', 'B'])

# Series with custom index
s = pd.Series(
    data=[100, 200, 300],
    index=['user_1', 'user_2', 'user_3'],
    name='revenue'
)

# Empty DataFrame with schema
df = pd.DataFrame(
    columns=['id', 'timestamp', 'value', 'category'],
    dtype=object
).astype({
    'id': 'uint64',
    'timestamp': 'datetime64[ns]',
    'value': 'float64',
    'category': 'category'
})

# From dict of Series
df = pd.DataFrame({
    'col1': pd.Series([1, 2, 3]),
    'col2': pd.Series(['a', 'b', 'c'])
})
```

### Reading Data with Advanced Options

```python
# CSV with optimization
df = pd.read_csv(
    'file.csv',
    sep=',',
    encoding='utf-8',
    dtype={'user_id': 'uint32', 'amount': 'float32'},
    parse_dates=['date_column'],
    date_format='%Y-%m-%d',  # date_parser was deprecated in 2.0 and removed in 2.2+
    usecols=['col1', 'col2', 'col3'],  # Read only specific columns
    na_values=['NA', 'null', ''],
    thousands=',',
    decimal='.',
    nrows=100000,  # Read first 100k rows
    low_memory=False,  # Better type inference
    memory_map=True  # Memory-mapped file
)

# Read in chunks for large files
chunk_size = 100000
chunks = []
for chunk in pd.read_csv('large_file.csv', chunksize=chunk_size):
    # Process each chunk
    processed = process_chunk(chunk)
    chunks.append(processed)
df = pd.concat(chunks, ignore_index=True)

# Excel with multiple sheets
with pd.ExcelFile('file.xlsx') as xls:
    df1 = pd.read_excel(xls, 'Sheet1')
    df2 = pd.read_excel(xls, 'Sheet2')

# JSON with normalization
df = pd.read_json('file.json', orient='records')
df = pd.json_normalize(data, max_level=2)  # Flatten nested JSON

# SQL with parameters
from sqlalchemy import create_engine
engine = create_engine('postgresql://user:pass@localhost/db')

df = pd.read_sql(
    sql="SELECT * FROM table WHERE date >= %(start_date)s",
    con=engine,
    params={'start_date': '2024-01-01'},
    parse_dates=['date_column']
)

# Parquet (fast and efficient)
df = pd.read_parquet('file.parquet', engine='pyarrow')
df = pd.read_parquet('file.parquet', columns=['col1', 'col2'])

# Read from URL
df = pd.read_csv('https://example.com/data.csv')

# Read from S3 (with boto3/s3fs)
df = pd.read_csv('s3://bucket/path/file.csv')
df = pd.read_parquet('s3://bucket/path/file.parquet')

# Read compressed files
df = pd.read_csv('file.csv.gz', compression='gzip')
df = pd.read_csv('file.csv.zip', compression='zip')
```

## 🔍 Data Profiling & Quality Assessment

```python
# Comprehensive data profile
def profile_dataframe(df):
    """Generate comprehensive data profile"""

    print("=" * 80)
    print("DataFrame Profile")
    print("=" * 80)
    print(f"Shape: {df.shape} (rows × columns)")
    print(f"Memory Usage: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    print(f"Duplicate Rows: {df.duplicated().sum():,}")

    print("\n" + "=" * 80)
    print("Column Information:")
    print("=" * 80)

    profile = pd.DataFrame({
        'dtype': df.dtypes,
        'null_count': df.isnull().sum(),
        'null_pct': (df.isnull().sum() / len(df) * 100).round(2),
        'unique': df.nunique(),
        'unique_pct': (df.nunique() / len(df) * 100).round(2),
        'memory_mb': df.memory_usage(deep=True) / 1024**2
    })

    print(profile)

    # Numeric statistics
    print("\n" + "=" * 80)
    print("Numeric Statistics:")
    print("=" * 80)
    print(df.describe(include=[np.number]).T)

    # Categorical statistics
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    if len(cat_cols) > 0:
        print("\n" + "=" * 80)
        print("Categorical Statistics:")
        print("=" * 80)
        for col in cat_cols:
            print(f"\n{col}:")
            print(df[col].value_counts().head())

# Quick quality checks
quality_report = pd.DataFrame({
    'total_rows': [len(df)],
    'null_count': [df.isnull().sum().sum()],
    'duplicate_rows': [df.duplicated().sum()],
    'columns': [len(df.columns)],
    'memory_mb': [df.memory_usage(deep=True).sum() / 1024**2]
})

# Check for duplicates by key
duplicate_keys = df[df.duplicated(subset=['id', 'date'], keep=False)]

# Identify data quality issues
quality_checks = pd.DataFrame({
    'check': [
        'null_emails',
        'valid_emails',
        'negative_amounts',
        'future_dates',
        'outliers_amount'
    ],
    'failed_count': [
        df['email'].isnull().sum(),
        (~df['email'].str.contains(r'^[^@]+@[^@]+\.[^@]+$', na=False)).sum(),
        (df['amount'] < 0).sum(),
        (df['date'] > pd.Timestamp.now()).sum(),
        ((df['amount'] < df['amount'].quantile(0.25) - 1.5 * df['amount'].quantile(0.75)) |
         (df['amount'] > df['amount'].quantile(0.75) + 1.5 * df['amount'].quantile(0.75))).sum()
    ]
})

# Statistical outlier detection (IQR method)
def detect_outliers_iqr(df, column):
    """Detect outliers using IQR method"""
    Q1 = df[column].quantile(0.25)
    Q3 = df[column].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR

    outliers = df[(df[column] < lower_bound) | (df[column] > upper_bound)]
    return outliers, lower_bound, upper_bound

# Z-score outliers
def detect_outliers_zscore(df, column, threshold=3):
    """Detect outliers using z-score"""
    z_scores = np.abs((df[column] - df[column].mean()) / df[column].std())
    return df[z_scores > threshold]

# Correlation analysis
correlation_matrix = df.select_dtypes(include=[np.number]).corr()
high_corr = correlation_matrix[abs(correlation_matrix) > 0.7].stack().reset_index()
high_corr = high_corr[high_corr['level_0'] != high_corr['level_1']]
```

## 🎯 Advanced Indexing & Selection

```python
# MultiIndex operations
df_multi = df.set_index(['category', 'subcategory', 'date'])

# Select from MultiIndex
df_multi.loc[('A', 'A1'), :]
df_multi.loc[('A', 'A1', '2024-01-01'), :]
df_multi.xs('A', level='category')
df_multi.xs(('A', 'A1'), level=['category', 'subcategory'])

# Cross-section
df_multi.xs('2024-01-01', level='date')

# Index slicing
df_multi.loc[('A',):('B',), :]

# Boolean indexing with query
df.query('age > 25 and city == "NYC"')
df.query('amount > @threshold', local_dict={'threshold': 100})
df.query('category in ["A", "B"]')

# Advanced filtering
df[df['email'].str.contains(r'^[a-z]+@gmail\.com$', regex=True)]
df[df['date'].between('2024-01-01', '2024-12-31')]
df[df['amount'].isin([100, 200, 300])]
df[~df['status'].isin(['cancelled', 'refunded'])]

# Filter with multiple conditions
mask = (
    (df['amount'] > 100) &
    (df['status'] == 'active') &
    (df['date'] >= '2024-01-01')
)
df_filtered = df[mask]

# Using isin with DataFrame
valid_combinations = pd.DataFrame({
    'category': ['A', 'B'],
    'status': ['active', 'pending']
})
df_filtered = df[df[['category', 'status']].apply(tuple, axis=1).isin(
    valid_combinations.apply(tuple, axis=1)
)]

# Select by dtype
df.select_dtypes(include=[np.number])
df.select_dtypes(include=['object', 'category'])
df.select_dtypes(exclude=[np.number])

# Select columns by pattern
df.filter(regex='^user_')  # Starts with 'user_'
df.filter(like='_id')      # Contains '_id'
df.filter(items=['col1', 'col2'])
```

## 🔧 Advanced Data Types & Conversions

```python
# Optimized dtypes for memory efficiency
df = df.astype({
    'user_id': 'uint32',      # 0 to 4,294,967,295
    'age': 'uint8',           # 0 to 255
    'amount': 'float32',      # 32-bit float
    'category': 'category',   # Categorical
    'status': 'string',       # String dtype (pandas 1.0+)
    'is_active': 'bool'       # Boolean
})

# Nullable integer types (pandas 1.0+)
df['nullable_int'] = pd.array([1, 2, None], dtype='Int64')
df['nullable_bool'] = pd.array([True, False, None], dtype='boolean')

# DateTime with timezone
df['timestamp'] = pd.to_datetime(df['timestamp']).dt.tz_localize('UTC')
df['timestamp_ny'] = df['timestamp'].dt.tz_convert('America/New_York')

# Parse dates with multiple formats
def parse_multiple_formats(date_str):
    formats = ['%Y-%m-%d', '%m/%d/%Y', '%d-%b-%Y', '%Y%m%d']
    for fmt in formats:
        try:
            return pd.to_datetime(date_str, format=fmt)
        except:
            continue
    return pd.NaT

df['parsed_date'] = df['date_string'].apply(parse_multiple_formats)

# Categorical with ordered categories
df['size'] = pd.Categorical(
    df['size'],
    categories=['small', 'medium', 'large'],
    ordered=True
)

# Convert to most efficient dtypes
df_optimized = df.copy()
for col in df_optimized.select_dtypes(include=['int']).columns:
    df_optimized[col] = pd.to_numeric(df_optimized[col], downcast='integer')
for col in df_optimized.select_dtypes(include=['float']).columns:
    df_optimized[col] = pd.to_numeric(df_optimized[col], downcast='float')

# Interval dtype
df['age_range'] = pd.cut(
    df['age'],
    bins=[0, 18, 35, 50, 100],
    labels=['0-18', '19-35', '36-50', '50+']
)

# Period dtype for time series
df['month'] = pd.to_datetime(df['date']).dt.to_period('M')
df['quarter'] = pd.to_datetime(df['date']).dt.to_period('Q')
```

## 🧹 Advanced Data Cleaning

```python
# Comprehensive text cleaning
df['email_clean'] = (
    df['email']
    .str.lower()
    .str.strip()
    .str.replace(r'\s+', '', regex=True)
)

df['phone_clean'] = (
    df['phone']
    .str.replace(r'[^\d]', '', regex=True)
)

# Extract domain from email
df['email_domain'] = df['email'].str.extract(r'@(.+)$')

# Clean currency values
df['amount_clean'] = (
    df['amount_str']
    .str.replace('$', '', regex=False)
    .str.replace(',', '', regex=False)
    .str.strip()
    .astype(float)
)

# Handle parentheses as negative
df['amount'] = df['amount_str'].apply(
    lambda x: -float(x.strip('()').replace(',', ''))
    if '(' in str(x) else float(str(x).replace(',', ''))
)

# Advanced missing value imputation
# Forward fill by group
df['value_filled'] = df.groupby('category')['value'].fillna(method='ffill')

# Mean imputation by group
df['value_imputed'] = df.groupby('category')['value'].transform(
    lambda x: x.fillna(x.mean())
)

# Interpolation
df['value_interpolated'] = df.sort_values('date')['value'].interpolate(
    method='time',
    limit_direction='both'
)

# Custom imputation logic
def smart_imputation(group):
    if group['value'].isnull().sum() / len(group) > 0.5:
        return group['value'].fillna(0)  # Too many nulls, use 0
    else:
        return group['value'].fillna(group['value'].median())

df['value_smart'] = df.groupby('category')['value'].transform(smart_imputation)

# Outlier handling - cap at percentiles
lower = df['amount'].quantile(0.01)
upper = df['amount'].quantile(0.99)
df['amount_capped'] = df['amount'].clip(lower=lower, upper=upper)

# Winsorization
from scipy.stats.mstats import winsorize
df['amount_winsorized'] = winsorize(df['amount'], limits=[0.05, 0.05])

# Deduplication with priority
df_dedup = (
    df.sort_values('updated_at', ascending=False)
    .drop_duplicates(subset=['id'], keep='first')
)

# Remove whitespace from all string columns
string_cols = df.select_dtypes(include=['object']).columns
df[string_cols] = df[string_cols].apply(lambda x: x.str.strip())

# Standardize text values
df['category_clean'] = (
    df['category']
    .str.lower()
    .str.strip()
    .replace({
        'cat a': 'category_a',
        'cat-a': 'category_a',
        'category a': 'category_a'
    })
)
```

## 📈 Advanced Aggregations

```python
# Multiple aggregations per column
agg_result = df.groupby('category').agg({
    'amount': ['sum', 'mean', 'std', 'min', 'max', 'count'],
    'user_id': ['nunique', 'count'],
    'date': ['min', 'max']
})

# Flatten MultiIndex columns
agg_result.columns = ['_'.join(col).strip() for col in agg_result.columns.values]

# Named aggregations (pandas 0.25+)
agg_result = df.groupby('category').agg(
    total_amount=('amount', 'sum'),
    avg_amount=('amount', 'mean'),
    unique_users=('user_id', 'nunique'),
    transaction_count=('id', 'count'),
    median_amount=('amount', 'median'),
    amount_std=('amount', 'std'),
    first_date=('date', 'min'),
    last_date=('date', 'max')
)

# Custom aggregation functions
def percentile_75(x):
    return x.quantile(0.75)

def coefficient_of_variation(x):
    return x.std() / x.mean() * 100

agg_result = df.groupby('category').agg({
    'amount': [
        'sum',
        'mean',
        percentile_75,
        coefficient_of_variation
    ]
})

# Conditional aggregations
agg_result = df.groupby('category').agg(
    total_amount=('amount', 'sum'),
    active_amount=('amount', lambda x: x[df.loc[x.index, 'status'] == 'active'].sum()),
    completed_count=('status', lambda x: (x == 'completed').sum()),
    avg_positive=('amount', lambda x: x[x > 0].mean())
)

# Multiple groupby levels
multi_agg = df.groupby(['year', 'quarter', 'category']).agg({
    'amount': 'sum',
    'user_id': 'nunique'
}).reset_index()

# Pivot with multiple aggregations
pivot = df.pivot_table(
    values=['amount', 'quantity'],
    index='date',
    columns='category',
    aggfunc={
        'amount': 'sum',
        'quantity': 'mean'
    },
    fill_value=0,
    margins=True,
    margins_name='Total'
)

# Cross-tabulation
crosstab = pd.crosstab(
    df['category'],
    df['status'],
    values=df['amount'],
    aggfunc='sum',
    normalize='index',  # or 'columns', 'all'
    margins=True
)

# Rolling aggregations by group
df_sorted = df.sort_values(['user_id', 'date'])
df_sorted['rolling_avg'] = (
    df_sorted.groupby('user_id')['amount']
    .rolling(window=7, min_periods=1)
    .mean()
    .reset_index(level=0, drop=True)
)

# Expanding aggregations
df_sorted['expanding_sum'] = (
    df_sorted.groupby('user_id')['amount']
    .expanding()
    .sum()
    .reset_index(level=0, drop=True)
)

# Transform for broadcasting
df['group_mean'] = df.groupby('category')['amount'].transform('mean')
df['zscore'] = (df['amount'] - df['group_mean']) / df.groupby('category')['amount'].transform('std')
df['pct_of_group_total'] = df['amount'] / df.groupby('category')['amount'].transform('sum') * 100
```

## 🔄 Reshaping Data

```python
# Wide -> long with melt
long_df = df.melt(
    id_vars=['id', 'date'],
    value_vars=['product_a', 'product_b', 'product_c'],
    var_name='product',
    value_name='sales'
)

# Long -> wide with pivot (requires unique index/column combos)
wide_df = long_df.pivot(index=['id', 'date'], columns='product', values='sales')

# Long -> wide with aggregation (duplicates allowed)
wide_df = long_df.pivot_table(
    index='date', columns='product', values='sales', aggfunc='sum', fill_value=0
)

# stack / unstack (move between column levels and row index levels)
stacked = df.set_index(['date', 'category']).stack()      # columns -> innermost row index
unstacked = stacked.unstack(level=-1)                       # innermost row index -> columns

# Explode a list-like column into multiple rows
df_exploded = df.explode('tags').reset_index(drop=True)

# Split one column into several
df[['first_name', 'last_name']] = df['full_name'].str.split(' ', n=1, expand=True)

# Combine several columns into one
df['full_name'] = df['first_name'].str.cat(df['last_name'], sep=' ')

# wide_to_long for suffix-based reshaping (e.g. sales_2022, sales_2023 -> year column)
long_df = pd.wide_to_long(
    df, stubnames='sales', i='id', j='year', sep='_'
).reset_index()

# Transpose (swap rows and columns)
df_t = df.set_index('id').T
```

## 🪟 Advanced Window Functions

```python
# Ranking within groups
df['rank'] = df.groupby('category')['amount'].rank(method='min', ascending=False)
df['dense_rank'] = df.groupby('category')['amount'].rank(method='dense', ascending=False)
df['percent_rank'] = df.groupby('category')['amount'].rank(pct=True)

# Row number
df = df.sort_values(['category', 'date'])
df['row_num'] = df.groupby('category').cumcount() + 1

# Lag and lead
df['prev_amount'] = df.groupby('user_id')['amount'].shift(1)
df['next_amount'] = df.groupby('user_id')['amount'].shift(-1)
df['prev_2_amount'] = df.groupby('user_id')['amount'].shift(2)

# Difference from previous
df['amount_diff'] = df.groupby('user_id')['amount'].diff()
df['amount_pct_change'] = df.groupby('user_id')['amount'].pct_change() * 100

# First and last in group
df['first_in_group'] = df.groupby('category')['amount'].transform('first')
df['last_in_group'] = df.groupby('category')['amount'].transform('last')

# Cumulative operations by group
df['cumsum'] = df.groupby('category')['amount'].cumsum()
df['cummax'] = df.groupby('category')['amount'].cummax()
df['cummin'] = df.groupby('category')['amount'].cummin()
df['cumcount'] = df.groupby('category').cumcount()

# Rolling window by group
df = df.sort_values(['user_id', 'date'])
df['7day_avg'] = (
    df.groupby('user_id')['amount']
    .rolling(window=7, min_periods=1)
    .mean()
    .reset_index(level=0, drop=True)
)

df['30day_sum'] = (
    df.groupby('user_id')['amount']
    .rolling(window=30, min_periods=1)
    .sum()
    .reset_index(level=0, drop=True)
)

# Time-based rolling windows
df = df.set_index('date').sort_index()
df['30day_rolling'] = (
    df.groupby('user_id')['amount']
    .rolling('30D', min_periods=1)
    .mean()
)
df = df.reset_index()

# Exponentially weighted moving average
df['ewma'] = (
    df.groupby('user_id')['amount']
    .ewm(span=7, adjust=False)
    .mean()
    .reset_index(level=0, drop=True)
)

# Nth value in group
df['second_value'] = df.groupby('category')['amount'].nth(1)
```

## 🔗 Advanced Joins & Merges

```python
# All join types
df_joined = pd.merge(
    df1, df2,
    on='key',
    how='inner'  # inner, left, right, outer
)

# Multiple key joins
df_joined = pd.merge(
    df1, df2,
    on=['key1', 'key2', 'key3'],
    how='left'
)

# Join with different column names
df_joined = pd.merge(
    df1, df2,
    left_on='user_id',
    right_on='id',
    how='left',
    suffixes=('', '_right')
)

# Indicator column to track merge results
df_joined = pd.merge(
    df1, df2,
    on='key',
    how='outer',
    indicator=True
)
# Results in: 'left_only', 'right_only', 'both'

# Merge with validation
df_joined = pd.merge(
    df1, df2,
    on='key',
    validate='one_to_one'  # or 'one_to_many', 'many_to_one', 'many_to_many'
)

# Asof merge (ordered merge for time series)
df_asof = pd.merge_asof(
    df1.sort_values('timestamp'),
    df2.sort_values('timestamp'),
    on='timestamp',
    by='symbol',
    direction='backward'  # or 'forward', 'nearest'
)

# Cross join (Cartesian product)
df_cross = df1.merge(df2, how='cross')

# Join on index
df_joined = df1.join(df2, how='left', lsuffix='_left', rsuffix='_right')

# Multiple merges in sequence
result = (
    df1
    .merge(df2, on='user_id', how='left')
    .merge(df3, on='product_id', how='left')
    .merge(df4, left_on='category_id', right_on='id', how='left')
)

# Conditional joins using cross join + filter
df_conditional = (
    df1.merge(df2, how='cross')
    .query('start_date <= event_date <= end_date')
)

# Fuzzy matching joins (requires fuzzywuzzy)
from fuzzywuzzy import process

def fuzzy_merge(df1, df2, key1, key2, threshold=90):
    """Fuzzy string matching merge"""
    s = df2[key2].tolist()

    m = df1[key1].apply(lambda x: process.extractOne(x, s))
    df1['matches'] = m

    df1['match_string'] = df1['matches'].apply(lambda x: x[0] if x[1] >= threshold else None)
    df1['match_score'] = df1['matches'].apply(lambda x: x[1] if x[1] >= threshold else 0)

    return df1.merge(df2, left_on='match_string', right_on=key2, how='left')

# Anti-join (rows in df1 not in df2)
df_anti = df1[~df1['key'].isin(df2['key'])]

# Or using merge indicator
df_anti = (
    df1.merge(df2, on='key', how='left', indicator=True)
    .query('_merge == "left_only"')
    .drop('_merge', axis=1)
)

# Semi-join (rows in df1 that exist in df2)
df_semi = df1[df1['key'].isin(df2['key'])]

# Update values from another DataFrame
df1.update(df2)  # Updates df1 with non-NA values from df2

# Combine_first (fill nulls with values from another df)
df_combined = df1.combine_first(df2)
```

## 📅 Advanced Date & Time Operations

```python
# Comprehensive date parsing
df['date'] = pd.to_datetime(
    df['date_string'],
    format='%Y-%m-%d',
    errors='coerce'  # Convert errors to NaT
)

# Extract date components
df['year'] = df['date'].dt.year
df['quarter'] = df['date'].dt.quarter
df['month'] = df['date'].dt.month
df['week'] = df['date'].dt.isocalendar().week
df['day'] = df['date'].dt.day
df['dayofweek'] = df['date'].dt.dayofweek  # Monday=0, Sunday=6
df['dayofyear'] = df['date'].dt.dayofyear
df['days_in_month'] = df['date'].dt.days_in_month

# Day name and month name
df['day_name'] = df['date'].dt.day_name()
df['month_name'] = df['date'].dt.month_name()
df['is_month_start'] = df['date'].dt.is_month_start
df['is_month_end'] = df['date'].dt.is_month_end
df['is_quarter_start'] = df['date'].dt.is_quarter_start
df['is_quarter_end'] = df['date'].dt.is_quarter_end

# Time components
df['hour'] = df['timestamp'].dt.hour
df['minute'] = df['timestamp'].dt.minute
df['second'] = df['timestamp'].dt.second

# Date arithmetic
df['next_week'] = df['date'] + pd.Timedelta(days=7)
df['last_month'] = df['date'] - pd.DateOffset(months=1)
df['next_business_day'] = df['date'] + pd.offsets.BusinessDay(1)

# Date differences
df['days_diff'] = (df['end_date'] - df['start_date']).dt.days
df['hours_diff'] = (df['end_time'] - df['start_time']).dt.total_seconds() / 3600

# Floor/ceiling dates
df['month_start'] = df['date'].dt.to_period('M').dt.to_timestamp()
df['month_end'] = df['date'].dt.to_period('M').dt.to_timestamp('M')
df['quarter_start'] = df['date'].dt.to_period('Q').dt.to_timestamp()

# Business day calculations
df['is_business_day'] = df['date'].dt.dayofweek < 5
business_days = pd.bdate_range(start='2024-01-01', end='2024-12-31')

# Custom business calendar
from pandas.tseries.holiday import USFederalHolidayCalendar
cal = USFederalHolidayCalendar()
holidays = cal.holidays(start='2024-01-01', end='2024-12-31')

# Date ranges
date_range = pd.date_range(
    start='2024-01-01',
    end='2024-12-31',
    freq='D'  # D=daily, W=weekly, M=month end, MS=month start, Q=quarter end
)

# Business date range
business_dates = pd.bdate_range(start='2024-01-01', end='2024-12-31')

# Resample time series
df_resampled = df.set_index('date').resample('M').agg({
    'amount': 'sum',
    'user_id': 'nunique',
    'quantity': 'mean'
})

# Forward fill after resampling
df_resampled = df.set_index('date').resample('D').fillna(method='ffill')

# Time zone operations
df['timestamp_utc'] = pd.to_datetime(df['timestamp']).dt.tz_localize('UTC')
df['timestamp_ny'] = df['timestamp_utc'].dt.tz_convert('America/New_York')

# Age calculations
df['age_days'] = (pd.Timestamp.now() - df['birth_date']).dt.days
df['age_years'] = df['age_days'] // 365

# Fiscal year calculations
def get_fiscal_year(date, fiscal_start_month=4):
    """Calculate fiscal year (e.g., April-March)"""
    if date.month >= fiscal_start_month:
        return date.year + 1
    else:
        return date.year

df['fiscal_year'] = df['date'].apply(lambda x: get_fiscal_year(x))

# Week over week, month over month calculations
df = df.sort_values(['product_id', 'date'])
df['prev_week_sales'] = df.groupby('product_id')['sales'].shift(7)
df['wow_growth'] = (df['sales'] - df['prev_week_sales']) / df['prev_week_sales'] * 100

# Cohort age calculation
df['signup_month'] = df['signup_date'].dt.to_period('M')
df['event_month'] = df['event_date'].dt.to_period('M')
df['months_since_signup'] = (df['event_month'] - df['signup_month']).apply(lambda x: x.n)
```

## 💾 Advanced I/O Operations

```python
# Optimized CSV writing
df.to_csv(
    'output.csv',
    index=False,
    encoding='utf-8',
    compression='gzip',
    chunksize=100000
)

# Append to existing CSV
df.to_csv('output.csv', mode='a', header=False, index=False)

# Excel with formatting (requires openpyxl or xlsxwriter)
with pd.ExcelWriter('output.xlsx', engine='xlsxwriter') as writer:
    df.to_excel(writer, sheet_name='Data', index=False)

    # Get workbook and worksheet
    workbook = writer.book
    worksheet = writer.sheets['Data']

    # Add formatting
    header_format = workbook.add_format({'bold': True, 'bg_color': '#D3D3D3'})
    worksheet.set_row(0, None, header_format)

# Parquet with compression
df.to_parquet(
    'output.parquet',
    engine='pyarrow',
    compression='snappy',  # or 'gzip', 'brotli', 'zstd'
    index=False
)

# Partitioned Parquet writes
df.to_parquet(
    'partitioned_output',
    partition_cols=['year', 'month'],
    engine='pyarrow'
)

# SQL database operations
from sqlalchemy import create_engine
engine = create_engine('postgresql://user:pass@localhost/db')

# Write to database
df.to_sql(
    'table_name',
    con=engine,
    if_exists='append',  # or 'replace', 'fail'
    index=False,
    method='multi',  # Faster bulk insert
    chunksize=10000
)

# Read with SQL query
query = """
    SELECT *
    FROM table
    WHERE date >= %(start_date)s
    AND status IN ('active', 'pending')
"""
df = pd.read_sql(query, con=engine, params={'start_date': '2024-01-01'})

# JSON with different orientations
df.to_json('output.json', orient='records', lines=True)  # NDJSON
df.to_json('output.json', orient='records', indent=2)

# Pickle (preserves dtypes perfectly)
df.to_pickle('df.pkl')
df = pd.read_pickle('df.pkl')

# HDF5 for large datasets
df.to_hdf('data.h5', key='df', mode='w', complevel=9)
df = pd.read_hdf('data.h5', key='df')

# Feather format (fast)
df.to_feather('output.feather')
df = pd.read_feather('output.feather')

# Cloud storage (S3)
df.to_csv('s3://bucket/path/file.csv', index=False)
df.to_parquet('s3://bucket/path/file.parquet')
```

## 🏗️ ETL Pipeline Patterns

```python
# Complete ETL pipeline
def etl_pipeline(source_path, target_path):
    """Production-grade ETL pipeline with error handling"""

    try:
        # Extract
        print("Extracting data...")
        df = pd.read_csv(source_path, low_memory=False)
        initial_count = len(df)

        # Data quality checks
        print("Running quality checks...")
        assert df['id'].notnull().all(), "Found null IDs"
        assert df['amount'].min() >= 0, "Found negative amounts"

        # Transform
        print("Transforming data...")

        # 1. Deduplication
        df = df.drop_duplicates(subset=['id', 'date'], keep='last')

        # 2. Type conversions
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
        df['category'] = df['category'].astype('category')

        # 3. Data cleaning
        df = df[df['date'].notnull()]
        df = df[df['amount'].notnull()]

        # 4. Feature engineering
        df['year'] = df['date'].dt.year
        df['month'] = df['date'].dt.month
        df['amount_log'] = np.log1p(df['amount'])

        # 5. Business logic
        df['amount_tier'] = pd.cut(
            df['amount'],
            bins=[0, 100, 1000, float('inf')],
            labels=['low', 'medium', 'high']
        )

        # 6. Add metadata
        df['processed_at'] = pd.Timestamp.now()
        df['pipeline_version'] = '1.0'

        # Load
        print("Loading data...")
        df.to_parquet(target_path, index=False, compression='snappy')

        # Summary
        final_count = len(df)
        print(f"Pipeline completed successfully!")
        print(f"Initial rows: {initial_count:,}")
        print(f"Final rows: {final_count:,}")
        print(f"Rows removed: {initial_count - final_count:,}")

        return df

    except Exception as e:
        print(f"Pipeline failed: {e}")
        raise

# Incremental processing
def incremental_load(source_path, target_path, checkpoint_date):
    """Load only new data since last checkpoint"""

    # Read new data
    df = pd.read_csv(source_path)
    df['created_date'] = pd.to_datetime(df['created_date'])

    # Filter for incremental data
    df_new = df[df['created_date'] > checkpoint_date]

    if len(df_new) > 0:
        # Append to existing data
        if os.path.exists(target_path):
            df_existing = pd.read_parquet(target_path)
            df_combined = pd.concat([df_existing, df_new], ignore_index=True)
        else:
            df_combined = df_new

        # Write
        df_combined.to_parquet(target_path, index=False)

        # Update checkpoint
        new_checkpoint = df_new['created_date'].max()
        return new_checkpoint

    return checkpoint_date

# Slowly Changing Dimension (SCD) Type 2
def scd_type2_merge(source_df, target_df, key_cols, track_cols):
    """Implement SCD Type 2 logic"""

    # Add hash for change detection
    source_df['row_hash'] = pd.util.hash_pandas_object(
        source_df[track_cols],
        index=False
    )

    # Get current records from target
    target_current = target_df[target_df['is_current'] == True].copy()

    # Find changed records
    merged = source_df.merge(
        target_current[key_cols + ['row_hash']],
        on=key_cols,
        how='left',
        suffixes=('', '_old')
    )

    changed = merged[
        (merged['row_hash_old'].notnull()) &
        (merged['row_hash'] != merged['row_hash_old'])
    ]

    # Expire old records
    if len(changed) > 0:
        target_df.loc[
            target_df[key_cols[0]].isin(changed[key_cols[0]]) &
            (target_df['is_current'] == True),
            ['effective_to', 'is_current']
        ] = [pd.Timestamp.now(), False]

    # Add new records
    new_records = source_df.copy()
    new_records['effective_from'] = pd.Timestamp.now()
    new_records['effective_to'] = pd.NaT
    new_records['is_current'] = True

    # Combine
    result = pd.concat([target_df, new_records], ignore_index=True)

    return result

# Data validation framework
def validate_dataframe(df, rules):
    """Apply data quality rules"""

    results = []

    for rule_name, rule_func in rules.items():
        try:
            passed = rule_func(df)
            failed_count = (~passed).sum()
            pass_rate = (passed.sum() / len(df)) * 100

            results.append({
                'rule': rule_name,
                'passed': passed.sum(),
                'failed': failed_count,
                'pass_rate': pass_rate,
                'status': 'PASS' if pass_rate >= 95 else 'FAIL'
            })
        except Exception as e:
            results.append({
                'rule': rule_name,
                'error': str(e),
                'status': 'ERROR'
            })

    return pd.DataFrame(results)

# Validation rules
validation_rules = {
    'not_null_id': lambda df: df['id'].notnull(),
    'positive_amount': lambda df: df['amount'] > 0,
    'valid_email': lambda df: df['email'].str.match(r'^[^@]+@[^@]+\.[^@]+$'),
    'date_in_range': lambda df: df['date'].between('2020-01-01', pd.Timestamp.now()),
    'valid_category': lambda df: df['category'].isin(['A', 'B', 'C'])
}

report = validate_dataframe(df, validation_rules)
```

## 📊 Analytics Patterns

```python
# Cohort analysis
cohort_df = (
    df
    .assign(
        cohort_month=lambda x: x['signup_date'].dt.to_period('M'),
        event_month=lambda x: x['event_date'].dt.to_period('M')
    )
    .assign(
        months_since_signup=lambda x: (x['event_month'] - x['cohort_month']).apply(lambda p: p.n)
    )
    .groupby(['cohort_month', 'months_since_signup'])
    .agg(active_users=('user_id', 'nunique'))
    .reset_index()
    .pivot(index='cohort_month', columns='months_since_signup', values='active_users')
)

# Retention rates
retention = cohort_df.div(cohort_df[0], axis=0) * 100

# RFM Analysis
rfm = (
    df
    .groupby('customer_id')
    .agg(
        recency=('order_date', lambda x: (pd.Timestamp.now() - x.max()).days),
        frequency=('order_id', 'nunique'),
        monetary=('amount', 'sum')
    )
    .assign(
        r_score=lambda x: pd.qcut(x['recency'], q=5, labels=[5, 4, 3, 2, 1]),
        f_score=lambda x: pd.qcut(x['frequency'], q=5, labels=[1, 2, 3, 4, 5], duplicates='drop'),
        m_score=lambda x: pd.qcut(x['monetary'], q=5, labels=[1, 2, 3, 4, 5], duplicates='drop')
    )
    .assign(
        rfm_score=lambda x: x['r_score'].astype(int) + x['f_score'].astype(int) + x['m_score'].astype(int)
    )
)

# Funnel analysis
funnel = (
    df
    .groupby('user_id')
    .agg(
        viewed=('event', lambda x: (x == 'page_view').any()),
        added_cart=('event', lambda x: (x == 'add_to_cart').any()),
        checkout=('event', lambda x: (x == 'checkout').any()),
        purchased=('event', lambda x: (x == 'purchase').any())
    )
    .agg({
        'viewed': 'sum',
        'added_cart': 'sum',
        'checkout': 'sum',
        'purchased': 'sum'
    })
    .to_frame()
    .assign(
        view_to_cart=lambda x: x['added_cart'] / x['viewed'] * 100,
        cart_to_checkout=lambda x: x['checkout'] / x['added_cart'] * 100,
        checkout_to_purchase=lambda x: x['purchased'] / x['checkout'] * 100
    )
)

# ABC Analysis (Pareto)
abc = (
    df
    .groupby('product_id')
    .agg(revenue=('amount', 'sum'))
    .sort_values('revenue', ascending=False)
    .assign(
        cumulative_revenue=lambda x: x['revenue'].cumsum(),
        total_revenue=lambda x: x['revenue'].sum(),
        cumulative_pct=lambda x: x['cumulative_revenue'] / x['total_revenue'] * 100
    )
    .assign(
        abc_class=lambda x: pd.cut(
            x['cumulative_pct'],
            bins=[0, 80, 95, 100],
            labels=['A', 'B', 'C']
        )
    )
)

# Customer Lifetime Value (CLV)
clv = (
    df
    .groupby('customer_id')
    .agg(
        first_purchase=('date', 'min'),
        last_purchase=('date', 'max'),
        total_purchases=('order_id', 'nunique'),
        total_revenue=('amount', 'sum')
    )
    .assign(
        customer_age_days=lambda x: (x['last_purchase'] - x['first_purchase']).dt.days,
        avg_order_value=lambda x: x['total_revenue'] / x['total_purchases'],
        purchase_frequency=lambda x: x['total_purchases'] / (x['customer_age_days'] / 365)
    )
    .assign(
        clv_estimate=lambda x: x['avg_order_value'] * x['purchase_frequency'] * 3  # 3 year horizon
    )
)

# Time series decomposition
from statsmodels.tsa.seasonal import seasonal_decompose

ts_data = df.set_index('date')['value'].resample('D').sum()
decomposition = seasonal_decompose(ts_data, model='additive', period=7)

ts_df = pd.DataFrame({
    'original': ts_data,
    'trend': decomposition.trend,
    'seasonal': decomposition.seasonal,
    'residual': decomposition.resid
})

# Market basket analysis (association rules)
basket = (
    df
    .groupby(['transaction_id', 'product'])
    .size()
    .unstack(fill_value=0)
    .applymap(lambda x: 1 if x > 0 else 0)
)

# Calculate support for individual items
item_support = basket.sum() / len(basket)

# Find frequent itemsets (simple example)
def find_pairs(basket_df, min_support=0.01):
    """Find product pairs that frequently occur together"""
    from itertools import combinations

    pairs = []
    products = basket_df.columns

    for prod1, prod2 in combinations(products, 2):
        support = (basket_df[prod1] & basket_df[prod2]).sum() / len(basket_df)
        if support >= min_support:
            pairs.append({
                'product_1': prod1,
                'product_2': prod2,
                'support': support
            })

    return pd.DataFrame(pairs).sort_values('support', ascending=False)
```

## ⚡ Performance Optimization

```python
# Memory optimization
def optimize_dtypes(df):
    """Automatically optimize DataFrame dtypes"""

    df_optimized = df.copy()

    # Optimize integers
    int_cols = df_optimized.select_dtypes(include=['int']).columns
    for col in int_cols:
        col_min = df_optimized[col].min()
        col_max = df_optimized[col].max()

        if col_min >= 0:
            if col_max < 255:
                df_optimized[col] = df_optimized[col].astype('uint8')
            elif col_max < 65535:
                df_optimized[col] = df_optimized[col].astype('uint16')
            elif col_max < 4294967295:
                df_optimized[col] = df_optimized[col].astype('uint32')
        else:
            if col_min > np.iinfo(np.int8).min and col_max < np.iinfo(np.int8).max:
                df_optimized[col] = df_optimized[col].astype('int8')
            elif col_min > np.iinfo(np.int16).min and col_max < np.iinfo(np.int16).max:
                df_optimized[col] = df_optimized[col].astype('int16')
            elif col_min > np.iinfo(np.int32).min and col_max < np.iinfo(np.int32).max:
                df_optimized[col] = df_optimized[col].astype('int32')

    # Optimize floats
    float_cols = df_optimized.select_dtypes(include=['float']).columns
    for col in float_cols:
        df_optimized[col] = df_optimized[col].astype('float32')

    # Convert object to category if beneficial
    for col in df_optimized.select_dtypes(include=['object']).columns:
        num_unique = df_optimized[col].nunique()
        num_total = len(df_optimized)
        if num_unique / num_total < 0.5:  # Less than 50% unique
            df_optimized[col] = df_optimized[col].astype('category')

    print(f"Original memory: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    print(f"Optimized memory: {df_optimized.memory_usage(deep=True).sum() / 1024**2:.2f} MB")

    return df_optimized

# Vectorized operations (fast)
# GOOD
df['total'] = df['price'] * df['quantity']

# BAD (slow)
df['total'] = df.apply(lambda x: x['price'] * x['quantity'], axis=1)

# Use .loc for conditional assignment
# GOOD
df.loc[df['amount'] > 100, 'tier'] = 'high'

# BAD (slower)
df['tier'] = df['amount'].apply(lambda x: 'high' if x > 100 else 'low')

# Use query for complex filtering (faster on large datasets)
df_filtered = df.query('amount > 100 and status == "active"')

# Avoid iterrows - use vectorized operations or apply
# BAD (very slow)
for idx, row in df.iterrows():
    df.at[idx, 'new_col'] = row['col1'] * row['col2']

# GOOD
df['new_col'] = df['col1'] * df['col2']

# Use categorical for repeated strings
df['category'] = df['category'].astype('category')

# Parallel processing with swifter (requires swifter package)
# import swifter
# df['new_col'] = df['col'].swifter.apply(complex_function)

# Dask for out-of-core processing
import dask.dataframe as dd

# Convert to Dask DataFrame
ddf = dd.from_pandas(df, npartitions=4)

# Process in parallel
result = ddf.groupby('category').amount.sum().compute()

# Chunk processing for memory efficiency
def process_large_file(file_path, chunk_size=100000):
    """Process large CSV in chunks"""

    results = []

    for chunk in pd.read_csv(file_path, chunksize=chunk_size):
        # Process chunk
        processed = chunk[chunk['amount'] > 0]
        results.append(processed)

    return pd.concat(results, ignore_index=True)

# Use eval for complex calculations (faster)
df['result'] = df.eval('(col1 + col2) * col3')

# Index optimization
df = df.set_index('date')  # Faster lookups
df = df.sort_index()       # Faster range queries
```

## 🔐 Security & Data Governance

```python
# PII masking
df['email_masked'] = df['email'].str.replace(
    r'^(.{2}).*(@.*)$',
    r'\1***\2',
    regex=True
)

df['phone_masked'] = df['phone'].str.replace(
    r'(\d{3})\d{3}(\d{4})',
    r'\1***\2',
    regex=True
)

# Hash sensitive data
import hashlib

def hash_value(value):
    return hashlib.sha256(str(value).encode()).hexdigest()

df['ssn_hash'] = df['ssn'].apply(hash_value)

# Credit card masking
df['cc_last4'] = df['cc_number'].str[-4:]
df['cc_masked'] = '************' + df['cc_last4']

# Row-level security
def apply_row_level_security(df, user_role, user_id):
    """Filter based on user permissions"""

    if user_role == 'admin':
        return df
    elif user_role == 'manager':
        return df[df['department_id'] == user_id]
    else:
        return df[df['created_by'] == user_id]

# Audit logging
df['processed_by'] = 'etl_pipeline'
df['processed_at'] = pd.Timestamp.now()
df['pipeline_version'] = '1.0'

# Data lineage
metadata = {
    'source': 'raw_events.csv',
    'transformation': 'aggregation_pipeline',
    'destination': 'analytics_mart',
    'row_count': len(df),
    'timestamp': pd.Timestamp.now()
}
```

## ⚠️ Common Gotchas

- **`SettingWithCopyWarning`** — usually means you assigned into a slice pandas can't guarantee is a view vs a copy. Use `df.loc[row_filter, 'col'] = value` (single `.loc` call) instead of chained indexing like `df[row_filter]['col'] = value`.
- **Chained indexing silently fails** — `df[df.a > 0]['b'] = 1` may or may not modify `df`; always chain conditions inside one `.loc[...]` call.
- **Integer columns become `float64` when they contain `NaN`** — plain `int64` has no missing-value representation. Use pandas' nullable `Int64` (capital I) if you need integers with nulls.
- **`groupby()` drops NaN keys by default** — rows where the grouping column is null vanish from the result unless you pass `dropna=False`.
- **`merge()` can silently multiply rows** — a one-to-many or many-to-many join expands row count; pass `validate='one_to_one'` (or the appropriate option) when you expect a specific cardinality.
- **`apply(axis=1)` is convenient but slow** — it row-loops under the hood. Prefer vectorized operations, `np.where`/`np.select`, or `.map`/`.transform` where possible.
- **Index alignment on arithmetic** — `df1['a'] + df2['a']` aligns on index labels, not position; mismatched or duplicate indexes produce `NaN`s or row explosions. `reset_index(drop=True)` first if you want positional alignment.
- **`inplace=True` doesn't always avoid a copy** — and it prevents method chaining. Most style guides now recommend avoiding it in favor of reassignment.
- **`read_csv` infers dtypes per column independently** — a column that's mostly integers with one stray string will be read as `object`, silently breaking downstream numeric operations. Set `dtype=` explicitly for anything that matters.

## 🎯 Best Practices

```python
# Method chaining for readable code
result = (
    df
    .query('amount > 0')
    .assign(
        year=lambda x: x['date'].dt.year,
        amount_log=lambda x: np.log1p(x['amount'])
    )
    .groupby('category')
    .agg(
        total=('amount', 'sum'),
        count=('id', 'count')
    )
    .reset_index()
    .sort_values('total', ascending=False)
)

# Use pipe for custom functions
def custom_transform(df):
    return df[df['amount'] > 0]

result = (
    df
    .pipe(custom_transform)
    .groupby('category')
    .sum()
)

# Context managers for options
with pd.option_context('display.max_rows', 100):
    print(df)

# Explicit copies to avoid SettingWithCopyWarning
df_copy = df.copy()
df_copy['new_col'] = values

# Use .loc for assignment
df.loc[df['amount'] > 100, 'tier'] = 'high'

# Validate inputs
assert df['id'].notnull().all(), "Found null IDs"
assert df['amount'].min() >= 0, "Found negative amounts"
```

## 📚 Idioms, Performance & Memory Tips

### Common Idioms

```python
# Check if column exists
if 'column' in df.columns:
    pass

# Conditional column creation
df['new_col'] = np.where(df['col'] > 5, 'high', 'low')

# Multiple conditions
conditions = [
    df['col'] < 5,
    (df['col'] >= 5) & (df['col'] < 10),
    df['col'] >= 10
]
choices = ['low', 'medium', 'high']
df['category'] = np.select(conditions, choices, default='unknown')

# Percentage of total
df['pct'] = df['amount'] / df['amount'].sum() * 100

# Cumulative percentage
df['cum_pct'] = df['amount'].cumsum() / df['amount'].sum() * 100

# Rank
df['rank'] = df['amount'].rank(method='dense', ascending=False)

# Binning
df['bin'] = pd.cut(df['value'], bins=5, labels=['Q1', 'Q2', 'Q3', 'Q4', 'Q5'])
df['quantile'] = pd.qcut(df['value'], q=4)
```

### Performance Tips

1. Use vectorized operations instead of apply/iterrows
2. Use categorical dtype for strings with low cardinality
3. Downcast numeric types to save memory
4. Use query() for complex boolean indexing
5. Read only needed columns with usecols
6. Use chunksize for large files
7. Use eval() for complex arithmetic
8. Set index for faster lookups
9. Use Parquet instead of CSV
10. Avoid chained indexing

### Memory Tips

1. Use `df.info(memory_usage='deep')` to check memory
2. Convert object to category when unique < 50%
3. Use smaller int types (int8, int16, int32)
4. Use float32 instead of float64 when possible
5. Drop unnecessary columns early
6. Process in chunks for huge files
7. Use Dask for out-of-memory datasets
8. Use sparse data structures for sparse data
9. Clear memory with `del df` and `gc.collect()`
10. Use memory_map=True for read operations

## 💡 Pro Tips

1. **Always use .copy()** when creating derived DataFrames
2. **Set parse_dates** when reading CSVs with dates
3. **Use .loc and .iloc** explicitly for clarity
4. **Validate data types** after reading files
5. **Use method chaining** for readable pipelines
6. **Profile memory usage** regularly
7. **Use categorical** for repeated strings
8. **Avoid loops** - think vectorized
9. **Use query()** for readable filtering
10. **Test on samples** before processing full data
11. **Document transformations** inline
12. **Use assert** for data validation
13. **Keep functions pure** for testability
14. **Use .pipe()** for custom transforms
15. **Monitor performance** with %%timeit
