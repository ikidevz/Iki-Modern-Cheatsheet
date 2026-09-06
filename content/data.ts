import type { Category } from "@/lib/types";

export const DATA: Category[] = [
	{
		key: "db",
		label: "Data warehouses & databases",
		items: [
			{
				id: "snowflake",
				customizedComponent: false,
				name: "Snowflake",
				file: "Snowflake_Cheatsheet.md",
				status: "solid",
				tagline: "Warehouses, loading, Time Travel, Streams & Tasks, RBAC",
				covers:
					"Covers the full lifecycle: warehouse sizing, stage and Snowpipe loading, VARIANT and semi-structured data, Time Travel and cloning, Streams and Tasks, RBAC, performance and cost management, and UDFs/stored procedures, closing with a sharp gotchas list.",
				fixes: [],
				extend: [
					"Snowpark DataFrame API beyond the single stored-proc example",
					"Iceberg tables",
					"External functions",
					"Data Sharing / Marketplace",
					"Dynamic tables — replaces a lot of the manual stream+task pattern",
				],
			},
			{
				id: "postgres",
				customizedComponent: false,
				name: "PostgreSQL",
				file: "PostgreSQL_Cheatsheet.md",
				status: "solid",
				tagline: "psql, window functions, JSON/JSONB, arrays, indexing",
				covers:
					"Excellent coverage across psql commands, filtering, window functions, JSON/JSONB, arrays, indexing, and cohort/RFM/funnel patterns.",
				fixes: [],
				extend: [
					"LISTEN/NOTIFY",
					"Logical replication basics",
					"pg_stat_statements",
					"Partitioning (PARTITION BY RANGE/LIST)",
				],
			},
			{
				id: "mysql",
				customizedComponent: false,
				name: "MySQL",
				file: "MySQL_Cheatsheet.md",
				status: "solid",
				tagline: "CRUD, joins, window functions, JSON, RFM, cohort/YoY",
				covers:
					"Comprehensive — CRUD, joins, window functions, JSON, RFM, cohort/YoY analysis, sampling, export, and user management.",
				fixes: [],
				extend: [
					"Generated/virtual columns",
					"JSON_TABLE",
					"Replication basics",
				],
			},
			{
				id: "sqlalchemy",
				customizedComponent: false,
				name: "SQLAlchemy",
				file: "SQLAlchemy.md",
				status: "solid",
				tagline: "The thinnest file in the set, written entirely in 1.x style",
				covers:
					"About 200 lines against 600–3000+ for its peers, and written throughout in SQLAlchemy 1.x idiom.",
				fixes: [],
				extend: [
					"A full rewrite in 2.0 style",
					"Alembic migrations",
					"Async engine/session (create_async_engine)",
					"Connection pooling options",
					"Index/constraint definitions",
				],
			},
		],
	},
	{
		key: "py",
		label: "Python data libraries",
		items: [
			{
				id: "pandas",
				customizedComponent: false,
				name: "Pandas",
				file: "Pandas_Cheatsheet.md",
				status: "solid",
				tagline: "I/O, profiling, cleaning, reshaping, joins, ETL patterns",
				covers:
					"Very thorough — I/O, profiling, cleaning, reshaping, joins, dates, ETL patterns, performance, and security/governance.",
				fixes: [
					"read_csv(..., date_parser=...) — date_parser was deprecated in pandas 2.0 and removed in 2.2+. The modern equivalent is date_format=, worth updating since this is exactly the line people copy-paste and hit a warning on with a current install.",
				],
				extend: [
					"pd.NA vs np.nan handling nuances",
					".convert_dtypes()",
					"PyArrow-backed dtypes (dtype_backend='pyarrow')",
				],
			},
			{
				id: "polars",
				customizedComponent: false,
				name: "Polars",
				file: "Polars_Cheat_Sheet.md",
				status: "solid",
				tagline: "Eager vs lazy, SQL context, expressions, window functions",
				covers:
					"Excellent — eager vs. lazy primer, SQL context, expressions, window functions, and a self-correcting gotchas section (it already notes one regex bug it fixed).",
				fixes: [
					"The phone-masking regex still uses Python-style backreferences (\\1***\\2) while the email-masking line right above it correctly uses Polars\u2019 $1***$2 syntax — this one will silently print literal backslash text instead of masking.",
					"The credit-card mask appends the stars after the last four digits instead of before it — backwards for a mask.",
				],
				extend: [
					"pl.Enum vs pl.Categorical, compared head-to-head",
					"A walkthrough of pl.LazyFrame.explain() output",
				],
			},
			{
				id: "pyspark",
				customizedComponent: false,
				name: "PySpark",
				file: "PySpark_Cheatsheet.md",
				status: "solid",
				tagline: "Lazy evaluation, UDFs, broadcast/accumulators, skew handling",
				covers:
					"Lazy evaluation, UDFs, broadcast variables and accumulators, window functions, skew handling and salting, security patterns, and tuning tips.",
				fixes: [
					"The RFM scoring block redefines window_spec three times in a row — not wrong, just redundant. Three independent Window.orderBy(...) calls would read more clearly.",
				],
				extend: [
					"Delta Lake merge/upsert syntax — mentioned as best practice but never shown in code",
					"pandas_udf / Arrow-optimized UDFs",
					"Structured streaming basics",
				],
			},
		],
	},
	{
		key: "infra",
		label: "Infrastructure",
		items: [
			{
				id: "dbt",
				customizedComponent: false,
				name: "dbt",
				file: "dbt_Cheatsheet.md",
				status: "solid",
				tagline: "Project structure, materializations, snapshots, tests",
				covers:
					"Project structure, materializations, model selection syntax, snapshots, tests, Jinja/macros, incremental strategies, hooks, and exposures.",
				fixes: [],
				extend: [
					"Unit tests (dbt test for logic, not just data)",
					"Model contracts/versions",
					"dbt Mesh (cross-project ref())",
					"Python models",
				],
			},
			{
				id: "kafka",
				customizedComponent: false,
				name: "Kafka",
				file: "kafka.md",
				status: "planned",
				tagline: "Deep and code-heavy, but styled differently from the rest",
				covers:
					"Producers, consumers, config tuning, a CDC/replication example, troubleshooting, and a glossary — genuinely deep content.",
				fixes: [
					'Written in a more verbose "definition \u2192 purpose \u2192 bullets" tutorial style with no table of contents or quick-reference table, unlike the rest of the set — worth reformatting if these are meant to sit together as one reference.',
					"Built entirely on kafka-python, which has had slow-maintenance stretches. confluent-kafka-python (librdkafka-based) is the more actively maintained alternative and is worth at least a callout.",
				],
				extend: [
					"Kafka Streams / ksqlDB",
					"Schema Registry with Avro/Protobuf serialization",
					"Kafka Connect",
				],
			},
			{
				id: "redis",
				customizedComponent: false,
				name: "Redis",
				file: "redis.md",
				status: "solid",
				tagline: "2,800+ lines — data types, production patterns, tuning",
				covers:
					"The deepest file in the whole set: data type deep-dives, production patterns (sessions, caching, rate limiting, distributed locks, leaderboards, carts, queues), performance tuning, security, monitoring scripts, and a deployment checklist.",
				fixes: [
					"Same narrative/tutorial style as Kafka rather than the terse quick-reference format used by the SQL/warehouse files — not wrong, just inconsistent if you want one uniform family of cheatsheets.",
				],
				extend: [
					"Redis Streams (XADD/XREAD, consumer groups) — a notable omission given how much else is covered",
					"Redis Cluster hands-on commands, currently only discussed conceptually",
					"RedisJSON/RediSearch if you use Redis Stack",
				],
			},
			{
				id: "terraform",
				customizedComponent: false,
				name: "Terraform",
				file: "Terraform.md",
				status: "solid",
				tagline: "Infrastructure as code for provisioning the data stack",
				covers:
					"Terraform mechanics for standing up the pieces already covered elsewhere in this index — S3 buckets, Glue jobs, Redshift clusters — plus the state-management and module patterns that separate a script you run once from infrastructure a team can actually maintain.",
				fixes: [],
				extend: [
					"Core workflow: init/plan/apply/destroy, and reading a plan diff before trusting it",
					"State management: remote state (S3 + DynamoDB locking), why local state breaks in a team",
					"Resource vs. data source vs. module — when each is the right building block",
					"Variables, outputs, and locals — keeping dev/staging/prod from diverging",
					"Provisioning the AWS data stack from this index: S3 buckets with lifecycle rules, Glue jobs/crawlers, Redshift clusters, IAM roles for least-privilege pipeline access",
					"Workspaces vs. separate state files for environment separation",
					"Drift detection and terraform import for adopting existing infrastructure",
					"Common gotchas: circular dependencies between resources, provider version pinning",
				],
			},
			{
				id: "docker",
				customizedComponent: false,
				name: "Docker",
				file: "docker.md",
				status: "solid",
				tagline:
					"Containerizing pipelines, notebooks, and the tools already in this index",
				covers:
					"Docker as the runtime layer underneath everything else here — packaging a Python/PySpark job so it runs the same on a laptop and in production, multi-stage builds for smaller images, and docker-compose for local Kafka/Redis/Postgres stacks during development.",
				fixes: [],
				extend: [
					"Core concepts: images vs. containers, layers and caching, the build context",
					"Dockerfile patterns for data jobs: pinning base images, multi-stage builds to keep Spark/ML images small",
					"docker-compose for local dev stacks — spinning up Kafka + Redis + Postgres together, matching what\u2019s already in this category",
					"Volume mounts and bind mounts — getting data in and out without baking it into the image",
					"Environment variables and secrets — what not to bake into an image",
					"Networking between containers, and the differences from host networking",
					"Image size and security: distroless/slim base images, scanning for vulnerabilities",
					"Where Docker stops and Kubernetes starts — a short note on when a single container isn\u2019t enough anymore",
				],
			},
		],
	},
	{
		key: "ds",
		label: "Data science & statistics",
		items: [
			{
				id: "abtesting",
				customizedComponent: true,
				name: "A/B Testing — 50 Problems",
				file: "AB_Testing_50_Problems.md",
				status: "planned",
				tagline: "50 worked scenarios across a wide range of industries",
				covers:
					"Each scenario carries a hypothesis, correct test selection with rationale, runnable sample data, and a lesson that usually includes a real caveat — confounds, SRM, holdout limitations. The strongest file in the set relative to its stated goal.",
				fixes: [],
				extend: [
					"Multiple-comparisons correction (Bonferroni / BH-FDR) for testing many metrics at once",
					"Sequential / always-valid testing (mSPRT) for teams that peek continuously",
					"CUPED or other variance-reduction techniques",
					"An explicit non-inferiority test example",
				],
			},
			{
				id: "clustering",
				customizedComponent: true,
				name: "Clustering Problems",
				file: "clustering_100_problems.md",
				status: "planned",
				tagline:
					"75 self-contained scikit-learn problems, Beginner \u2192 Advanced",
				covers:
					'All problems are self-contained scikit-learn with synthetic data, progressing Beginner \u2192 Intermediate \u2192 Advanced, and ending in a genuinely useful "which algorithm when" reference table.',
				fixes: [
					'The filename says "100_problems" but the file is titled and structured as 75, not 100+ — either it was trimmed from a bigger plan and the filename wasn\u2019t updated, or 25 problems are missing. Worth reconciling either way.',
				],
				extend: [
					"Fuzzy c-means",
					"HDBSCAN",
					"Self-organizing maps",
					"Subspace clustering",
					"Per-cluster silhouette evaluation",
					"Clustering on sparse/text embeddings from a transformer model",
				],
			},
			{
				id: "oneliners",
				customizedComponent: false,
				name: "Python One-Liners",
				file: "1000_plus_python_one_liners.md",
				status: "solid",
				tagline: "1,020 one-liners across 52 categories",
				covers:
					"1,020 one-liners across 52 categories, closing with an honest limitations section — no try/except in lambdas, recursive-lambda naming quirks, ordering dependencies between functions.",
				fixes: [],
				extend: [
					"A security-flagged section for eval/exec-based one-liners, with an explicit don\u2019t-run-on-untrusted-input warning, matching the existing pattern of flagging caveats",
				],
			},
			{
				id: "charts",
				customizedComponent: false,
				name: "Data Visualization — 103 Charts",
				file: "100_Plus_Chart_Types_Cheatsheet.md",
				status: "solid",
				tagline: "103 chart types across matplotlib, seaborn & plotly",
				covers:
					"103 chart types, each with description, purpose, use cases, sample data, and runnable code, split sensibly across matplotlib, seaborn, and plotly by fit.",
				fixes: [
					'The intro claims everything was tested against "plotly 7.0" as the current stable release — the actual latest release is still the 6.x line (6.9.0); there is no 7.0 yet.',
				],
				extend: [
					'A short "how to pick a chart" decision tree at the top — the 12 category headers already imply one',
					"A dedicated style-customization section (themes, colorblind-safe palettes) instead of scattered per-chart notes",
				],
			},
			{
				id: "mathstats",
				customizedComponent: true,
				name: "Math & Statistics",
				file: "Math_and_Statistics.md",
				status: "solid",
				tagline:
					"The stats and applied math the A/B Testing and Clustering sheets assume you have",
				covers:
					"Foundational probability and statistics — distributions, estimation, hypothesis testing theory, and the linear algebra/calculus that shows up in ML — written as the reference the A/B Testing and Clustering cheatsheets assume you already have.",
				fixes: [],
				extend: [
					"Descriptive statistics: mean/median/variance, skewness, robust statistics",
					"Probability distributions: normal, binomial, Poisson, exponential — when each models real data",
					"Estimation: point estimates, confidence intervals, the CLT",
					"Hypothesis testing theory: p-values, power, Type I/II errors — the theory behind the A/B Testing test-selection table",
					"Correlation vs. causation, Simpson\u2019s paradox — ties directly to a pitfall already covered in the 50 A/B testing problems",
					"Bayesian basics: priors, posteriors, when Bayesian A/B testing beats frequentist",
					"Linear algebra essentials: vectors, matrices, eigenvalues — the minimum needed to read ML papers / PCA",
					"Basic calculus for ML: gradients, partial derivatives, why gradient descent works",
				],
			},
			{
				id: "featureeng",
				customizedComponent: true,
				name: "Feature Engineering",
				file: "Feature_Engineering.md",
				status: "solid",
				tagline:
					"Encoding, scaling, and the leakage traps that break models in production",
				covers:
					"The feature engineering practices that sit between raw data and a working model — encoding categorical variables correctly, scaling numeric ones, and the data leakage patterns that make a model look great in testing and fail silently in production.",
				fixes: [],
				extend: [
					"Categorical encoding: one-hot, ordinal, target/mean encoding, and when each introduces leakage",
					"Numeric scaling: standardization vs. normalization vs. robust scaling, and when tree-based models don\u2019t need any of it",
					"Handling missing data as a feature: indicator columns, imputation strategies and their tradeoffs",
					"Datetime feature extraction: cyclical encoding for hour/day-of-week, holiday flags, lag features for time series",
					"Data leakage patterns: target leakage, train/test contamination, temporal leakage in time-ordered data",
					"Feature selection: correlation filtering, mutual information, recursive feature elimination",
					"Interaction and polynomial features — when they help vs. when they just add noise",
					"Ties directly to the Math & Statistics sheet\u2019s correlation section and to Clustering\u2019s preprocessing steps",
				],
			},
		],
	},
	{
		key: "dsa",
		label: "Data Structures & Algorithms",
		items: [
			{
				id: "dsa-time-space",
				customizedComponent: false,
				name: "Time & Space Complexity",
				file: "DSA_Time_Space_Complexity.md",
				status: "planned",
				tagline:
					"Big-O and the complexity classes every other topic here assumes",
				covers:
					"The foundation everything else in this category assumes — how to read and derive Big-O for time and space, the difference between average and worst case, and amortized analysis for structures like dynamic arrays.",
				fixes: [],
				extend: [
					"Big-O, Big-\u0398, Big-\u03a9 — what each actually claims, not just Big-O as a catch-all",
					"Common complexity classes ranked (O(1) \u2192 O(log n) \u2192 O(n) \u2192 O(n log n) \u2192 O(n\u00b2) \u2192 O(2^n)) with a concrete example of each",
					"How to derive complexity from nested loops, recursion (recurrence relations), and built-in operations",
					"Amortized analysis — why list.append() is O(1) amortized despite occasional resizing",
					"Space complexity: auxiliary space vs. total space, recursion stack depth counted as space",
					"A quick-reference table of Python built-in operation complexities (list/dict/set operations)",
				],
			},
			{
				id: "dsa-hashmaps",
				customizedComponent: false,
				name: "Hashmaps / Sets",
				file: "DSA_Hashmaps_Sets.md",
				status: "planned",
				tagline: "Hash-based lookup — trading space for O(1) average time",
				covers:
					"How Python\u2019s dict and set actually work under the hood, and the pattern — trade space for time via O(1) average lookup — that solves more interview and real-world problems than any other single trick.",
				fixes: [],
				extend: [
					"How hashing works: hash function, buckets, collision resolution (open addressing in CPython)",
					"Average O(1) vs. worst-case O(n) — when hash collisions actually matter",
					"Core patterns: frequency counting, two-sum via complement lookup, grouping/bucketing, deduplication",
					"dict vs. defaultdict vs. Counter — when each saves real code",
					"Set operations (union, intersection, difference) and when they beat manual loops",
					"What\u2019s hashable in Python and why — the tuple-vs-list gotcha",
				],
			},
			{
				id: "dsa-two-pointers",
				customizedComponent: false,
				name: "Two Pointers",
				file: "DSA_Two_Pointers.md",
				status: "planned",
				tagline: "Two indices moving through a sequence to avoid nested loops",
				covers:
					"Collapsing an O(n\u00b2) nested-loop scan into O(n) by moving two pointers through sorted or structured data — one of the most common ways an interview question\u2019s brute force gets optimized.",
				fixes: [],
				extend: [
					"Opposite-direction pointers: pair-sum on a sorted array, palindrome checking, container-with-most-water style problems",
					"Same-direction pointers (fast/slow): cycle detection, removing duplicates in place, partitioning",
					"When the array needs sorting first, and whether that sort cost changes the overall complexity",
					"Three-pointer extension: 3Sum and similar problems",
					"Common bugs: off-by-one boundary conditions, forgetting to skip duplicates",
				],
			},
			{
				id: "dsa-stacks",
				customizedComponent: false,
				name: "Stacks",
				file: "DSA_Stacks.md",
				status: "planned",
				tagline:
					"LIFO structure for matching, backtracking state, and monotonic sequences",
				covers:
					"The structure behind parenthesis matching, undo functionality, and — as a monotonic stack — a non-obvious O(n) trick for next-greater-element style problems that look like they need O(n\u00b2) at first glance.",
				fixes: [],
				extend: [
					"Core operations in Python: list as a stack (append/pop), when to use collections.deque instead",
					"Classic use cases: balanced parentheses/brackets, expression evaluation (infix \u2192 postfix), undo/redo",
					"Monotonic stack pattern: next greater/smaller element, daily-temperatures-style problems, largest rectangle in histogram",
					"Call stack connection: how recursion is implicitly a stack, and why deep recursion hits Python\u2019s recursion limit",
					'Stack vs. queue — when a problem\u2019s "process most-recent-first" framing signals a stack',
				],
			},
			{
				id: "dsa-linked-list",
				customizedComponent: false,
				name: "Linked List",
				file: "DSA_Linked_List.md",
				status: "planned",
				tagline: "Pointer-based sequences — reversal, cycle detection, merging",
				covers:
					"Singly and doubly linked lists in Python (there\u2019s no built-in — you\u2019re always implementing the node class yourself), and the pointer-manipulation patterns that show up constantly: reversal, cycle detection, merging.",
				fixes: [],
				extend: [
					"Node class implementation, singly vs. doubly linked, with/without a tail pointer",
					"Core operations and their real complexity: insert/delete at head vs. tail vs. middle",
					"Reversal — iterative and recursive, and why it\u2019s the most-asked linked list operation",
					"Fast/slow pointer (Floyd\u2019s) for cycle detection and finding the middle node in one pass",
					"Merging two sorted lists, and the dummy-head-node trick that simplifies edge cases",
					"When a Python list or collections.deque is just the better real-world choice over a hand-rolled linked list",
				],
			},
			{
				id: "dsa-binary-search",
				customizedComponent: false,
				name: "Binary Search",
				file: "DSA_Binary_Search.md",
				status: "planned",
				tagline:
					'O(log n) search, and the problem shapes that aren\u2019t obviously "search a sorted array"',
				covers:
					"Binary search on an explicit sorted array, plus the less obvious variant — binary search on an answer/value space — that turns some optimization problems into a search problem in disguise.",
				fixes: [],
				extend: [
					"The standard implementation, and the off-by-one bugs (mid calculation, inclusive vs. exclusive bounds) that cause most failures",
					"Finding first/last occurrence, insertion point (Python\u2019s own bisect module)",
					"Binary search on rotated sorted arrays",
					'Binary search on the answer: minimizing/maximizing a value where "can we achieve X?" is monotonic',
					"Python\u2019s bisect_left/bisect_right and when to reach for them instead of hand-rolling",
				],
			},
			{
				id: "dsa-sliding-window",
				customizedComponent: false,
				name: "Sliding Window",
				file: "DSA_Sliding_Window.md",
				status: "planned",
				tagline:
					"A contiguous window that grows and shrinks to avoid re-scanning",
				covers:
					"Fixed-size and variable-size window patterns for subarray/substring problems — turning an O(n\u00b2) or O(n\u00b3) brute-force scan of every subarray into a single O(n) pass.",
				fixes: [],
				extend: [
					"Fixed-size window: running sum/average, max in every window of size k",
					'Variable-size window: expand-then-shrink pattern for "smallest subarray with sum \u2265 X" or "longest substring without repeating characters"',
					"What state to track in the window (running sum, frequency dict, condition count) and when to shrink",
					"Relationship to two pointers — sliding window is really two same-direction pointers with window-state bookkeeping",
					"Common bugs: shrinking condition checked in the wrong place, off-by-one on window boundaries",
				],
			},
			{
				id: "dsa-trees",
				customizedComponent: false,
				name: "Trees",
				file: "DSA_Trees.md",
				status: "planned",
				tagline:
					"Hierarchical structures — traversal orders, BSTs, and the recursion template behind both",
				covers:
					"Binary trees and binary search trees: the four traversal orders and what each is actually useful for, BST invariants and operations, and the recursive template that solves most tree problems with small variations.",
				fixes: [],
				extend: [
					"Traversals: preorder/inorder/postorder (recursive and iterative with an explicit stack), and level-order (BFS with a queue)",
					"Binary search tree invariant, insert/search/delete, and why deletion is the fiddly one (three cases)",
					'Height/depth/balance — what "balanced" means and why it matters for guaranteed O(log n) operations',
					"Common problems: validate a BST, lowest common ancestor, tree diameter, serialize/deserialize",
					"The general recursive template (base case + combine results from left/right) most tree problems are a variation of",
					"Where this connects to the DAG-based orchestration topic already covered in Data Engineering Patterns",
				],
			},
			{
				id: "dsa-heaps",
				customizedComponent: false,
				name: "Heaps",
				file: "DSA_Heaps.md",
				status: "planned",
				tagline:
					"Priority queues — always-O(log n) access to the min or max element",
				covers:
					"Binary heaps as arrays, Python\u2019s heapq module (min-heap only — and the negation trick for a max-heap), and the top-k / running-median / merge-k-streams problems this structure is built for.",
				fixes: [],
				extend: [
					"Array-based binary heap representation: parent/child index math, why it needs no pointers",
					"Python\u2019s heapq: heappush/heappop, heapify, and the classic max-heap negation trick",
					'Top-k pattern: maintaining a heap of size k for "k largest/smallest" without sorting the whole dataset',
					"Running median with two heaps (max-heap for the lower half, min-heap for the upper half)",
					"Merging k sorted streams/lists — directly relevant to merging sorted partitions from a distributed job",
					"heapq.nlargest/nsmallest vs. hand-rolling — when the built-in already does the job",
				],
			},
			{
				id: "dsa-backtracking",
				customizedComponent: false,
				name: "Recursive Backtracking",
				file: "DSA_Recursive_Backtracking.md",
				status: "planned",
				tagline:
					"Choose, explore, undo — for permutations, combinations, and constraint search",
				covers:
					"The choose \u2192 explore \u2192 unchoose template behind permutations, combinations, subsets, and constraint-satisfaction problems, plus the pruning that keeps a naive exponential search from being wasteful.",
				fixes: [],
				extend: [
					"The core template: make a choice, recurse, undo the choice before trying the next option",
					"Classic problems: subsets, permutations, combinations, N-Queens, Sudoku solving",
					"Pruning: cutting a branch early once it can\u2019t possibly lead to a valid answer — matters more than the template itself for real performance",
					"Recursion depth and Python\u2019s default recursion limit — when backtracking needs an explicit stack instead",
					"Difference from plain recursion/DP: backtracking explicitly explores and undoes state; DP caches to avoid re-exploring",
				],
			},
			{
				id: "dsa-graphs",
				customizedComponent: false,
				name: "Graphs",
				file: "DSA_Graphs.md",
				status: "planned",
				tagline: "Traversal, shortest paths, and topological ordering",
				covers:
					"Graph representations (adjacency list vs. matrix), the two core traversals (BFS/DFS) and what each is suited for, and topological sort — the algorithm underneath every DAG-based orchestrator already covered elsewhere in this index.",
				fixes: [],
				extend: [
					"Representations: adjacency list vs. adjacency matrix, and when each makes sense (sparse vs. dense graphs)",
					"BFS vs. DFS: shortest path in unweighted graphs (BFS) vs. connectivity/cycle detection/backtracking-adjacent problems (DFS)",
					"Topological sort (Kahn\u2019s algorithm and DFS-based) — the literal algorithm behind DAG task ordering in Airflow/Step Functions/any orchestrator in this index",
					"Shortest path algorithms: Dijkstra for weighted non-negative graphs, and when Bellman-Ford is needed instead",
					"Union-Find (disjoint set) for connectivity and cycle detection — often paired with graph problems",
					"Cycle detection specifically, since a cyclic dependency graph is exactly the bug topological sort exists to catch",
				],
			},
		],
	},
	{
		key: "eng",
		label: "Engineering fundamentals",
		items: [
			{
				id: "depatterns",
				customizedComponent: true,
				name: "Data Engineering Patterns",
				file: "Data_Engineering_Patterns.md",
				status: "planned",
				tagline:
					"Architectural and pipeline-design patterns, independent of any specific tool",
				covers:
					"The recurring architectural decisions that show up regardless of stack — batch vs. streaming, how to structure a medallion/layered warehouse, how to handle late-arriving data, and how to keep pipelines idempotent and re-runnable.",
				fixes: [],
				extend: [
					"Batch vs. micro-batch vs. streaming — decision factors, not just definitions",
					"Medallion architecture (bronze/silver/gold) and other layering schemes (staging/core/mart)",
					"Idempotency and exactly-once vs. at-least-once processing",
					"Slowly changing dimensions (Type 1/2/3) with concrete examples",
					"CDC patterns: log-based, query-based, trigger-based",
					"Backfill and reprocessing strategies",
					"Data quality gates and circuit-breaker patterns for pipelines",
					"Orchestration patterns: DAG dependency design, fan-out/fan-in, sensor/poke patterns",
					"Schema evolution handling (additive vs. breaking changes)",
				],
			},
			{
				id: "etl",
				customizedComponent: false,
				name: "ETL",
				file: "ETL.md",
				status: "planned",
				tagline:
					"Extract/Load/Transform mechanics, independent of any one tool",
				covers:
					"The nuts and bolts of moving data reliably: extraction strategies (full vs. incremental vs. CDC), staging conventions, transformation ordering, and the error-handling and observability practices that separate a pipeline that runs once from one that runs every night without you watching it.",
				fixes: [],
				extend: [
					"Full load vs. incremental load vs. CDC — when each applies",
					"Staging layer conventions (raw/landing zone, naming, partitioning by ingestion date)",
					"Extraction patterns: pagination, rate-limit handling, watermarking for incremental pulls",
					"Transformation ordering: ELT vs. ETL tradeoffs, pushdown to the warehouse",
					"Load strategies: upsert/merge patterns, truncate-and-load vs. append-only",
					"Error handling: dead-letter patterns, partial-failure recovery, retries with backoff",
					"Data validation checkpoints (row counts, null checks, referential checks between stages)",
					"Observability: logging conventions, run metadata tables, alerting thresholds",
				],
			},
			{
				id: "fastapi",
				customizedComponent: false,
				name: "FastAPI",
				file: "FastAPI_Cheatsheet.md",
				status: "planned",
				tagline:
					"Modern Python APIs with async endpoints, validation, and dependency injection",
				covers:
					"FastAPI fundamentals for building production-ready Python APIs: routing, request and response models, validation with Pydantic, dependency injection, async database access, authentication, error handling, testing, and deployment.",
				fixes: [],
				extend: [
					"Path, query, header, cookie, and form parameters",
					"Pydantic models, field validators, serialization, and response_model usage",
					"Dependency injection for database sessions, authentication, and shared request context",
					"Async SQLAlchemy integration and transaction handling",
					"OAuth2/JWT authentication, permissions, and CORS",
					"Background tasks, middleware, lifespan events, and WebSockets",
					"Testing with TestClient/httpx and dependency overrides",
					"Containerized deployment with Uvicorn/Gunicorn and configuration via environment variables",
				],
			},
			{
				id: "regex",
				customizedComponent: false,
				name: "Regex",
				file: "Regex.md",
				status: "planned",
				tagline:
					"Pattern syntax for text parsing, validation, and log/data cleaning",
				covers:
					"A cross-language regex reference — the syntax and patterns that come up constantly in data cleaning, log parsing, and validation, with worked examples in Python\u2019s re module plus the flavor differences that trip people up moving between grep/sed, SQL, and JavaScript.",
				fixes: [],
				extend: [
					"Core syntax: anchors, character classes, quantifiers (greedy vs. lazy), groups vs. non-capturing groups",
					"Lookahead/lookbehind — positive and negative, with a plain-language explanation of when each is actually needed",
					"Backreferences and named groups",
					"Common recipes: email/URL/phone validation, IP matching, extracting fields from unstructured log lines",
					"Python\u2019s re module specifics: re.sub with function replacements, re.finditer vs. re.findall, compiled patterns for performance",
					"Flavor differences: POSIX (grep/sed/awk) vs. PCRE (Python/JS) vs. SQL REGEXP dialects — MySQL/PostgreSQL/Snowflake all differ slightly",
					"Catastrophic backtracking — what causes it and how to spot a pattern that will hang on real data",
					'A "test before you ship" note pointing at a regex tester, since silent partial-matches are the most common regex bug',
				],
			},
			{
				id: "datamodeling",
				customizedComponent: false,
				name: "Data Modeling",
				file: "Data_Modeling.md",
				status: "planned",
				tagline:
					"Star schema, fact/dimension design, and SCDs as their own reference",
				covers:
					"Dimensional modeling as a first-class topic rather than something scattered across the warehouse-specific sheets: when to use a star vs. snowflake schema, how to actually design fact and dimension tables, and grain — the single most-skipped step that causes the most downstream pain.",
				fixes: [],
				extend: [
					"Star schema vs. snowflake schema — tradeoffs, not just diagrams",
					"Fact table types: transaction, periodic snapshot, accumulating snapshot",
					"Dimension design: conformed dimensions, junk dimensions, degenerate dimensions",
					"Grain — defining it explicitly before building anything, and the symptoms of getting it wrong",
					"Slowly changing dimensions (Type 0\u20136) with concrete before/after row examples, not just the theory already in Data Engineering Patterns",
					"Bridge tables for many-to-many relationships",
					"Kimball vs. Inmon vs. Data Vault — a short honest comparison, not a religious war",
					"Naming conventions and a checklist for reviewing a new model before it ships",
				],
			},
		],
	},
	{
		key: "designpatterns",
		label: "Design Patterns",
		slug: "design-patterns",
		subcategories: [
			{
				key: "creational",
				label: "Creational",
				slug: "creational",
				status: "planned",
				tagline:
					"Patterns for object creation — decoupling instantiation from usage",
				covers:
					"The five creational patterns, covering the cases where construction logic itself needs to be abstracted away from the calling code — connection pooling, loader/parser selection by file type, and configuration-driven object construction all lean on this family.",
				items: [
					{
						id: "dp-singleton",
						customizedComponent: false,
						name: "Singleton",
						slug: "singleton",
						status: "planned",
						tagline:
							"Ensure a class has only one instance, with global access to it",
						covers:
							"One instance shared across the app — the classic (and classically overused) pattern for things like a single database connection pool or a shared configuration object.",
						fixes: [],
						extend: [
							"Intent & structure: private-constructor equivalent, static instance accessor",
							"Python implementations: module-level instance (the idiomatic Python singleton), metaclass-based, or __new__ override",
							"Why singletons are risky in threaded/distributed pipeline code — race conditions on first access, hidden global state",
							"Real use case: a shared connection pool or logger instance",
							"When a plain module-level object beats a formal Singleton class",
						],
					},
					{
						id: "dp-factory-method",
						customizedComponent: false,
						name: "Factory Method",
						slug: "factory-method",
						status: "planned",
						tagline: "Defer object instantiation to subclasses",
						covers:
							"Lets a base class define the shape of creation while subclasses decide what gets created — the pattern behind picking the right loader class based on file type or source system.",
						fixes: [],
						extend: [
							"Intent & structure: creator abstract method vs. concrete creators",
							"Python idiom: a dict-of-callables or dispatch table often replaces the class hierarchy entirely",
							"Data engineering example: choosing a Parquet/CSV/JSON loader class based on file extension",
							"Difference from Abstract Factory (families of objects) — commonly confused",
						],
					},
					{
						id: "dp-abstract-factory",
						customizedComponent: false,
						name: "Abstract Factory",
						slug: "abstract-factory",
						status: "planned",
						tagline:
							"Produce families of related objects without specifying concrete classes",
						covers:
							"One level up from Factory Method — a factory that returns a whole family of related objects, useful when swapping an entire backend (e.g. all the readers/writers for one cloud provider) as a unit.",
						fixes: [],
						extend: [
							"Intent & structure: abstract factory interface, concrete factories per family",
							"Data engineering example: an S3 factory vs. a GCS factory producing matched reader/writer/lister objects per cloud",
							"Tradeoff: adds real complexity — worth it only when families genuinely vary together",
							"Python idiom: often just a factory function returning a namedtuple/dataclass of components",
						],
					},
					{
						id: "dp-builder",
						customizedComponent: false,
						name: "Builder",
						slug: "builder",
						status: "planned",
						tagline:
							"Separate the construction of a complex object from its representation",
						covers:
							"For objects with many optional parameters or a multi-step construction process — a common fit for building complex SQL queries or pipeline configuration objects step by step.",
						fixes: [],
						extend: [
							"Intent & structure: builder interface, optional director, fluent chaining",
							"Python idiom: dataclasses with sensible defaults, or a fluent-chain query builder (think SQLAlchemy\u2019s own query construction)",
							"Data engineering example: constructing a multi-clause SQL query or a Spark job config incrementally",
							'When Builder is overkill — Python\u2019s keyword arguments already solve most of the "too many constructor params" problem',
						],
					},
					{
						id: "dp-prototype",
						customizedComponent: false,
						name: "Prototype",
						slug: "prototype",
						status: "planned",
						tagline: "Create new objects by copying an existing instance",
						covers:
							"Cloning an existing, pre-configured object instead of building from scratch — useful for spinning up variations of an expensive-to-construct config object.",
						fixes: [],
						extend: [
							"Intent & structure: clone method, shallow vs. deep copy",
							"Python idiom: copy.deepcopy / copy.copy, or dataclasses.replace() for immutable-style cloning",
							"Data engineering example: cloning a base pipeline config and overriding a few parameters per environment (dev/staging/prod)",
							"Gotcha: shallow copies silently sharing mutable nested state — a classic source of bugs",
						],
					},
				],
			},
			{
				key: "structural",
				label: "Structural",
				slug: "structural",
				status: "planned",
				tagline:
					"Patterns for composing objects and classes into larger structures",
				covers:
					"The seven structural patterns — mostly about making incompatible interfaces work together (Adapter), or building flexible object graphs without deep inheritance trees (Composite, Decorator, Proxy). This is the family most data engineers already use without naming it, e.g. wrapping vendor SDKs.",
				items: [
					{
						id: "dp-adapter",
						customizedComponent: false,
						name: "Adapter",
						slug: "adapter",
						status: "planned",
						tagline: "Convert one interface into another that a client expects",
						covers:
							"The pattern data engineers use constantly without naming it — wrapping an inconsistent vendor SDK or legacy API behind a uniform interface your pipeline code actually wants to call.",
						fixes: [],
						extend: [
							"Intent & structure: target interface, adaptee, adapter wrapping the adaptee",
							"Data engineering example: a uniform read()/write() interface wrapping boto3, google-cloud-storage, and azure-storage-blob SDKs",
							"Object adapter (composition) vs. class adapter (inheritance) — Python favors composition",
							"Related: Facade simplifies a subsystem; Adapter translates one interface into another",
						],
					},
					{
						id: "dp-bridge",
						customizedComponent: false,
						name: "Bridge",
						slug: "bridge",
						status: "planned",
						tagline:
							"Decouple an abstraction from its implementation so both can vary independently",
						covers:
							"Splits a class hierarchy along two independent dimensions — useful when you have both multiple notification types and multiple delivery channels, and don\u2019t want a class for every combination.",
						fixes: [],
						extend: [
							"Intent & structure: abstraction holds a reference to an implementor interface",
							"Data engineering example: a Notifier abstraction (alert, digest) bridged to delivery implementors (email, Slack, PagerDuty) without a subclass per combination",
							"Difference from Adapter: Bridge is designed upfront for variation; Adapter retrofits an existing interface",
							"When it\u2019s premature: don\u2019t reach for Bridge until a second dimension of variation is actually real",
						],
					},
					{
						id: "dp-composite",
						customizedComponent: false,
						name: "Composite",
						slug: "composite",
						status: "planned",
						tagline:
							"Compose objects into tree structures and treat individual objects and compositions uniformly",
						covers:
							"For anything naturally tree-shaped — a DAG of pipeline tasks, or nested transformation steps — where a single node and a group of nodes should support the same interface.",
						fixes: [],
						extend: [
							"Intent & structure: component interface, leaf, composite (holds children)",
							"Data engineering example: a pipeline step that\u2019s either a single task or a sub-DAG of tasks, both exposing the same run() method",
							"Where this shows up implicitly: Airflow TaskGroups are a Composite in practice",
							"Gotcha: uniform interfaces can leak — not every operation makes sense on both leaves and composites",
						],
					},
					{
						id: "dp-decorator",
						customizedComponent: false,
						name: "Decorator",
						slug: "decorator",
						status: "planned",
						tagline:
							"Attach additional responsibilities to an object dynamically",
						covers:
							"Wrapping behavior — retries, logging, caching, timing — around a function or object without modifying its code. The pattern Python\u2019s own @decorator syntax is named after.",
						fixes: [],
						extend: [
							"Intent & structure: component interface, concrete component, decorators wrapping the component",
							"Python idiom: this is Python\u2019s actual @decorator syntax — functools.wraps, stacking multiple decorators, decorator factories with arguments",
							"Data engineering example: @retry, @log_duration, @cache wrapping an extract() or load() function",
							"Order-of-application gotcha: decorator stacking order changes behavior and is a common source of bugs",
						],
					},
					{
						id: "dp-facade",
						customizedComponent: false,
						name: "Facade",
						slug: "facade",
						status: "planned",
						tagline: "Provide a simplified interface to a complex subsystem",
						covers:
							"One clean entry point in front of a multi-step process — hiding the extract/validate/transform/load orchestration behind a single run_pipeline() call.",
						fixes: [],
						extend: [
							"Intent & structure: facade class delegating to subsystem classes/functions",
							"Data engineering example: a single ETLPipeline.run() facade hiding extraction, validation, transformation, and loading calls",
							"Difference from Adapter: Facade simplifies a multi-class subsystem; Adapter translates one interface to another",
							"Where it overlaps with Template Method — Facade can be a thin wrapper around a Template Method implementation",
						],
					},
					{
						id: "dp-flyweight",
						customizedComponent: false,
						name: "Flyweight",
						slug: "flyweight",
						status: "planned",
						tagline:
							"Share common state across many objects to reduce memory footprint",
						covers:
							"For when you\u2019re instantiating a huge number of small, mostly-identical objects — separating shared (intrinsic) state from per-instance (extrinsic) state to keep memory bounded.",
						fixes: [],
						extend: [
							"Intent & structure: flyweight factory, intrinsic vs. extrinsic state",
							"Data engineering example: interning repeated categorical string values instead of allocating a new string object per row — something pandas\u2019 category dtype and Arrow dictionary encoding already do under the hood",
							"The realistic take: in Python this pattern is rarely hand-rolled — more useful to recognize where a library is already doing it for you",
							"When it\u2019s worth implementing manually: very large in-memory object graphs where profiling shows real memory pressure",
						],
					},
					{
						id: "dp-proxy",
						customizedComponent: false,
						name: "Proxy",
						slug: "proxy",
						status: "planned",
						tagline:
							"Provide a stand-in for another object to control access to it",
						covers:
							"A wrapper that controls access to the real object — lazy-loading an expensive resource, caching results, or adding an access-control check before a real call goes through.",
						fixes: [],
						extend: [
							"Intent & structure: subject interface, real subject, proxy holding a reference to the real subject",
							"Variants: virtual proxy (lazy init), protection proxy (access control), caching proxy, remote proxy",
							"Data engineering example: a lazy-loading proxy around a large reference dataset that only hits the database on first access",
							"Difference from Decorator: Proxy controls access; Decorator adds behavior — structurally similar, intent differs",
						],
					},
				],
			},
			{
				key: "behavioural",
				label: "Behavioural",
				slug: "behavioural",
				status: "planned",
				tagline:
					"Patterns for communication and responsibility between objects",
				covers:
					"The eight behavioural patterns covering how objects interact and delegate work — Observer and State show up constantly in event-driven pipelines and job-status tracking; Chain of Responsibility maps directly onto validation/processing pipelines.",
				items: [
					{
						id: "dp-chain-of-responsibility",
						customizedComponent: false,
						name: "Chain of Responsibility",
						slug: "chain-of-responsibility",
						status: "planned",
						tagline:
							"Pass a request along a chain of handlers until one handles it",
						covers:
							"Maps directly onto validation and processing pipelines — each handler checks/transforms a record and either handles it or passes it to the next stage.",
						fixes: [],
						extend: [
							"Intent & structure: handler interface with a reference to the next handler",
							"Data engineering example: a validation chain — schema check \u2192 null check \u2192 range check \u2192 referential check, each stage able to short-circuit",
							"Python idiom: often just a list of validator functions run in sequence, no formal class chain needed",
							"Related: Decorator wraps one thing; Chain passes through a sequence of independent handlers",
						],
					},
					{
						id: "dp-command",
						customizedComponent: false,
						name: "Command",
						slug: "command",
						status: "planned",
						tagline:
							"Encapsulate a request as an object, allowing queuing, logging, and undo",
						covers:
							"Turns an action into a first-class object that can be queued, retried, logged, or replayed — the pattern behind task queues and replayable pipeline steps.",
						fixes: [],
						extend: [
							"Intent & structure: command interface with execute() (and optionally undo())",
							"Data engineering example: a task queue where each queued job is a Command object with its own retry/execute logic",
							"Python idiom: functools.partial or a simple callable often replaces a full Command class hierarchy",
							"Where it shows up: Airflow operators and Celery tasks are effectively Command objects",
						],
					},
					{
						id: "dp-interpreter",
						customizedComponent: false,
						name: "Interpreter",
						slug: "interpreter",
						status: "planned",
						tagline:
							"Define a grammar and an interpreter for a simple language",
						covers:
							"For building a small expression language — like a rules engine for data validation or a DSL for transformation logic — rather than hardcoding every rule in Python.",
						fixes: [],
						extend: [
							"Intent & structure: abstract expression, terminal vs. non-terminal expressions, a context",
							'Data engineering example: a small rule-expression language for data quality checks (e.g. "column_x > 0 AND column_y IS NOT NULL") parsed into an evaluable tree',
							"The honest caveat: hand-rolling a real Interpreter is rare in practice — most teams reach for an existing expression/filter DSL instead of building one",
							"When it\u2019s worth it: only when the ruleset needs to be data-driven/user-editable at runtime, not just Python conditionals",
						],
					},
					{
						id: "dp-iterator",
						customizedComponent: false,
						name: "Iterator",
						slug: "iterator",
						status: "planned",
						tagline:
							"Access elements of a collection sequentially without exposing its structure",
						covers:
							"Python\u2019s own iteration protocol is this pattern made native — relevant here mainly for building custom iterators over paginated APIs or chunked file reads.",
						fixes: [],
						extend: [
							"Intent & structure: iterator interface with next()/has_next() — Python\u2019s __iter__/__next__ protocol IS this pattern",
							"Python idiom: generator functions (yield) as the idiomatic Iterator implementation — almost always preferred over a hand-rolled class",
							"Data engineering example: a generator that pages through a REST API\u2019s cursor-based pagination, yielding one batch at a time without loading everything into memory",
							"Related: this is the pattern underneath Python\u2019s own for loops, worth naming even though you rarely implement it by hand",
						],
					},
					{
						id: "dp-mediator",
						customizedComponent: false,
						name: "Mediator",
						slug: "mediator",
						status: "planned",
						tagline:
							"Define an object that encapsulates how a set of objects interact",
						covers:
							"Centralizes communication between components that would otherwise all reference each other directly — an orchestrator that coordinates several independent pipeline stages without those stages knowing about each other.",
						fixes: [],
						extend: [
							"Intent & structure: mediator interface, colleague objects that only talk to the mediator, not each other",
							"Data engineering example: an orchestrator (functionally what Airflow/Step Functions/a DAG scheduler already is) coordinating extract/transform/load stages that don\u2019t call each other directly",
							"Difference from Facade: Mediator manages ongoing bidirectional communication; Facade just simplifies a one-way call",
							"The realistic take: most teams get this pattern for free by using an orchestration tool rather than hand-rolling one",
						],
					},
					{
						id: "dp-memento",
						customizedComponent: false,
						name: "Memento",
						slug: "memento",
						status: "planned",
						tagline:
							"Capture and externalize an object\u2019s internal state to restore it later",
						covers:
							"Snapshotting state for rollback — directly relevant to checkpointing a long-running job so it can resume from the last good point instead of restarting from scratch.",
						fixes: [],
						extend: [
							"Intent & structure: originator (creates/restores from snapshots), memento (the snapshot), caretaker (holds mementos)",
							"Data engineering example: a pipeline checkpoint file capturing the last successfully processed offset/watermark, used to resume after a failure",
							"Python idiom: often just a serialized dict/JSON checkpoint file — the full three-class pattern is rarely needed",
							"Related: this is the conceptual backbone of watermarking/checkpointing already covered in the ETL and Data Engineering Patterns sheets",
						],
					},
					{
						id: "dp-observer",
						customizedComponent: false,
						name: "Observer",
						slug: "observer",
						status: "planned",
						tagline:
							"Notify dependents automatically when one object changes state",
						covers:
							"The event-driven backbone — job-status changes, S3 event notifications, and pub/sub triggers are all Observer in practice, whether or not the code names it that.",
						fixes: [],
						extend: [
							"Intent & structure: subject (maintains observer list, notifies on change), observer interface with an update() method",
							"Data engineering example: a pipeline-status subject notifying logging, alerting, and metrics-collection observers on every state transition, without those observers being hardcoded into the pipeline logic",
							"Where it\u2019s already provided for you: S3 Event Notifications, SNS/SQS, and Kafka consumer groups are all Observer at the infrastructure level",
							"Python idiom: a simple list of callback functions usually replaces a formal Observer class hierarchy",
						],
					},
					{
						id: "dp-state",
						customizedComponent: false,
						name: "State",
						slug: "state",
						status: "planned",
						tagline:
							"Let an object alter its behavior when its internal state changes",
						covers:
							"For objects whose behavior genuinely changes shape by state — a job that behaves differently in Pending/Running/Failed/Succeeded states — instead of one method riddled with if-status branches.",
						fixes: [],
						extend: [
							"Intent & structure: context object holding a reference to a current state object, state interface with behavior that varies per concrete state",
							"Data engineering example: a pipeline run object whose retry()/notify() behavior differs by current state, replacing a method full of if status == ... branches",
							"Python idiom: an Enum plus a dict-of-handlers-per-state often gets 90% of the benefit without a full class-per-state hierarchy",
							"Related: State vs. Strategy — structurally identical, but State changes itself based on internal transitions while Strategy is chosen externally by the client",
						],
					},
				],
			},
		],
	},
	{
		key: "aws",
		label: "AWS for data engineering",
		items: [
			{
				id: "s3",
				customizedComponent: false,
				name: "Amazon S3",
				file: "AWS_S3.md",
				status: "planned",
				tagline: "Object storage as the data lake foundation",
				covers:
					"S3 as the landing zone and data lake backbone: bucket/prefix conventions for a lake, storage classes and lifecycle transitions, event notifications for triggering downstream jobs, and the access-pattern gotchas that affect cost and performance at scale.",
				fixes: [],
				extend: [
					"Bucket/prefix design for a lake (partitioning by date, Hive-style partitioning for Athena/Glue)",
					"Storage classes and lifecycle policies (Standard \u2192 IA \u2192 Glacier) and when auto-transition makes sense",
					"S3 Event Notifications \u2192 Lambda/SQS/SNS for event-driven pipelines",
					"Multipart upload and transfer acceleration for large files",
					"Consistency model and its practical implications for pipeline design",
					'Cost gotchas: request pricing on many small files, the "small files problem" for downstream query engines',
					"Access control: bucket policies vs. IAM policies vs. ACLs, S3 Access Points",
				],
			},
			{
				id: "glue",
				customizedComponent: false,
				name: "AWS Glue",
				file: "AWS_Glue.md",
				status: "planned",
				tagline: "Serverless ETL, Data Catalog, and crawlers",
				covers:
					"Glue as both a Spark-based ETL runtime and the shared Data Catalog that Athena, Redshift Spectrum, and EMR all read from — job types, crawler behavior and its rough edges, and when Glue is the right choice versus a self-managed Spark cluster.",
				fixes: [],
				extend: [
					"Glue Data Catalog as the shared metastore (how Athena/Redshift Spectrum/EMR all reference it)",
					"Crawlers: schema inference behavior, and where it gets partition/type detection wrong",
					"Glue Jobs: Spark vs. Python Shell vs. Ray job types, DPU sizing",
					"Glue Studio visual ETL vs. hand-written PySpark scripts",
					"Bookmarks for incremental processing between runs",
					"Glue Workflows for multi-job orchestration (vs. reaching for Step Functions)",
					"Cost model and cold-start latency considerations",
				],
			},
			{
				id: "redshift",
				customizedComponent: false,
				name: "Amazon Redshift",
				file: "AWS_Redshift.md",
				status: "planned",
				tagline:
					"The AWS data warehouse — distribution styles, sort keys, Spectrum",
				covers:
					"Redshift\u2019s specific performance model: how distribution and sort keys actually affect query plans, when to reach for Redshift Spectrum instead of loading data in, and the maintenance tasks (VACUUM, ANALYZE) that Redshift needs that other warehouses handle automatically.",
				fixes: [],
				extend: [
					"Distribution styles (KEY/ALL/EVEN) and how a bad choice causes broadcast/shuffle cost",
					"Sort keys (compound vs. interleaved) and their effect on zone maps",
					"COPY command patterns for bulk loading from S3, and common failure modes",
					"Redshift Spectrum for querying data still in S3 without loading it",
					"VACUUM and ANALYZE — why Redshift needs manual maintenance unlike Snowflake/BigQuery",
					"Workload management (WLM) queues and concurrency scaling",
					"RA3 nodes and managed storage vs. the older dense-storage node types",
				],
			},
			{
				id: "emr",
				customizedComponent: false,
				name: "Amazon EMR",
				file: "AWS_EMR.md",
				status: "planned",
				tagline:
					"Managed Hadoop/Spark clusters for when Glue\u2019s limits don\u2019t fit",
				covers:
					"EMR as the option when Glue\u2019s constraints don\u2019t fit — full cluster control, non-Spark frameworks (Hive, Presto/Trino, Flink), and the cost/complexity tradeoffs of managing cluster lifecycle yourself.",
				fixes: [],
				extend: [
					"EMR vs. Glue decision factors (cluster control, framework choice, long-running vs. job-based)",
					"Cluster provisioning: instance fleets vs. uniform instance groups, spot instance strategies for cost",
					"EMR Serverless as the newer middle ground between Glue and self-managed clusters",
					"Step submission and cluster auto-termination patterns",
					"EMRFS and S3 consistency considerations",
					"Framework options beyond Spark: Hive, Presto/Trino, Flink, HBase",
					"Cost optimization: spot fleets, auto-scaling policies, right-sizing core vs. task nodes",
				],
			},
			{
				id: "athena",
				customizedComponent: false,
				name: "Amazon Athena",
				file: "AWS_Athena.md",
				status: "planned",
				tagline: "Serverless SQL over S3, no infrastructure to manage",
				covers:
					"Athena as a pay-per-query engine over data already in S3: how partitioning and file format choice directly control your bill, when CTAS beats a view, and the Athena-specific gotchas around small files and result caching.",
				fixes: [],
				extend: [
					"Partition projection vs. traditional Hive partitioning (and the cost/latency tradeoff)",
					"File format impact on cost: Parquet/ORC with compression vs. raw CSV/JSON",
					"CTAS (CREATE TABLE AS) for materializing expensive query results",
					"Workgroups for cost control and query result location management",
					"Federated queries to RDS/DynamoDB/other sources via Athena connectors",
					"The small-files problem and its effect on query planning time",
					"Athena vs. Redshift Spectrum vs. loading into a warehouse — when each wins",
				],
			},
			{
				id: "lambda",
				customizedComponent: false,
				name: "AWS Lambda",
				file: "AWS_Lambda.md",
				status: "planned",
				tagline:
					"Event-driven compute for glue code, triggers, and lightweight transforms",
				covers:
					"Lambda\u2019s role in a data platform: S3-event-triggered processing, lightweight transforms that don\u2019t need a full Spark job, and the constraints (timeout, memory, package size, cold starts) that decide when Lambda is the wrong tool for a data workload.",
				fixes: [],
				extend: [
					"Event sources relevant to data pipelines: S3, Kinesis, SQS, EventBridge, DynamoDB Streams",
					"Timeout (15 min max) and memory limits — where Lambda stops being viable for a job",
					"Package size limits and layers for shared dependencies (e.g. pandas/pyarrow)",
					"Cold start behavior and provisioned concurrency tradeoffs",
					"Lambda as a Step Functions task vs. as a direct event handler",
					"Error handling: DLQs, retry behavior differs by trigger type (sync vs. async vs. stream-based)",
					"Cost model and when a small always-on service beats per-invocation billing",
				],
			},
			{
				id: "kinesis",
				customizedComponent: false,
				name: "Amazon Kinesis",
				file: "AWS_Kinesis.md",
				status: "planned",
				tagline:
					"Managed streaming — Data Streams, Firehose, and Analytics compared",
				covers:
					"The three Kinesis services and when each fits: Data Streams for custom stream processing, Firehose for simple load-to-S3/Redshift delivery, and Analytics for SQL/Flink over a stream — plus shard math and the consumer patterns that avoid throttling.",
				fixes: [],
				extend: [
					"Data Streams vs. Firehose vs. Managed Service for Apache Flink — decision table",
					"Shard capacity math (1MB/s in, 2MB/s out per shard) and resharding strategies",
					"Producer patterns: PutRecord vs. PutRecords batching, Kinesis Producer Library",
					"Consumer patterns: enhanced fan-out vs. shared throughput, KCL checkpointing",
					"Firehose buffering (size/time) and its effect on S3 file sizes downstream",
					"Kinesis vs. Kafka/MSK — when managed simplicity is worth the tradeoffs",
					"Error handling and replay: retention period, DLQ patterns for failed records",
				],
			},
			{
				id: "stepfunctions",
				customizedComponent: false,
				name: "AWS Step Functions",
				file: "AWS_Step_Functions.md",
				status: "planned",
				tagline:
					"Serverless orchestration — state machines for pipeline coordination",
				covers:
					"Step Functions as the AWS-native alternative to Airflow for orchestrating Glue jobs, Lambda functions, and EMR steps — state machine design patterns, error handling built into the state language itself, and where it\u2019s a better fit than MWAA.",
				fixes: [],
				extend: [
					"State types: Task, Choice, Parallel, Map — especially Map for per-file/per-partition fan-out",
					"Standard vs. Express workflows — cost and duration tradeoffs",
					"Native retry/catch syntax vs. hand-rolled retry logic in application code",
					"Common patterns: Glue job chains, Lambda orchestration, wait-for-callback (.sync/.waitForTaskToken)",
					"Step Functions vs. MWAA/Airflow — when a visual state machine beats a DAG-as-code",
					"Input/output processing: ResultPath, InputPath, parameter filtering between states",
					"Monitoring via CloudWatch and the built-in execution history UI",
				],
			},
			{
				id: "mwaa",
				customizedComponent: false,
				name: "Amazon MWAA (Managed Airflow)",
				file: "AWS_MWAA.md",
				status: "planned",
				tagline: "Managed Apache Airflow, without running your own scheduler",
				covers:
					"MWAA as Airflow without the operational overhead: environment sizing, the plugin/dependency install model that differs from self-hosted Airflow, and the patterns for triggering AWS services from a DAG.",
				fixes: [],
				extend: [
					"Environment classes and worker/scheduler sizing",
					"requirements.txt and plugins.zip deployment model — how it differs from a self-hosted Airflow install",
					"AWS-specific operators: GlueJobOperator, EmrAddStepsOperator, S3KeySensor",
					"DAG folder sync via S3 and the deploy latency that comes with it",
					"Cost model vs. self-hosted Airflow on EC2/EKS, and vs. Step Functions",
					"Connections/Variables management using Secrets Manager backend",
					"Logging to CloudWatch and common MWAA-specific debugging pain points",
				],
			},
		],
	},
];
