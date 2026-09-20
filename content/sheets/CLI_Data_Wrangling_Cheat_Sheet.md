# Command-Line Data Wrangling Cheatsheet for Data & Analytics Engineers

> A structured reference for wrangling data directly in the shell — text tools (grep/sed/awk), structured-data tools (jq, csvkit, Miller, xsv/qsv), the DuckDB CLI, and composable pipeline patterns.

## 📑 Table of Contents

1. [🧠 Core Philosophy: Unix Pipes](#core-philosophy-unix-pipes)
2. [🔍 grep, sed, awk](#grep-sed-awk)
3. [✂️ cut, sort, uniq, join, paste](#cut-sort-uniq-join-paste)
4. [🗂️ jq: JSON on the Command Line](#jq-json-on-the-command-line)
5. [📊 csvkit](#csvkit)
6. [⚡ xsv / qsv](#xsv-qsv)
7. [🧮 Miller (mlr)](#miller-mlr)
8. [🦆 DuckDB CLI](#duckdb-cli)
9. [🔎 ripgrep & fd](#ripgrep-fd)
10. [⚙️ GNU Parallel](#gnu-parallel)
11. [🌐 curl + jq Pipelines](#curl-jq-pipelines)
12. [🗜️ Compression & Archives](#compression-archives)
13. [🏗️ Composed Pipeline Examples](#composed-pipeline-examples)
14. [🧾 visidata: Interactive Terminal Spreadsheet](#visidata-interactive-terminal-spreadsheet)
15. [🌲 jless & fx: Interactive JSON Exploration](#jless-fx-interactive-json-exploration)
16. [📐 datamash: Statistics on the Command Line](#datamash-statistics-on-the-command-line)
17. [🪶 Working with Parquet from the CLI](#working-with-parquet-from-the-cli)
18. [🧵 awk Deep Dive: Functions, Arrays & Multi-File Logic](#awk-deep-dive-functions-arrays-multi-file-logic)
19. [🖥️ tmux for Long-Running Wrangling Jobs](#tmux-for-long-running-wrangling-jobs)
20. [⚠️ Common Gotchas](#common-gotchas)
21. [🎯 Best Practices](#best-practices)
22. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                          | Tool / Command                                                          |
| ------------------------------- | --------------------------------------------------------------------------- |
| Search text                     | `grep -E 'pattern' file` / `rg 'pattern'`                                 |
| Find & replace                  | `sed 's/old/new/g' file`                                                  |
| Column-based processing         | `awk -F',' '{print $1, $3}' file.csv`                                     |
| Pretty-print / query JSON       | `jq '.data[] | .id' file.json`                                            |
| CSV stats/filter/convert        | `csvstat file.csv`, `csvcut -c 1,3 file.csv`, `in2csv file.xlsx`          |
| Fast CSV ops (Rust)             | `qsv stats file.csv`, `qsv select 1,3 file.csv`                          |
| Generic tabular Swiss-army knife| `mlr --csv stats1 -a sum,mean -f amount data.csv`                        |
| SQL directly on files           | `duckdb -c "SELECT * FROM 'data.parquet' LIMIT 10"`                      |
| Parallel execution              | `cat urls.txt | parallel -j8 curl -O {}`                                  |

## 🧠 Core Philosophy: Unix Pipes

- **Small tools, composed with `|`** — each tool does one thing (filter, transform, aggregate); pipelines chain them instead of writing one monolithic script.
- **Streaming by default** — most of these tools process line-by-line/record-by-record, so pipelines can handle files far larger than memory without special "big data" tooling.
- **Text/CSV/JSON as the lingua franca** — nearly every tool below reads from stdin and writes to stdout, so any tool's output can feed any other tool's input.

```bash
# The general shape of a CLI data pipeline
cat source.csv | tool_a | tool_b | tool_c > result.csv
# or, avoiding a useless cat:
tool_a source.csv | tool_b | tool_c > result.csv
```

## 🔍 grep, sed, awk

```bash
# grep: search
grep 'ERROR' app.log                     # literal match
grep -E '^(ERROR|WARN)' app.log          # extended regex, anchors
grep -i 'error' app.log                  # case-insensitive
grep -c 'ERROR' app.log                  # count matches
grep -v 'DEBUG' app.log                  # invert match (exclude)
grep -rl 'TODO' src/                     # recursive, filenames only
grep -A3 -B1 'Exception' app.log         # 3 lines after, 1 before context

# sed: stream editing
sed 's/foo/bar/' file                    # replace first occurrence per line
sed 's/foo/bar/g' file                   # replace all occurrences
sed -n '10,20p' file                     # print only lines 10-20
sed '/^#/d' file                         # delete comment lines
sed -i.bak 's/old/new/g' file            # in-place edit with backup
sed -E 's/([0-9]+)-([0-9]+)/\2-\1/' file # capture groups (extended regex)

# awk: field-based processing (the real workhorse for tabular text)
awk -F',' '{print $1, $3}' data.csv                       # print columns 1 and 3
awk -F',' '$3 > 100 {print}' data.csv                     # filter rows
awk -F',' '{sum += $3} END {print sum}' data.csv          # aggregate
awk -F',' '{count[$1]++} END {for (k in count) print k, count[k]}' data.csv  # group by + count
awk 'BEGIN{OFS=","} {$1=$1; print}' data.csv               # reformat with new field separator
awk -F',' 'NR==1 || $2=="active"' data.csv                 # keep header + filtered rows
```

| Tool | Best for |
| --- | --- |
| `grep` | Finding lines matching a pattern |
| `sed` | Line-oriented find/replace, simple transformations |
| `awk` | Column-oriented logic: filtering, aggregation, reformatting delimited text |

## ✂️ cut, sort, uniq, join, paste

```bash
cut -d',' -f1,3 data.csv                 # select columns by position
cut -c1-10 file.txt                      # select by character range

sort data.csv                            # lexicographic sort
sort -t',' -k3,3n data.csv               # numeric sort on 3rd column
sort -u data.csv                         # sort + dedupe

uniq -c sorted.txt                       # count consecutive duplicate lines (needs sort first)
sort data.txt | uniq -c | sort -rn       # classic "top values" pipeline

join -t',' -1 1 -2 1 sorted_a.csv sorted_b.csv   # SQL-style join on sorted key column

paste -d',' file1.txt file2.txt          # merge files side-by-side (column-wise)
```

## 🗂️ jq: JSON on the Command Line

```bash
# Basics
cat data.json | jq '.'                          # pretty-print
jq '.users[0].name' data.json                    # navigate structure
jq '.users[] | .email' data.json                 # iterate array
jq '.users | length' data.json                   # count

# Filtering
jq '.users[] | select(.active == true)' data.json
jq '.users[] | select(.age > 21) | .name' data.json

# Reshaping
jq '.users[] | {name, email}' data.json                    # project a subset of fields
jq '[.users[] | {id, full_name: (.first + " " + .last)}]' data.json   # derive new fields

# Flatten to CSV
jq -r '.users[] | [.id, .name, .email] | @csv' data.json

# Aggregation
jq '[.orders[].amount] | add' data.json
jq 'group_by(.category) | map({category: .[0].category, count: length})' data.json

# Reading NDJSON (one JSON object per line — common for logs/Kafka dumps)
jq -c '.' events.ndjson
jq -s '.' events.ndjson    # slurp all lines into a single array
```

## 📊 csvkit

```bash
pip install csvkit

in2csv data.xlsx > data.csv               # convert almost anything to CSV
in2csv data.json > data.csv

csvlook data.csv                          # render as a readable table
csvstat data.csv                          # per-column summary stats (like df.describe())
csvcut -n data.csv                        # list column names + indices
csvcut -c 1,3,5 data.csv                  # select columns
csvcut -C internal_notes data.csv         # select all EXCEPT named columns

csvgrep -c status -m active data.csv      # filter rows by column value
csvsort -c amount -r data.csv             # sort by column

csvjoin -c customer_id orders.csv customers.csv > joined.csv
csvstack file1.csv file2.csv > combined.csv   # union/concatenate

csvsql --query "SELECT category, SUM(amount) FROM data GROUP BY category" data.csv
csvsql --db postgresql:///mydb --insert data.csv   # load a CSV straight into a DB
```

## ⚡ xsv / qsv

```bash
# qsv is the actively maintained fork of xsv — both share nearly identical syntax, both are Rust-based and very fast on large CSVs
qsv headers data.csv
qsv stats data.csv --everything            # comprehensive per-column stats, fast even on GBs
qsv select 1,3,5 data.csv
qsv search -s status 'active' data.csv     # filter rows
qsv sort -s amount data.csv
qsv frequency -s category data.csv         # value counts per column
qsv join customer_id orders.csv customer_id customers.csv
qsv dedup data.csv
qsv sample 1000 data.csv                   # random sample
qsv slice -s 100 -l 50 data.csv            # row range
```

- **xsv/qsv vs csvkit** — xsv/qsv is dramatically faster on large files (Rust, minimal overhead) but has a narrower feature set; csvkit's `csvsql` (arbitrary SQL) and format conversion breadth are its edge.

## 🧮 Miller (mlr)

```bash
# Miller (mlr) speaks CSV, TSV, JSON, and more, uniformly — the closest CLI equivalent to a mini dplyr/pandas
mlr --csv cat data.csv                                   # print
mlr --csv filter '$amount > 100' data.csv                # filter rows
mlr --csv put '$total = $price * $qty' data.csv          # derive a column
mlr --csv cut -f name,amount data.csv                    # select columns
mlr --csv sort -f category -nr amount data.csv           # sort (ascending string, descending numeric)

# Aggregation
mlr --csv stats1 -a sum,mean,count -f amount -g category data.csv

# Format conversion — this is Miller's superpower
mlr --icsv --ojson cat data.csv > data.json
mlr --ijson --ocsv cat data.json > data.csv
mlr --icsv --opprint cat data.csv          # pretty-printed table to terminal

# Joins
mlr --csv join -j customer_id -f customers.csv orders.csv
```

## 🦆 DuckDB CLI

```bash
# Query files directly with full SQL — no loading step, no server
duckdb -c "SELECT * FROM 'data.csv' LIMIT 10"
duckdb -c "SELECT category, SUM(amount) FROM 'data.parquet' GROUP BY category"

# Query a glob of files as one table
duckdb -c "SELECT * FROM read_parquet('data/*.parquet') WHERE amount > 100"

# Join a CSV against a Parquet file in one query
duckdb -c "
  SELECT o.order_id, c.name
  FROM 'orders.csv' o
  JOIN 'customers.parquet' c ON o.customer_id = c.id
"

# Convert between formats trivially
duckdb -c "COPY (SELECT * FROM 'data.csv') TO 'data.parquet' (FORMAT PARQUET)"

# Interactive session
duckdb mydb.duckdb
.tables
.schema orders
```

- **DuckDB CLI vs the rest of this list** — once a wrangling task needs joins, window functions, or anything beyond simple filter/aggregate, DuckDB is usually less error-prone than chaining five shell tools, while staying just as fast and dependency-free.

## 🔎 ripgrep & fd

```bash
rg 'TODO' src/                     # grep, but much faster and .gitignore-aware by default
rg -t py 'import polars' .         # restrict to file type
rg -l 'password' .                 # filenames only
rg -c 'ERROR' logs/                # counts per file
rg --json 'ERROR' app.log | jq .   # structured output, pipeable into jq

fd '\.csv$'                        # find, but faster/simpler syntax than `find`
fd -e parquet -x du -h             # find + execute a command on each match
```

## ⚙️ GNU Parallel

```bash
# Run a command across many inputs concurrently
cat file_list.txt | parallel -j8 gzip {}
ls *.csv | parallel -j4 'duckdb -c "COPY (SELECT * FROM {}) TO {.}.parquet (FORMAT PARQUET)"'

# Parallel curl downloads
cat urls.txt | parallel -j16 curl -sO {}

# Track progress
cat file_list.txt | parallel --progress -j8 process_file.sh {}
```

## 🌐 curl + jq Pipelines

```bash
# Fetch an API, extract fields, write CSV — a whole mini-ETL in one line
curl -s "https://api.example.com/orders?page=1" \
  | jq -r '.data[] | [.id, .customer_id, .amount] | @csv' \
  > orders.csv

# Paginate and accumulate
for page in $(seq 1 10); do
  curl -s "https://api.example.com/orders?page=$page" | jq -c '.data[]'
done > all_orders.ndjson

# Retry + rate-limit aware fetching
curl -s --retry 3 --retry-delay 2 "https://api.example.com/data" | jq '.'
```

## 🗜️ Compression & Archives

```bash
gzip -k file.csv                     # compress, keep original
gunzip -k file.csv.gz                # decompress, keep original
zcat file.csv.gz | head              # peek inside without extracting
zcat file.csv.gz | wc -l             # count lines without extracting

tar -czf archive.tar.gz dir/         # compress a directory
tar -xzf archive.tar.gz              # extract

# Streaming through compressed files directly in a pipeline
zcat access.log.gz | grep '500' | wc -l
```

## 🏗️ Composed Pipeline Examples

```bash
# Top 10 IPs by request count from an access log
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10

# Extract, filter, and load an API response straight into DuckDB
curl -s "https://api.example.com/orders" \
  | jq -r '.data[] | [.id, .amount, .status] | @csv' \
  | duckdb -c "CREATE TABLE t AS SELECT * FROM read_csv('/dev/stdin', columns={'id':'INT','amount':'DOUBLE','status':'VARCHAR'}); SELECT status, SUM(amount) FROM t GROUP BY status"

# Clean, dedupe, and convert a messy CSV export to Parquet
csvclean messy.csv                                 # fixes common CSV formatting issues (csvkit)
qsv dedup messy_out.csv | duckdb -c "COPY (SELECT * FROM read_csv_auto('/dev/stdin')) TO 'clean.parquet' (FORMAT PARQUET)"

# Diff two CSVs by key (find rows changed between two snapshots)
qsv join --left id yesterday.csv id today.csv | qsv select id,amount_yesterday,amount_today \
  | mlr --csv filter '$amount_yesterday != $amount_today'
```

## 🧾 visidata: Interactive Terminal Spreadsheet

```bash
pip install visidata

vd data.csv                     # open interactively — sort, filter, pivot, all keyboard-driven
vd data.parquet                 # reads Parquet, JSON, SQLite, Excel, and dozens more formats natively
vd -f jsonl events.ndjson

# Common in-app commands (once open)
# g Ctrl+^   reload
# /pattern   search
# F          frequency table / histogram of the current column
# +          add a column aggregation while grouped
# Shift+F    frequency table with a chart
# Ctrl+S     save current view (filtered/sorted) to a new file
```

```bash
# Batch/scripted mode — run a saved set of commands non-interactively
vd -b -o output.csv -c commands.vdj input.csv
```

- visidata is the closest thing to **opening a huge CSV/Parquet file in Excel, but in the terminal and without loading it all into RAM** — ideal for quickly exploring an unfamiliar large file before deciding how to process it programmatically.
- Its **frequency tables and quick pivots** are often faster for a one-off "what are the distinct values and their counts" check than writing an `awk`/`qsv` one-liner.

## 🌲 jless & fx: Interactive JSON Exploration

```bash
# jless — a "less" for JSON: collapsible tree navigation, search, no full-file memory load for viewing
jless data.json
cat response.json | jless

# fx — interactive JSON viewer + a full JS-expression query language
cat data.json | fx
fx data.json '.users[0].email'                 # one-shot query, similar spirit to jq
fx data.json '.users.map(u => u.name)'         # arbitrary JS expressions, not just jq's DSL
```

- Reach for **`jless`/`fx` when exploring an unfamiliar, deeply nested JSON payload interactively**; reach for **`jq` when scripting a repeatable transformation** into a pipeline — they're complementary, not competing.

## 📐 datamash: Statistics on the Command Line

```bash
# GNU datamash — quick descriptive statistics without leaving the shell
datamash -t, mean 3 sum 3 max 3 min 3 < data.csv        # stats on column 3 of a CSV
datamash -t, groupby 1 mean 3 < data.csv                 # group-by aggregation (like SQL GROUP BY)
datamash -t, sstdev 3 < data.csv                          # sample standard deviation
datamash transpose < data.csv                             # pivot rows/columns
datamash -t, --sort -g 1 sum 3 < data.csv                 # sort input by group first, then aggregate

# Feeding it filtered/awk-selected columns is the typical composition pattern
cut -d',' -f2,4 data.csv | datamash -t, groupby 1 mean 2
```

- `datamash` fills the gap between `awk` (general-purpose but verbose for stats) and pulling in pandas/Polars for a single aggregate — best for a quick numeric summary mid-pipeline.

## 🪶 Working with Parquet from the CLI

```bash
# DuckDB is generally the best all-around tool for this (see the DuckDB CLI section above), but
# dedicated Parquet utilities are useful for pure metadata/inspection tasks:

pip install parquet-tools
parquet-tools show data.parquet                  # print rows
parquet-tools inspect data.parquet                # schema, row groups, compression, size
parquet-tools csv data.parquet > data.csv         # convert to CSV

# Or via DuckDB, which needs no separate install if it's already your CSV/SQL tool
duckdb -c "DESCRIBE SELECT * FROM 'data.parquet'"                       # schema
duckdb -c "SELECT COUNT(*) FROM 'data.parquet'"                          # row count without loading fully
duckdb -c "SELECT * FROM parquet_metadata('data.parquet')"               # row-group/compression detail

# pyarrow, if you need to script it rather than eyeball it
python -c "
import pyarrow.parquet as pq
print(pq.ParquetFile('data.parquet').schema)
print(pq.ParquetFile('data.parquet').metadata)
"
```

- **`parquet_metadata()` in DuckDB** is the fastest way to check row-group sizes and compression codec when diagnosing a "why is this Parquet file slow to scan" issue — no separate tool needed if DuckDB is already on the machine.

## 🧵 awk Deep Dive: Functions, Arrays & Multi-File Logic

```bash
# User-defined functions
awk -F',' '
function pct(part, total) { return total == 0 ? 0 : (part / total) * 100 }
{ total += $3 }
END { print "avg pct of max:", pct($3, total) }
' data.csv

# Associative arrays for grouping + multi-key aggregation
awk -F',' '
{ sum[$1","$2] += $3; count[$1","$2]++ }
END {
    for (key in sum) {
        split(key, parts, ",")
        printf "%s,%s,%.2f\n", parts[1], parts[2], sum[key]/count[key]
    }
}
' data.csv

# Processing multiple files, tracking which file a line came from
awk -F',' '
FNR == 1 { print "Processing:", FILENAME }
{ total[FILENAME] += $3 }
END { for (f in total) print f, total[f] }
' jan.csv feb.csv mar.csv

# Join two files on a key without pre-sorting (awk's own hash-join pattern)
awk -F',' '
NR==FNR { customer[$1] = $2; next }     # first file: build a lookup table
{ print $0, customer[$1] }              # second file: enrich each row
' customers.csv orders.csv
```

- The **`NR==FNR` idiom** is the standard awk "hash join" pattern for enriching one file with a lookup from another — much faster than a nested-loop join and doesn't require either file to be pre-sorted (unlike `join`).
- Associative arrays make **awk capable of full `GROUP BY`-style aggregation**, closing much of the gap with a real query engine for lighter tasks.

## 🖥️ tmux for Long-Running Wrangling Jobs

```bash
tmux new -s wrangle              # start a named, detachable session
# ... run a long pipeline ...
# Ctrl+b, d                       to detach — the job keeps running
tmux attach -t wrangle            # reattach later, from any terminal/SSH session

tmux new -s job -d 'zcat huge.log.gz | grep ERROR | wc -l > result.txt'   # launch detached directly

tmux ls                           # list sessions
tmux kill-session -t wrangle
```

- Critical for **any pipeline run over SSH that might outlive the connection** — a dropped SSH session kills a foreground job but not one running inside a detached `tmux` session.
- Combine with `pv` (pipe viewer) for a progress bar on long-running pipes: `pv huge.csv | awk ... `.

## ⚠️ Common Gotchas

- **`awk`'s default field separator is whitespace, not comma** — always pass `-F','` explicitly for CSV, and even then, commas inside quoted fields will break naive `awk`/`cut` parsing (use a real CSV-aware tool like `csvkit`/`qsv`/`mlr`/DuckDB for anything with quoted, comma-containing fields).
- **`sort` before `uniq`** — `uniq` only collapses *consecutive* duplicate lines; unsorted input silently produces wrong counts.
- **`sed -i` behaves differently on macOS vs GNU/Linux** — macOS (BSD sed) requires `sed -i '' 's/a/b/'` (empty string argument), while GNU sed accepts `sed -i 's/a/b/'` directly.
- **Locale settings affect `sort` ordering** — `LC_ALL=C sort` gives fast, consistent byte-order sorting; the default locale can sort case/accents differently across machines, breaking reproducibility.
- **`jq` truncates/streams large files fine, but `jq -s` (slurp) loads everything into memory** — avoid slurping multi-GB NDJSON files.
- **Piping into `duckdb` from `/dev/stdin` requires specifying `read_csv`/`read_csv_auto` with correct options** — malformed headers or inconsistent column counts upstream will surface as a DuckDB parse error, not a shell error.
- **GNU Parallel's default job count is the CPU core count** — this can be too aggressive for I/O-bound tasks (API calls) or too conservative for network-bound ones; always pass `-j` explicitly.

## 🎯 Best Practices

- Reach for **DuckDB or Miller once a "quick" `awk`/`sed` pipeline starts needing joins or multi-field aggregation** — it's more reliable than a five-stage shell pipeline and just as fast.
- Prefer **CSV-aware tools (csvkit/qsv/mlr/DuckDB) over raw `cut`/`awk`** whenever fields might contain quoted commas or embedded newlines.
- **Test destructive pipelines (`sed -i`, in-place sorts) on a copy first**, or always pass a backup suffix (`sed -i.bak`).
- Use `LC_ALL=C` for **performance and reproducibility** on large sorts/greps when locale-aware collation isn't actually needed.
- Keep **pipelines streaming (avoid unnecessary `cat`/temp files)** wherever the whole chain can process line-by-line — this is what lets these tools handle files bigger than RAM.

## 💡 Pro Tips

1. **`zcat file.gz | wc -l`** lets you sanity-check row counts on compressed files without ever extracting them to disk.
2. **`jq -r '... | @csv'`** is the fastest path from an arbitrary JSON API response to a clean CSV, no intermediate script needed.
3. **DuckDB can `read_csv`/`read_parquet` directly from `s3://` and `https://` URLs** — often you don't need to download a file locally before querying it.
4. **`rg` (ripgrep) is a drop-in `grep` replacement that's dramatically faster** on large codebases/log directories and respects `.gitignore` by default.
5. **`mlr` is the tool to reach for when the input/output formats differ** (CSV in, JSON out, or vice versa) — most other tools assume one format throughout.
6. **`qsv stats --everything`** gives a near-instant data profile (nulls, cardinality, min/max, type inference) on CSVs too large to comfortably open in pandas.
7. **GNU Parallel's `{.}`** substitution strips the file extension — handy for "convert every file, same name, new extension" pipelines.
8. **Combine `curl --retry` with `jq -e`** (`jq -e` sets a non-zero exit code on `null`/`false` output) to build simple, robust polling loops without extra scripting.
