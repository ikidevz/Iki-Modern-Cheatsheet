"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { CustomizedComponentProps } from ".";

type Topic = {
	name: string;
	tags: string[];
	difficulty: string;
	definition: string;
	formula?: string;
	description?: string;
	example: string;
	useCases: string[];
	watchOut: string;
	code?: string;
};

const TOPICS: Topic[] = [
	{
		name: "Percentages & Proportions",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"A proportion expresses a part relative to a whole, either as a decimal (0–1) or a percentage (0–100%).",
		formula: "Percentage  = (Part / Whole) × 100\nProportion  = Part / Whole",
		description:
			"Proportions and percentages are the most fundamental building blocks of data analysis. Every rate, share, or conversion figure is fundamentally a proportion.",
		example:
			"500 purchases out of 10,000 visitors → 500 / 10,000 = 0.05 → <strong>5% conversion rate</strong>",
		useCases: [
			"Conversion rate tracking",
			"Market share analysis",
			"Funnel stage drop-off",
			"Survey response breakdowns",
		],
		watchOut:
			"Always confirm what the denominator is. '50% increase' means nothing without knowing the base.",
		code: 'import pandas as pd\n\npart, whole = 500, 10_000\nproportion = part / whole\npercentage  = proportion * 100\nprint(f"Proportion: {proportion:.4f}  |  Percentage: {percentage:.2f}%")\n\ndf = pd.DataFrame({\n    "stage": ["visited", "signed_up", "purchased"],\n    "users":  [10_000, 1_500, 500],\n})\ndf["proportion"] = df["users"] / df["users"].iloc[0]\ndf["pct"]        = df["proportion"] * 100\nprint(df)\n\nstatuses = pd.Series(["active","active","churned","active","churned","trial"])\nprint(statuses.value_counts(normalize=True) * 100)\n',
	},
	{
		name: "Rates of Change",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"The percentage increase or decrease between two values over time.",
		formula: "Rate of Change = ((New − Old) / Old) × 100",
		description:
			"Rates of change let you express growth or decline in a normalized, comparable way regardless of the original scale.",
		example:
			"Revenue: $80K → $100K → (100K−80K)/80K × 100 = <strong>+25%</strong><br>Signups: 1,000 → 850 → <strong>−15%</strong>",
		useCases: [
			"Monthly/quarterly KPI reporting",
			"User growth tracking",
			"Revenue trend analysis",
			"Price change comparisons",
		],
		watchOut:
			"A large % change on a tiny base is misleading. 100% growth from 2 to 4 users ≠ 100% growth from 10,000 to 20,000.",
		code: 'import pandas as pd\nimport numpy as np\n\nold, new = 80_000, 100_000\nroc = (new - old) / old * 100\nprint(f"Rate of change: {roc:.2f}%")\n\nrevenue = pd.Series([80_000, 85_000, 95_000, 100_000],\n                    index=pd.date_range("2024-01", periods=4, freq="ME"))\nprint(revenue.pct_change() * 100)\n\narr = np.array([1_000, 1_200, 1_050, 1_400])\nchanges = np.diff(arr) / arr[:-1] * 100\nprint(changes.round(2))\n',
	},
	{
		name: "Year-over-Year (YoY) Comparisons",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"Comparing a metric for the same period across consecutive years to measure true growth while eliminating seasonal noise.",
		formula: "YoY Growth = ((This Year − Last Year) / Last Year) × 100",
		description:
			"Seasonal businesses have naturally high and low periods. Comparing Dec to Nov looks like a drop even in a great year. YoY fixes this by comparing equivalent periods.",
		example:
			"Dec 2023 revenue = $120K, Dec 2024 = $150K → YoY = <strong>+25%</strong>. Always compare Dec vs Dec, not Dec vs Nov.",
		useCases: [
			"Retail and e-commerce performance",
			"Subscription revenue tracking",
			"Seasonal demand analysis",
			"Executive dashboards",
		],
		watchOut:
			"One-off events (pandemic years, product launches) distort YoY. Always annotate anomalies on your charts.",
		code: 'import pandas as pd\n\ndates   = pd.date_range("2023-01", periods=24, freq="ME")\nrevenue = pd.Series([120,130,125,140,150,160,170,155,145,135,140,150,\n                     145,155,150,165,175,185,200,180,170,160,165,175],\n                    index=dates, name="revenue_k")\n\ndf = revenue.reset_index().rename(columns={"index": "date"})\ndf["year"]  = df["date"].dt.year\ndf["month"] = df["date"].dt.month\n\npivot = df.pivot(index="month", columns="year", values="revenue_k")\npivot["yoy_pct"] = (pivot[2024] - pivot[2023]) / pivot[2023] * 100\nprint(pivot.round(2))\n',
	},
	{
		name: "Mean, Median, Mode",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"Three measures of central tendency describing where the 'center' of a dataset lies.",
		formula:
			"Mean   = Σx / n\nMedian = middle value when sorted\nMode   = most frequently occurring value",
		description:
			"| Measure | Best For | Weakness |\n|---------|----------|----------|\n| Mean | Symmetric distributions | Pulled by outliers |\n| Median | Skewed data, income, prices | Ignores extremes |\n| Mode | Categorical data | May not be unique |",
		example:
			"Salaries: [30K, 35K, 40K, 42K, 500K]<br>Mean = 129.4K (misleading), Median = 40K (representative)",
		useCases: [
			"Summarizing user ages, incomes, scores",
			"Comparing product ratings",
			"Reporting central performance metrics",
		],
		watchOut:
			"Never report just the mean for skewed data. Always check if outliers are pulling it away from reality.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nsalaries = np.array([30_000, 35_000, 40_000, 42_000, 500_000])\nprint(f"Mean   : {np.mean(salaries):,.0f}")\nprint(f"Median : {np.median(salaries):,.0f}")\nprint(f"Mode   : {stats.mode(salaries, keepdims=True).mode[0]:,.0f}")\n\ns = pd.Series(salaries)\nprint(s.describe())\n\ntrimmed = stats.trim_mean(salaries, proportiontocut=0.1)\nprint(f"Trimmed mean: {trimmed:,.0f}")\n',
	},
	{
		name: "Range, Variance & Std. Deviation",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"Measures of spread that describe how dispersed or consistent the values in a dataset are.",
		formula:
			"Range    = Max − Min\nVariance = Σ(x − μ)² / n\nStd Dev  = √Variance\nIQR      = Q3 − Q1",
		description:
			"Spread tells you how reliable your average is. A mean of 50 with SD=2 means values cluster tightly. The same mean with SD=30 means values scatter widely.",
		example:
			"Scores [48,49,50,51,52] → SD ≈ 1.4 (consistent)<br>Scores [10,30,50,70,90] → SD ≈ 28.3 (spread out)",
		useCases: [
			"Quality control (manufacturing)",
			"Risk assessment in finance",
			"Model performance evaluation",
			"A/B test variance analysis",
		],
		watchOut:
			"Variance is in squared units — harder to interpret. Always prefer std. deviation when communicating to stakeholders.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nscores = np.array([48, 49, 50, 51, 52])\nspread = np.array([10, 30, 50, 70, 90])\n\nfor arr, label in [(scores, "tight"), (spread, "wide")]:\n    print(f"--- {label} ---")\n    print(f"  Range    : {arr.max() - arr.min()}")\n    print(f"  Variance : {np.var(arr, ddof=1):.2f}")\n    print(f"  Std Dev  : {np.std(arr, ddof=1):.2f}")\n    print(f"  IQR      : {stats.iqr(arr):.2f}")\n',
	},
	{
		name: "Basic Probability",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"The likelihood of a specific event occurring, expressed between 0 (impossible) and 1 (certain).",
		formula:
			"P(event)  = Favorable outcomes / Total outcomes\nP(not A)  = 1 − P(A)\nP(A or B) = P(A) + P(B) − P(A and B)\nP(A and B)= P(A) × P(B)  [if independent]",
		description:
			"Probability is the foundation of all predictive modeling and decision-making under uncertainty. Every classifier, risk model, and simulation relies on it.",
		example:
			"20 out of 100 users churned → P(churn) = 0.2 → P(no churn) = <strong>0.8</strong>",
		useCases: [
			"Churn prediction models",
			"Lead scoring",
			"Fraud detection thresholds",
			"Insurance risk models",
		],
		watchOut:
			"Don't confuse probability with frequency. P=0.2 means a 20% chance — not that exactly 1 in 5 events will always occur.",
		code: 'import numpy as np\nfrom scipy import stats\n\nchurned = np.array([0]*80 + [1]*20)\np_churn    = churned.mean()\np_no_churn = 1 - p_churn\nprint(f"P(churn) = {p_churn:.2f}  |  P(no churn) = {p_no_churn:.2f}")\n\nn, p, k = 10, 0.2, 3\nbinom = stats.binom(n, p)\nprint(f"P(exactly 3 churn in 10) = {binom.pmf(k):.4f}")\nprint(f"P(at most 3 churn in 10) = {binom.cdf(k):.4f}")\n\nrng = np.random.default_rng(42)\nsimulated = rng.binomial(1, 0.2, size=100_000)\nprint(f"Simulated P(churn) ≈ {simulated.mean():.4f}")\n',
	},
	{
		name: "Frequency Distributions & Histograms",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"A frequency distribution shows how often each value (or range) appears. A histogram is its visual form.",
		formula:
			"Relative Frequency = Count in bin / Total count\nSkewness = (1/n) × Σ((x−μ)/σ)³",
		description:
			"Histograms reveal the shape of your data:\n- **Normal**: symmetric bell\n- **Right-skewed**: long right tail (income)\n- **Left-skewed**: long left tail (retirement age)\n- **Bimodal**: two peaks → two subpopulations",
		example:
			"User session lengths: most users at 2–5 min, power users 60+ min → right-skewed.",
		useCases: [
			"Exploratory data analysis (EDA)",
			"Detecting outliers",
			"Choosing the right statistical test",
			"Feature distribution checks before modeling",
		],
		watchOut:
			"Bin size matters! Too few bins hides structure; too many creates noise. Try multiple bin widths.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\nsessions = np.concatenate([\n    rng.exponential(scale=4, size=900),\n    rng.uniform(30, 90, size=100),\n])\ns = pd.Series(sessions)\nbinned = pd.cut(s, bins=10)\nprint(binned.value_counts().sort_index())\n\nprint(f"Skewness : {stats.skew(sessions):.3f}")\nprint(f"Kurtosis : {stats.kurtosis(sessions):.3f}")\n',
	},
	{
		name: "Data Types",
		tags: ["Data Analyst", "Analytics Engineer", "Data Engineer"],
		difficulty: "Foundational",
		definition:
			"A classification for the kind of values a variable holds, determining valid operations and chart types.",
		formula: "N/A — conceptual framework",
		description:
			"| Type | Subtype | Examples | Valid Ops |\n|------|---------|----------|-----------|\n| Categorical | Nominal | Country, color | Count, mode |\n| Categorical | Ordinal | Rating 1–5 | Count, rank |\n| Numerical | Discrete | # orders, clicks | All arithmetic |\n| Numerical | Continuous | Revenue, time | All arithmetic |",
		example:
			"Customer plan (Free/Pro/Enterprise) = nominal. Satisfaction (1–5) = ordinal. Revenue ($) = continuous.",
		useCases: [
			"Choosing the right chart type",
			"Selecting appropriate statistical tests",
			"Encoding variables for ML models",
		],
		watchOut:
			"Numeric-looking codes (zip codes, user IDs) are categorical. Averaging zip codes produces meaningless results.",
		code: 'import pandas as pd\n\ndf = pd.DataFrame({\n    "user_id":      [101, 102, 103, 104],\n    "plan":         ["Free","Pro","Enterprise","Free"],\n    "satisfaction": pd.Categorical([3,5,4,2], categories=[1,2,3,4,5], ordered=True),\n    "orders":       [2, 15, 8, 1],\n    "revenue":      [0.0, 299.99, 99.99, 0.0],\n})\ndf["plan"]    = df["plan"].astype("category")\ndf["user_id"] = df["user_id"].astype(str)\nprint(df.dtypes)\nprint(df.select_dtypes(include="number").describe())\nprint(df["plan"].value_counts())\n',
	},
	{
		name: "Pareto Analysis (80/20 Rule)",
		tags: ["Data Analyst"],
		difficulty: "Foundational",
		definition:
			"Roughly 80% of effects come from 20% of causes — used to prioritize high-impact actions.",
		formula:
			"Cumulative % = Σ(sorted values) / Total × 100\nFind where cumulative crosses ~80%",
		description:
			"Sort, cumulate, and find the cutoff. Appears across business: customers, bugs, revenue drivers, support tickets.",
		example:
			"20% of customers generate 80% of revenue. Identify those customers and prioritize their retention.",
		useCases: [
			"Customer value segmentation",
			"Bug prioritization",
			"Support ticket root cause analysis",
			"Supply chain optimization",
		],
		watchOut:
			"The 80/20 split is a heuristic — in some contexts it's 90/10 or 70/30. It's a prioritization principle, not a universal law.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({\n    "customer": [f"C{i:03d}" for i in range(1, 51)],\n    "revenue":  rng.exponential(scale=5_000, size=50).round(2),\n})\ndf = df.sort_values("revenue", ascending=False).reset_index(drop=True)\ndf["cum_revenue"] = df["revenue"].cumsum()\ndf["cum_pct"]     = df["cum_revenue"] / df["revenue"].sum() * 100\ndf["cust_pct"]    = (df.index + 1) / len(df) * 100\n\ncutoff = df[df["cum_pct"] >= 80].iloc[0]\nprint(f"Top {cutoff[\'cust_pct\']:.1f}% of customers → {cutoff[\'cum_pct\']:.1f}% of revenue")\n',
	},
	{
		name: "SQL Window Functions for Analytics",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"Window functions perform calculations across a set of rows related to the current row, without collapsing the result like GROUP BY.",
		formula:
			"FUNCTION() OVER (\n  PARTITION BY col\n  ORDER BY col\n  ROWS BETWEEN ... AND ...\n)",
		description:
			"Key functions: **ROW_NUMBER**, **RANK**, **DENSE_RANK**, **LAG / LEAD**, **SUM / AVG OVER**, **NTILE**, **FIRST_VALUE / LAST_VALUE**.",
		example:
			"Running total of revenue per user: `SUM(revenue) OVER (PARTITION BY user_id ORDER BY date)`",
		useCases: [
			"Running totals",
			"Period-over-period comparisons",
			"Ranking within groups",
			"Moving averages in SQL",
		],
		watchOut:
			"ORDER BY inside OVER affects frame boundaries. Default frame is RANGE UNBOUNDED PRECEDING — always specify ROWS when doing rolling calcs.",
		code: 'import pandas as pd\n\ndf = pd.DataFrame({\n    "user_id": [1,1,1,2,2],\n    "date":    pd.date_range("2024-01", periods=5, freq="ME"),\n    "revenue": [100, 200, 150, 300, 250],\n})\ndf["running_total"] = df.groupby("user_id")["revenue"].cumsum()\ndf["prev_month"]    = df.groupby("user_id")["revenue"].shift(1)\ndf["moving_avg_2"]  = (df.groupby("user_id")["revenue"]\n                       .transform(lambda x: x.rolling(2).mean()))\nprint(df)\n# Equivalent SQL:\n# SELECT *, SUM(revenue) OVER (PARTITION BY user_id ORDER BY date) AS running_total\n# LAG(revenue) OVER (PARTITION BY user_id ORDER BY date) AS prev_month\n# FROM df\n',
	},
	{
		name: "Data Modeling — Star & Snowflake Schema",
		tags: ["Analytics Engineer", "Data Engineer"],
		difficulty: "Foundational",
		definition:
			"Dimensional modeling patterns organizing data into fact tables (metrics) and dimension tables (context) for analytical queries.",
		formula:
			"Star Schema:      Fact ← Dimensions (denormalized)\nSnowflake Schema: Fact ← Dimensions ← Sub-dimensions (normalized)",
		description:
			"- **Fact table**: measurable events (sales, clicks) with foreign keys\n- **Dimension table**: descriptive context (customer, product, date)\n- **Star**: fast queries, some redundancy\n- **Snowflake**: less storage, more joins",
		example:
			"fact_orders (order_id, customer_id, product_id, date_id, amount) joins dim_customer, dim_product, dim_date.",
		useCases: [
			"Data warehouse design",
			"dbt project structure",
			"BI tool performance",
			"Reporting layer design",
		],
		watchOut:
			"Snowflake looks clean but adds query complexity. Prefer star schema for BI performance unless storage cost is critical.",
		code: 'import pandas as pd\n\nfact_orders = pd.DataFrame({\n    "order_id":    [1, 2, 3],\n    "customer_id": [101, 102, 101],\n    "product_id":  [10, 11, 10],\n    "amount":      [250.0, 89.99, 310.0],\n})\ndim_customer = pd.DataFrame({\n    "customer_id": [101, 102],\n    "name":        ["Alice", "Bob"],\n    "region":      ["APAC", "EMEA"],\n})\ndim_product = pd.DataFrame({\n    "product_id": [10, 11],\n    "product":    ["Laptop", "Mouse"],\n    "category":   ["Electronics", "Accessories"],\n})\nresult = (fact_orders\n          .merge(dim_customer, on="customer_id")\n          .merge(dim_product,  on="product_id"))\nprint(result[["order_id","name","product","amount"]])\n',
	},
	{
		name: "Z-Scores & Normal Distribution",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"A Z-score measures how many standard deviations a value is from the mean. The normal distribution is a symmetric bell-shaped curve defined by mean and std. deviation.",
		formula:
			"Z = (x − μ) / σ\n\nEmpirical Rule:\n  68%  of data within ±1 SD\n  95%  of data within ±2 SD\n  99.7% of data within ±3 SD",
		description:
			"Z-scores standardize values across different scales, making them directly comparable. Foundation for hypothesis tests, outlier detection, and anomaly flagging.",
		example:
			"μ = $50, σ = $10. An order of $80 → Z = (80−50)/10 = <strong>3.0</strong> → top 0.13% — likely a VIP or data entry error.",
		useCases: [
			"Outlier and anomaly detection",
			"Standardizing ML features",
			"Comparing scores across different scales",
			"Fraud detection",
		],
		watchOut:
			"Z-scores assume normality. On skewed data use the modified Z-score (based on median and MAD).",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\nfrom sklearn.preprocessing import StandardScaler\n\norders = np.array([30, 45, 50, 52, 48, 55, 80, 51, 49, 200])\nz = stats.zscore(orders, ddof=1)\noutliers = orders[np.abs(z) > 3]\nprint(f"Outliers: {outliers}")\n\nz_val = (80 - 50) / 10\npct = stats.norm.cdf(z_val) * 100\nprint(f"Z=3.0 → top {100 - pct:.2f}% of orders")\n\nscaler = StandardScaler()\nscaled = scaler.fit_transform(orders.reshape(-1, 1))\nprint(scaled.flatten().round(2))\n',
	},
	{
		name: "Correlation (Pearson & Spearman)",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"A measure of the strength and direction of the relationship between two variables, ranging from −1 to +1.",
		formula:
			"Pearson r  = Σ((x−x̄)(y−ȳ)) / (n·σx·σy)\nSpearman ρ = 1 − (6·Σd²) / (n·(n²−1))\n\n|r| < 0.3  → weak\n|r| 0.3–0.7 → moderate\n|r| > 0.7  → strong",
		description:
			"| Method | Measures | When to Use |\n|--------|----------|-------------|\n| Pearson | Linear relationship | Normal continuous data |\n| Spearman | Monotonic relationship | Ordinal or ranked data |",
		example: "Ad spend vs revenue: r = 0.85 → strong positive correlation.",
		useCases: [
			"Feature selection for ML",
			"Identifying business drivers",
			"Multicollinearity checks in regression",
		],
		watchOut:
			"<strong>Correlation ≠ causation.</strong> Ice cream sales and drowning rates are correlated (both driven by summer).",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\nad_spend = rng.uniform(1_000, 10_000, 100)\nrevenue  = 5_000 + 3 * ad_spend + rng.normal(0, 2_000, 100)\n\nr, p   = stats.pearsonr(ad_spend, revenue)\nrho, p2 = stats.spearmanr(ad_spend, revenue)\nprint(f"Pearson r={r:.3f} (p={p:.4f})")\nprint(f"Spearman ρ={rho:.3f} (p={p2:.4f})")\n\ndf = pd.DataFrame({"ad_spend": ad_spend, "revenue": revenue})\nprint(df.corr(method="pearson").round(3))\n',
	},
	{
		name: "Hypothesis Testing & P-Values",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"A formal framework for determining whether an observed effect is statistically significant or due to random chance.",
		formula:
			"H₀: no effect (null hypothesis)\nH₁: effect exists (alternative)\n\np-value = P(seeing this result | H₀ is true)\np < 0.05  → reject H₀  (significant)\np ≥ 0.05  → fail to reject H₀",
		description:
			"Common tests:\n- **t-test**: compare means of two groups\n- **Chi-square**: compare categorical distributions\n- **ANOVA**: compare means across 3+ groups\n- **Mann-Whitney U**: non-parametric alternative to t-test",
		example:
			"Variant B: 4.5% conv vs control: 4.0%. p = 0.03 → significant at α=0.05 → safe to ship.",
		useCases: [
			"A/B test analysis",
			"Product experiment evaluation",
			"Clinical trial analysis",
			"Quality control testing",
		],
		watchOut:
			"p < 0.05 ≠ 'large effect'. A tiny difference can be significant with a huge sample. Always report effect size.",
		code: 'import numpy as np\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\ncontrol = rng.normal(loc=4.0, scale=1.0, size=500)\nvariant = rng.normal(loc=4.5, scale=1.0, size=500)\n\nt_stat, p_val = stats.ttest_ind(control, variant)\nprint(f"t={t_stat:.3f}  p={p_val:.4f}")\nprint("Significant!" if p_val < 0.05 else "Not significant")\n\npooled_std = np.sqrt((control.std()**2 + variant.std()**2) / 2)\ncohens_d   = (variant.mean() - control.mean()) / pooled_std\nprint(f"Cohen\'s d = {cohens_d:.3f}  (small<0.2, medium<0.5, large>0.8)")\n\nobserved = np.array([[400, 100], [420, 80]])\nchi2, p_chi, dof, expected = stats.chi2_contingency(observed)\nprint(f"Chi2={chi2:.3f}  p={p_chi:.4f}")\n',
	},
	{
		name: "Confidence Intervals",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"A range of values that, with a specified confidence level (typically 95%), contains the true population parameter.",
		formula:
			"CI = x̄ ± (z* × SE)\nSE  = σ / √n\n\nz* for 95% CI = 1.96\nz* for 99% CI = 2.576",
		description:
			"A 95% CI means: if repeated 100 times, ~95 of those intervals contain the true value. It is NOT a 95% probability for one specific interval.",
		example: "Conversion rate: 4.2%, n=2,000 → 95% CI = [3.8%, 4.6%].",
		useCases: [
			"Reporting survey results",
			"A/B test decision-making",
			"Model accuracy ranges",
			"Communicating uncertainty",
		],
		watchOut:
			"Wider CI = less precision, not a flaw. Chasing narrow CIs by ignoring uncertainty misleads decision-makers.",
		code: 'import numpy as np\nfrom scipy import stats\nimport statsmodels.stats.proportion as smp\n\nrng = np.random.default_rng(42)\ndata = rng.normal(loc=4.2, scale=1.0, size=2_000)\nci = stats.t.interval(0.95, df=len(data)-1, loc=data.mean(), scale=stats.sem(data))\nprint(f"Mean CI 95%: {ci[0]:.3f} – {ci[1]:.3f}")\n\nci_prop = smp.proportion_confint(84, 2_000, alpha=0.05, method="wilson")\nprint(f"Proportion CI 95%: {ci_prop[0]*100:.2f}% – {ci_prop[1]*100:.2f}%")\n\nboot_means = np.array([rng.choice(data, size=len(data), replace=True).mean()\n                       for _ in range(5_000)])\nboot_ci = np.percentile(boot_means, [2.5, 97.5])\nprint(f"Bootstrap CI 95%: {boot_ci[0]:.3f} – {boot_ci[1]:.3f}")\n',
	},
	{
		name: "Sampling & Sampling Bias",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Sampling selects a subset of a population for analysis. Bias occurs when the sample systematically differs from the population.",
		formula:
			"Margin of Error = z* × √(p(1−p)/n)\nRequired n ≈ (z*/ME)² × p(1−p)",
		description:
			"**Types of bias:**\n- **Selection bias**: non-random inclusion\n- **Survivorship bias**: analyzing only those who survived\n- **Response bias**: self-selection skews respondents\n- **Convenience bias**: sampling whoever is easiest to reach",
		example:
			"Surveying NPS only from users who logged in this month excludes churned users — satisfaction looks artificially high.",
		useCases: [
			"Survey design",
			"A/B test setup",
			"Market research",
			"Product feedback analysis",
		],
		watchOut:
			"Always ask: 'Who is NOT in my sample and why?' The absence of data is often as informative as the data itself.",
		code: 'import pandas as pd\nimport numpy as np\nfrom statsmodels.stats.proportion import samplesize_confint_proportion\n\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({\n    "user_id": range(10_000),\n    "plan":    rng.choice(["free","pro","enterprise"], 10_000, p=[0.7,0.2,0.1]),\n    "revenue": rng.exponential(50, 10_000),\n})\nsample_strat = df.groupby("plan", group_keys=False).apply(\n    lambda x: x.sample(frac=0.05, random_state=42)\n)\nprint("Stratified sample plan distribution:")\nprint(sample_strat["plan"].value_counts(normalize=True).round(3))\n\nn_required = samplesize_confint_proportion(0.5, half_length=0.03, alpha=0.05)\nprint(f"Required n for ±3% margin: {int(np.ceil(n_required))}")\n',
	},
	{
		name: "Linear Regression & Coefficients",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"A model estimating the relationship between independent variables (X) and a dependent variable (Y) by fitting a line.",
		formula:
			"Simple:   Y = β₀ + β₁X + ε\nMultiple: Y = β₀ + β₁X₁ + β₂X₂ + ... + ε\n\nR² = 1 − (SS_res / SS_tot)\nRMSE = √(Σ(y − ŷ)² / n)",
		description:
			"- **β₀ (intercept)**: predicted Y when all X = 0\n- **β₁ (coefficient)**: change in Y per 1-unit increase in X\n- **R²**: proportion of variance explained\n- **Residuals (ε)**: unexplained portion — should be random",
		example:
			"β₁ for ad spend = 2.5 → every $1 more in ads associated with $2.50 more in revenue (holding other factors constant).",
		useCases: [
			"Demand forecasting",
			"Price elasticity analysis",
			"Sales attribution modeling",
			"Feature importance estimation",
		],
		watchOut:
			"R² inflates as you add variables. Use Adjusted R² for multiple regression. Regression shows association, not causation.",
		code: 'import numpy as np\nfrom sklearn.linear_model import LinearRegression\nfrom sklearn.metrics import r2_score, mean_squared_error\nimport statsmodels.api as sm\n\nrng = np.random.default_rng(42)\nad_spend = rng.uniform(1_000, 10_000, 200)\nrevenue  = 5_000 + 2.5 * ad_spend + rng.normal(0, 2_000, 200)\n\nmodel = LinearRegression().fit(ad_spend.reshape(-1, 1), revenue)\nprint(f"β₀={model.intercept_:,.2f}  β₁={model.coef_[0]:.4f}")\nprint(f"R²={r2_score(revenue, model.predict(ad_spend.reshape(-1,1))):.4f}")\nprint(f"RMSE={mean_squared_error(revenue, model.predict(ad_spend.reshape(-1,1)))**0.5:,.2f}")\n\nX_sm = sm.add_constant(ad_spend)\nols  = sm.OLS(revenue, X_sm).fit()\nprint(ols.summary())\n',
	},
	{
		name: "Conditional Probability & Bayes' Theorem",
		tags: ["Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Conditional probability is the likelihood of event A given B occurred. Bayes' theorem updates probabilities as new evidence arrives.",
		formula:
			"P(A|B) = P(A and B) / P(B)\n\nBayes' Theorem:\nP(A|B) = P(B|A) × P(A) / P(B)\n\nPosterior ∝ Likelihood × Prior",
		description:
			"Bayes formalizes belief updating: start with a prior, observe evidence, update to a posterior. Foundation of spam filters, medical diagnostics, and recommendation systems.",
		example:
			"99% accurate test, 1% disease prevalence → P(disease | positive) ≈ <strong>50%</strong> — most positives are false alarms due to rare base rate.",
		useCases: [
			"Spam email classification",
			"Medical diagnosis models",
			"Lead scoring",
			"Fraud detection",
		],
		watchOut:
			"Base rate neglect is extremely common. Even a highly accurate test produces mostly false positives for rare conditions.",
		code: 'p_disease               = 0.01\np_pos_given_disease     = 0.99\np_pos_given_no_disease  = 0.01\n\np_positive = (p_pos_given_disease * p_disease +\n              p_pos_given_no_disease * (1 - p_disease))\np_disease_given_pos = (p_pos_given_disease * p_disease) / p_positive\nprint(f"P(disease | positive) = {p_disease_given_pos*100:.1f}%")\n\nfrom sklearn.naive_bayes import GaussianNB\nfrom sklearn.datasets import load_iris\nimport numpy as np\n\niris = load_iris()\nnb = GaussianNB()\nnb.fit(iris.data, iris.target)\nsample = np.array([[5.1, 3.5, 1.4, 0.2]])\nprobs  = nb.predict_proba(sample)[0]\nprint("Class probabilities:", dict(zip(iris.target_names, probs.round(4))))\n',
	},
	{
		name: "Cohort & Segmentation Analysis",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"Cohort analysis groups users sharing a common characteristic at a point in time and tracks their behavior over time.",
		formula:
			"Retention Rate at n =\n  Active from cohort still active at n / Original cohort size × 100",
		description:
			"Cohorts separate the effect of time (how long a user has been around) from calendar period (what's happening in the product now). Without cohorts, retention improvements are hidden by old cohorts churning.",
		example:
			"Jan cohort: 40% retention at 6 months. Jun cohort: 25% → product or acquisition quality likely declined.",
		useCases: [
			"SaaS retention analysis",
			"LTV calculation",
			"Evaluating product changes",
			"Acquisition channel quality comparison",
		],
		watchOut:
			"Don't compare cohorts of different sizes without normalization. Distinguish early churn (onboarding) from long-term churn (value decay).",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nn = 2_000\ndf = pd.DataFrame({\n    "user_id":     range(n),\n    "signup_date": pd.to_datetime(rng.choice(pd.date_range("2024-01-01","2024-06-01", freq="D"), n)),\n    "last_active": pd.to_datetime(rng.choice(pd.date_range("2024-01-01","2024-12-01", freq="D"), n)),\n})\ndf["cohort_month"]  = df["signup_date"].dt.to_period("M")\ndf["periods_since"] = ((df["last_active"].dt.to_period("M") - df["cohort_month"])\n                       .apply(lambda x: x.n))\ncohort_size = df.groupby("cohort_month")["user_id"].nunique()\nretention   = (df.groupby(["cohort_month","periods_since"])["user_id"]\n               .nunique().reset_index()\n               .pivot(index="cohort_month", columns="periods_since", values="user_id"))\nprint((retention.divide(cohort_size, axis=0) * 100).round(1).iloc[:, :6])\n',
	},
	{
		name: "Index Numbers & Weighted Averages",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"An index expresses a value relative to a reference (base) period. A weighted average assigns different importance to values based on size or relevance.",
		formula:
			"Index        = (Current Value / Base Value) × 100\nWeighted Avg = Σ(value × weight) / Σ(weight)",
		description:
			"**When to use weighted averages:** When groups have very different sizes, a simple average is misleading. A 90% retention from 10 users should NOT equal 90% from 10,000 users.",
		example:
			"Simple avg of [50%, 90%] = 70%.<br>Sizes 100 and 1,000: weighted = (50×100 + 90×1000)/1100 = <strong>86.4%</strong>",
		useCases: [
			"CPI and price indices",
			"Portfolio performance",
			"Blended NPS across segments",
			"Weighted KPIs",
		],
		watchOut:
			"Wrong weights massively distort results. Document your weighting methodology and revisit as group sizes change.",
		code: 'import numpy as np\nimport pandas as pd\n\nprices = pd.Series([100,108,115,122,130], index=[2020,2021,2022,2023,2024])\nindex  = prices / prices.iloc[0] * 100\nprint("Price index (base 2020=100):"); print(index.round(1))\n\nvalues  = np.array([50, 90])\nweights = np.array([100, 1_000])\nprint(f"Simple avg  : {values.mean():.1f}%")\nprint(f"Weighted avg: {np.average(values, weights=weights):.1f}%")\n\nnps = pd.DataFrame({"channel":["email","app","web"], "nps":[45,62,38], "users":[5_000,12_000,8_000]})\nprint(f"Blended NPS: {np.average(nps[\'nps\'], weights=nps[\'users\']):.1f}")\n',
	},
	{
		name: "ETL / ELT Pipeline Concepts",
		tags: ["Data Engineer", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"ETL (Extract-Transform-Load) and ELT (Extract-Load-Transform) are patterns for moving and shaping data between systems.",
		formula:
			"ETL: Source → Transform → Warehouse\nELT: Source → Warehouse → Transform (in-warehouse)",
		description:
			"- **ETL**: transformations happen before loading (traditional, good for sensitive data)\n- **ELT**: raw data lands first, transformations run in the warehouse (modern, dbt-style)\n- Key concerns: idempotency, incremental loads, schema evolution, error handling",
		example:
			"dbt runs SQL transformations inside BigQuery/Snowflake after raw data lands from Fivetran → ELT pattern.",
		useCases: [
			"Data warehouse ingestion",
			"dbt project design",
			"Real-time streaming pipelines",
			"Data lake architecture",
		],
		watchOut:
			"Non-idempotent pipelines cause duplicates on reruns. Always design transformations to be safe to re-execute.",
		code: 'import pandas as pd\n\ndef transform_orders(raw: pd.DataFrame) -> pd.DataFrame:\n    df = raw.copy()\n    df["order_date"]  = pd.to_datetime(df["order_date"])\n    df["revenue_usd"] = df["amount"] * df["fx_rate"]\n    df = df.drop_duplicates(subset="order_id")   # idempotent dedup\n    df = df[df["status"] == "completed"]\n    return df\n\nraw = pd.DataFrame({\n    "order_id":   [1, 2, 2, 3],\n    "order_date": ["2024-01-01","2024-01-02","2024-01-02","2024-01-03"],\n    "amount":     [100, 200, 200, 150],\n    "fx_rate":    [1.0, 1.0, 1.0, 1.1],\n    "status":     ["completed","completed","completed","pending"],\n})\nprint(transform_orders(raw))\n',
	},
	{
		name: "Data Quality & Profiling",
		tags: ["Analytics Engineer", "Data Engineer"],
		difficulty: "Intermediate",
		definition:
			"The process of examining datasets to understand their structure, completeness, consistency, accuracy, and fitness for purpose.",
		formula:
			"Completeness = Non-null rows / Total rows × 100\nUniqueness  = Distinct values / Total rows × 100\nValidity    = Rows passing rules / Total rows × 100",
		description:
			"**Key dimensions:** Completeness, Uniqueness, Validity, Timeliness, Consistency, Accuracy.",
		example:
			"email column: 98% non-null, 95% match regex, 2% duplicate → flag for deduplication and validation.",
		useCases: [
			"Data contract validation",
			"Pipeline monitoring",
			"dbt tests",
			"Data observability",
		],
		watchOut:
			"Null ≠ missing ≠ zero. Understand what null means in each column's business context before imputing.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({\n    "user_id": range(1000),\n    "email":   [f"u{i}@x.com" if rng.random()>0.03 else None for i in range(1000)],\n    "revenue": rng.exponential(100, 1000),\n    "country": rng.choice(["PH","US","SG",None], 1000, p=[0.4,0.3,0.2,0.1]),\n})\n\nprofile = pd.DataFrame({\n    "completeness_pct": (df.notna().mean() * 100).round(2),\n    "uniqueness_pct":   (df.nunique() / len(df) * 100).round(2),\n    "dtype":            df.dtypes.astype(str),\n})\nprint(profile)\nprint(f"Duplicate rows: {df.duplicated().sum()}")\noutliers = (((df.revenue - df.revenue.mean()) / df.revenue.std()).abs() > 3).sum()\nprint(f"Revenue outliers (>3σ): {outliers}")\n',
	},
	{
		name: "Multiple Regression",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"An extension of linear regression modeling a dependent variable against two or more independent variables simultaneously.",
		formula:
			"Y = β₀ + β₁X₁ + β₂X₂ + β₃X₃ + ε\n\nAdj. R² = 1 − [(1−R²)(n−1)/(n−k−1)]\nVIF > 10 → multicollinearity problem",
		description:
			"**Key checks before trusting results:**\n- **Multicollinearity**: correlated predictors distort coefficients (use VIF)\n- **Heteroscedasticity**: unequal residual variance (use Breusch-Pagan)\n- **Overfitting**: high train R², low test R² (cross-validate)",
		example:
			"Revenue = 10,000 + 2.5(AdSpend) + 500(SalesReps) − 200(ChurnRate). Each coefficient holds others constant.",
		useCases: [
			"Marketing mix modeling",
			"Price optimization",
			"Sales forecasting",
			"Causal inference",
		],
		watchOut:
			"Adding variables always increases R². Use Adjusted R² or cross-validation to assess true quality.",
		code: 'import numpy as np\nimport pandas as pd\nimport statsmodels.api as sm\nfrom statsmodels.stats.outliers_influence import variance_inflation_factor\nfrom sklearn.linear_model import LinearRegression\nfrom sklearn.model_selection import cross_val_score\n\nrng = np.random.default_rng(42)\nn = 300\ndf = pd.DataFrame({\n    "ad_spend":   rng.uniform(1_000, 10_000, n),\n    "sales_reps": rng.integers(1, 20, n).astype(float),\n    "churn_rate": rng.uniform(0.01, 0.3, n),\n})\ndf["revenue"] = (10_000 + 2.5*df["ad_spend"]\n                 + 500*df["sales_reps"]\n                 - 200*df["churn_rate"]*100\n                 + rng.normal(0, 3_000, n))\n\nX = sm.add_constant(df[["ad_spend","sales_reps","churn_rate"]])\nols = sm.OLS(df["revenue"], X).fit()\nprint(ols.summary())\n\nvif = pd.DataFrame({"feature": X.columns,\n    "VIF": [variance_inflation_factor(X.values, i) for i in range(X.shape[1])]})\nprint(vif)\n',
	},
	{
		name: "Time Series Analysis",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Methods for modeling sequences of data points collected at successive time intervals: decomposition, forecasting, anomaly detection.",
		formula:
			"Decomposition: Y(t) = Trend(t) + Seasonality(t) + Noise(t)\nMoving Avg:   MA(k) = (1/k) × Σ Yᵢ  [i=t−k+1 to t]\nARIMA(p,d,q): AutoRegressive Integrated Moving Average",
		description:
			"**Components:** Trend (long-term direction), Seasonality (repeating fixed patterns), Cyclicality (irregular waves), Noise.\n\nCommon models: ARIMA, Exponential Smoothing, Facebook Prophet.",
		example:
			"E-commerce sales: upward trend + December spikes + daily noise. 7-day MA smooths noise to reveal trend.",
		useCases: [
			"Demand forecasting",
			"Financial market analysis",
			"Anomaly detection in metrics",
			"Capacity planning",
		],
		watchOut:
			"Most models (ARIMA) require stationarity. Test with Augmented Dickey-Fuller (ADF) first.",
		code: 'import numpy as np\nimport pandas as pd\nfrom statsmodels.tsa.seasonal import seasonal_decompose\nfrom statsmodels.tsa.stattools import adfuller\n\nrng = np.random.default_rng(42)\ndates    = pd.date_range("2022-01-01", periods=104, freq="W")\ntrend    = np.linspace(100, 200, 104)\nseasonal = 20 * np.sin(2 * np.pi * np.arange(104) / 52)\nsales    = pd.Series(trend + seasonal + rng.normal(0, 5, 104), index=dates)\n\nsales_df = sales.to_frame("sales")\nsales_df["MA7"]  = sales.rolling(7).mean()\nsales_df["MA13"] = sales.rolling(13).mean()\n\nresult = seasonal_decompose(sales, model="additive", period=52)\n\nadf_stat, p_val, *_ = adfuller(sales)\nprint(f"ADF p-value: {p_val:.4f}")\nprint("Stationary" if p_val < 0.05 else "Not stationary → consider differencing")\n',
	},
	{
		name: "A/B Testing & Experimental Design",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"A controlled experiment randomly assigning users to variants to measure the causal impact of a change on a defined metric.",
		formula:
			"Min sample size per variant:\nn ≈ 2σ²(z_α/2 + z_β)² / δ²\n\nz_α/2 = 1.96 (95% confidence)\nz_β   = 0.84 (80% power)\nδ = minimum detectable effect",
		description:
			"**Best practices:** Pre-calculate sample size, randomize properly, define one primary metric, never stop early, run full business cycles.",
		example:
			"Blue CTA vs grey. Run until n=5,000 per variant. Blue=4.8%, grey=4.0%, p=0.02 → significant → ship it.",
		useCases: [
			"Product feature launches",
			"Email subject line optimization",
			"Pricing page changes",
			"Onboarding flow improvements",
		],
		watchOut:
			"Early stopping is the #1 mistake. Peeking and stopping inflates false positive rate to 25%+ even at α=0.05.",
		code: 'import numpy as np\nfrom scipy import stats\nfrom statsmodels.stats.proportion import proportions_ztest, proportion_effectsize\nfrom statsmodels.stats.power import NormalIndPower\n\neffect_size = proportion_effectsize(0.045, 0.040)\nn_per_group = NormalIndPower().solve_power(effect_size=effect_size, alpha=0.05, power=0.80)\nprint(f"Required n per variant: {int(np.ceil(n_per_group)):,}")\n\nrng = np.random.default_rng(42)\nn = 5_000\ncontrol = rng.binomial(1, 0.040, n)\nvariant = rng.binomial(1, 0.048, n)\n\nz, p = proportions_ztest([variant.sum(), control.sum()], [len(variant), len(control)])\nprint(f"z={z:.3f}  p={p:.4f}")\nprint("Ship it!" if p < 0.05 else "Keep testing")\n\nlift = (variant.mean() - control.mean()) / control.mean() * 100\nprint(f"Relative lift: {lift:.2f}%")\n',
	},
	{
		name: "Statistical Power & Sample Size",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Statistical power is the probability a test correctly detects a real effect when one exists (1 − β, target ≥ 0.80).",
		formula:
			"Power = 1 − β  (target ≥ 0.80)\n\nPower ↑ when: sample size ↑, effect size ↑, α ↑, variance ↓\n\n| | H₀ True | H₀ False |\n|--|---------|----------|\n| Reject H₀ | Type I (α) | Correct |\n| Fail to Reject | Correct | Type II (β) |",
		description:
			"Underpowered tests miss real effects. Overpowered tests detect trivially small, irrelevant effects.",
		example:
			"Testing 0.5% lift on 4% base → ~75,000 users per variant at 80% power. Low-traffic sites may wait months.",
		useCases: [
			"A/B test planning",
			"Clinical trial design",
			"Minimum viable experiment scoping",
		],
		watchOut:
			"Post-hoc power analysis is misleading. Always calculate required sample size BEFORE starting the experiment.",
		code: 'import numpy as np\nfrom statsmodels.stats.power import TTestIndPower\n\nanalysis = TTestIndPower()\nn = analysis.solve_power(effect_size=0.3, alpha=0.05, power=0.80)\nprint(f"n per group for d=0.3, α=0.05, power=0.80: {int(np.ceil(n))}")\n\nsample_sizes = np.arange(10, 500, 10)\npowers = [analysis.solve_power(effect_size=0.3, alpha=0.05, nobs1=n, ratio=1)\n          for n in sample_sizes]\n\nfor n, pw in zip(sample_sizes[::5], powers[::5]):\n    print(f"n={n:3d} → power={pw:.3f}")\n',
	},
	{
		name: "Survival / Retention Analysis",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Methods for modeling time until a specific event (churn, conversion), accounting for users who haven't experienced it yet (censoring).",
		formula:
			"Kaplan-Meier Estimator:\nS(t) = Π [ (nᵢ − dᵢ) / nᵢ ]  for all tᵢ ≤ t\n\nnᵢ = at-risk count at t\ndᵢ = events at t",
		description:
			"- **S(t)**: probability of surviving (not churning) past time t\n- **Hazard rate**: instantaneous churn risk at t\n- **Censoring**: users still active\n- **Cox PH**: extends survival analysis with covariates",
		example:
			"80% active at 30 days, 50% at 90 days, 30% at 180 days. Steepest drop first 2 weeks → onboarding problem.",
		useCases: [
			"SaaS churn prediction",
			"Customer LTV modeling",
			"Credit risk duration modeling",
		],
		watchOut:
			"Censoring must be non-informative — users shouldn't drop out because they're about to churn.",
		code: '# pip install lifelines\nimport numpy as np\nimport pandas as pd\nfrom lifelines import KaplanMeierFitter, CoxPHFitter\n\nrng = np.random.default_rng(42)\nn = 500\ndf = pd.DataFrame({\n    "duration":  rng.integers(1, 365, n),\n    "event":     rng.binomial(1, 0.6, n),\n    "plan_pro":  rng.binomial(1, 0.4, n),\n    "logins_pw": rng.poisson(5, n),\n})\nkmf = KaplanMeierFitter()\nkmf.fit(df["duration"], event_observed=df["event"])\nprint(f"Median survival time: {kmf.median_survival_time_} days")\n\ncph = CoxPHFitter()\ncph.fit(df, duration_col="duration", event_col="event")\ncph.print_summary()\n',
	},
	{
		name: "Simpson's Paradox & Statistical Pitfalls",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"A trend appearing in aggregate data disappears or reverses when broken down by subgroups.",
		formula:
			"No formula — structural reasoning failure.\nCheck: Do aggregate trends match all subgroup trends?",
		description:
			"**Common pitfalls:** Simpson's Paradox, P-hacking (multiple comparisons), HARKing, Base rate neglect, Ecological fallacy.",
		example:
			"Hospital A has higher overall survival than B. But B is better for BOTH mild and severe cases — it handles more severe cases.",
		useCases: [
			"Multi-segment reporting",
			"Policy evaluation",
			"Medical and social research",
			"Experiment post-mortems",
		],
		watchOut:
			"Always segment your data before drawing conclusions. A single aggregate number almost never tells the whole story.",
		code: 'import pandas as pd\nfrom statsmodels.stats.multitest import multipletests\nfrom scipy.stats import ttest_ind\nimport numpy as np\n\ndata = {"hospital":["A","A","B","B"], "severity":["mild","severe","mild","severe"],\n        "survived":[800,200,900,400], "total":[900,300,950,500]}\ndf = pd.DataFrame(data)\ndf["rate"] = df["survived"] / df["total"]\nagg = df.groupby("hospital")[["survived","total"]].sum()\nagg["rate"] = agg["survived"] / agg["total"]\nprint("Aggregate:"); print(agg["rate"].round(3))\nprint("\\nBy severity:")\nprint(df.pivot(index="severity", columns="hospital", values="rate").round(3))\n\nrng = np.random.default_rng(42)\npvals = [ttest_ind(rng.normal(0,1,100), rng.normal(0,1,100)).pvalue for _ in range(20)]\nreject_bh, *_ = multipletests(pvals, method="fdr_bh")[:2]\nprint(f"\\nRaw α=0.05 rejections : {sum(p<0.05 for p in pvals)}/20")\nprint(f"BH FDR rejections      : {sum(reject_bh)}/20")\n',
	},
	{
		name: "Slowly Changing Dimensions (SCD)",
		tags: ["Data Engineer", "Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"Techniques for tracking how dimensional attribute values change over time in a data warehouse.",
		formula:
			"SCD Type 1: Overwrite old value (no history)\nSCD Type 2: New row per change  (full history)\nSCD Type 3: Add column for previous value (limited history)",
		description:
			"- **Type 1**: simple, no history — use for corrections\n- **Type 2**: add effective_date, expiry_date, is_current — full history, most common\n- **Type 3**: one previous value only — rare",
		example:
			"Customer moves city: Type 2 closes old row (expiry=today), inserts new row (city=Manila, is_current=True).",
		useCases: [
			"Customer address tracking",
			"Product price history",
			"Employee role changes",
			"dbt snapshots",
		],
		watchOut:
			"Type 2 tables grow large and complicate queries. Always add a surrogate key and is_current flag.",
		code: 'import pandas as pd\nfrom datetime import date\n\nexisting = pd.DataFrame({\n    "surrogate_key":  [1],\n    "customer_id":    [101],\n    "city":           ["Cebu"],\n    "effective_date": [date(2023, 1, 1)],\n    "expiry_date":    [date(9999, 12, 31)],\n    "is_current":     [True],\n})\n\ndef scd2_update(df, customer_id, new_city, change_date):\n    df = df.copy()\n    mask = (df["customer_id"] == customer_id) & (df["is_current"])\n    df.loc[mask, "expiry_date"] = change_date\n    df.loc[mask, "is_current"]  = False\n    new_row = {"surrogate_key": df["surrogate_key"].max() + 1,\n               "customer_id": customer_id, "city": new_city,\n               "effective_date": change_date,\n               "expiry_date": date(9999, 12, 31), "is_current": True}\n    return pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)\n\nresult = scd2_update(existing, 101, "Manila", date(2024, 6, 1))\nprint(result)\n',
	},
	{
		name: "Entropy & Information Gain",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"Entropy measures impurity of a dataset. Information Gain measures how much a feature reduces entropy after a split.",
		formula:
			"H(S) = −Σ pᵢ × log₂(pᵢ)\n\nIG(S,A) = H(S) − Σ (|Sᵥ|/|S|) × H(Sᵥ)\n\nH = 0  → pure (all one class)\nH = 1  → maximum disorder (50/50)",
		description:
			"Decision tree algorithms (ID3, C4.5) greedily choose splits that maximize information gain, reducing entropy toward 0 at each node.",
		example:
			"50% spam, 50% not → H=1.0. After splitting on 'contains FREE': 90% spam | 10% spam → large IG → good split.",
		useCases: [
			"Decision tree feature selection",
			"Random forest variable importance",
			"Text classification",
			"Feature ranking",
		],
		watchOut:
			"IG favors features with many unique values (like IDs). Use Gain Ratio (C4.5) or Gini impurity (CART) to correct.",
		code: 'import numpy as np\nfrom scipy.stats import entropy\nfrom sklearn.tree import DecisionTreeClassifier, export_text\nfrom sklearn.feature_selection import mutual_info_classif\nfrom sklearn.datasets import load_iris\n\ndef calc_entropy(labels):\n    _, counts = np.unique(labels, return_counts=True)\n    return entropy(counts / counts.sum(), base=2)\n\nprint(f"Mixed : {calc_entropy(np.array([0]*50+[1]*50)):.4f}")\nprint(f"Pure  : {calc_entropy(np.array([0]*100)):.4f}")\n\niris = load_iris()\ndt = DecisionTreeClassifier(criterion="entropy", max_depth=3, random_state=42)\ndt.fit(iris.data, iris.target)\nfor feat, imp in zip(iris.feature_names, dt.feature_importances_):\n    print(f"{feat}: {imp:.4f}")\n',
	},
	{
		name: "Bias–Variance Tradeoff",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"The fundamental ML tension between a model too simple to capture patterns (high bias) and one too complex that memorizes noise (high variance).",
		formula:
			"Total Error = Bias² + Variance + Irreducible Noise\n\nHigh Bias:     train error ≈ test error (both high)\nHigh Variance: train error << test error",
		description:
			"| | High Bias | High Variance |\n|---|---|---|\n| Also called | Underfitting | Overfitting |\n| Train error | High | Low |\n| Test error | High | High |\n| Fix | More complexity | Regularization / more data |",
		example:
			"Decision tree depth=1: underfits. Depth=30: memorizes. Optimal depth (5–7) balances both.",
		useCases: [
			"Model selection",
			"Hyperparameter tuning",
			"Diagnosing train vs validation gaps",
		],
		watchOut:
			"More data reduces variance but NOT bias. If underfitting, more data won't help — increase model capacity.",
		code: 'import numpy as np\nfrom sklearn.tree import DecisionTreeClassifier\nfrom sklearn.model_selection import validation_curve\nfrom sklearn.datasets import make_classification\n\nX, y = make_classification(n_samples=1_000, n_features=20, random_state=42, n_informative=10)\ndepths = np.arange(1, 20)\ntrain_s, val_s = validation_curve(\n    DecisionTreeClassifier(random_state=42), X, y,\n    param_name="max_depth", param_range=depths, cv=5, scoring="accuracy")\n\nfor d, tr, vl in zip(depths, train_s.mean(axis=1), val_s.mean(axis=1)):\n    if d in [1, 5, 10, 15, 19]:\n        print(f"depth={d:2d}  train={tr:.3f}  val={vl:.3f}")\n',
	},
	{
		name: "Cross-Validation",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"A technique to estimate model generalization by training and testing on multiple non-overlapping splits of the data.",
		formula:
			"k-Fold CV Score = (1/k) × Σ score(fold_i)\n\nReport: mean ± std across folds",
		description:
			"Stratified k-Fold preserves class balance in each fold — essential for imbalanced datasets. Nested CV is used for simultaneous hyperparameter tuning and evaluation.",
		example:
			"5-fold CV: [0.82, 0.85, 0.81, 0.84, 0.83] → CV = <strong>0.83 ± 0.015</strong>. Far more reliable than one split.",
		useCases: [
			"Model selection and comparison",
			"Hyperparameter tuning (nested CV)",
			"Performance estimation before deployment",
		],
		watchOut:
			"Data leakage through CV is critical: preprocessing must be fit INSIDE each fold, never on the full dataset.",
		code: 'from sklearn.datasets import make_classification\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import cross_validate, StratifiedKFold\n\nX, y = make_classification(n_samples=1_000, n_features=20, random_state=42, n_informative=10)\npipe = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression(max_iter=1_000))])\nskf  = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)\nres  = cross_validate(pipe, X, y, cv=skf,\n                      scoring=["accuracy","roc_auc","f1"],\n                      return_train_score=True)\nfor m in ["test_accuracy","test_roc_auc","test_f1"]:\n    print(f"{m}: {res[m].mean():.4f} ± {res[m].std():.4f}")\n',
	},
	{
		name: "Regularization (L1 & L2)",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"A penalty added to the loss function to discourage large coefficients, reducing overfitting by constraining model complexity.",
		formula:
			"L1 (Lasso):  Loss = MSE + λ × Σ|βᵢ|\nL2 (Ridge):  Loss = MSE + λ × Σβᵢ²\nElastic Net: Loss = MSE + λ₁Σ|βᵢ| + λ₂Σβᵢ²",
		description:
			"| | L1 (Lasso) | L2 (Ridge) |\n|--|--|--|\n| Effect | Zeros some coefficients | Shrinks all toward 0 |\n| Result | Sparse model (feature selection) | Dense model |\n| Use when | Many irrelevant features | All features contribute |",
		example:
			"With 100 features, Lasso (λ=0.1) zeros out 80 — automatic feature selection, leaving 20 predictors.",
		useCases: [
			"Preventing overfitting",
			"Automatic feature selection (L1)",
			"Neural network weight decay (L2)",
			"High-dimensional datasets",
		],
		watchOut:
			"λ is critical. Too high → underfitting. Too low → no regularization. Use LassoCV/RidgeCV for auto-tuning.",
		code: 'from sklearn.linear_model import Lasso, Ridge, ElasticNet, LassoCV\nfrom sklearn.datasets import make_regression\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.metrics import r2_score\n\nX, y = make_regression(n_samples=500, n_features=100, n_informative=20, noise=30, random_state=42)\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\nsc = StandardScaler()\nX_tr = sc.fit_transform(X_tr); X_te = sc.transform(X_te)\n\nfor name, model in [("Lasso", Lasso(0.5)), ("Ridge", Ridge(1.0)), ("ElasticNet", ElasticNet(0.5, l1_ratio=0.5))]:\n    model.fit(X_tr, y_tr)\n    print(f"{name:12s}  R²={(r2_score(y_te, model.predict(X_te))):.4f}  zeros={(model.coef_==0).sum()}/100")\n\nlcv = LassoCV(cv=5, random_state=42).fit(X_tr, y_tr)\nprint(f"LassoCV best α={lcv.alpha_:.4f}  active={(lcv.coef_!=0).sum()}/100")\n',
	},
	{
		name: "Gradient Descent",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"An iterative optimization algorithm that minimizes a loss function by updating parameters in the direction of the steepest negative gradient.",
		formula:
			"θ := θ − α × ∇J(θ)\n\nα     = learning rate\n∇J(θ) = gradient of loss w.r.t. θ\n\nAdam: adaptive per-parameter learning rates",
		description:
			"| Variant | Data/step | Pros | Cons |\n|---------|-----------|------|------|\n| Batch GD | All data | Stable convergence | Slow on large data |\n| SGD | 1 sample | Fast updates | Very noisy |\n| Mini-batch | 32–512 | Best of both | Needs tuning |",
		example:
			"In linear regression, gradient descent iteratively adjusts weights proportional to prediction error.",
		useCases: [
			"Training neural networks",
			"Logistic regression optimization",
			"Any differentiable loss minimization",
		],
		watchOut:
			"Learning rate α is critical. Too large → diverge. Too small → slow convergence. Use schedulers in production.",
		code: 'import numpy as np\n\nrng = np.random.default_rng(42)\nX = rng.uniform(0, 10, (200, 1))\ny = 3 * X.flatten() + 7 + rng.normal(0, 1, 200)\n\nX_b   = np.c_[np.ones(len(X)), X]\ntheta = np.zeros(2)\nalpha = 0.01\nlosses = []\n\nfor epoch in range(300):\n    error = X_b @ theta - y\n    theta -= alpha * (2 / len(y)) * X_b.T @ error\n    losses.append((error**2).mean())\n\nprint(f"Learned: intercept={theta[0]:.3f}, slope={theta[1]:.3f}")\nprint(f"True:    intercept=7.000, slope=3.000")\nprint(f"Final MSE loss: {losses[-1]:.4f}")\n',
	},
	{
		name: "Confusion Matrix & Classification Metrics",
		tags: ["Data Scientist", "Analytics Engineer"],
		difficulty: "Expert",
		definition:
			"A confusion matrix summarizes classifier performance by comparing actual vs. predicted labels across all classes.",
		formula:
			"Accuracy  = (TP+TN) / (TP+TN+FP+FN)\nPrecision = TP / (TP+FP)\nRecall    = TP / (TP+FN)\nF1        = 2×(P×R) / (P+R)\nMCC       = (TP×TN−FP×FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN))",
		description:
			"- **Precision**: of predicted positives, how many are correct?\n- **Recall**: of actual positives, how many caught?\n- **F1**: harmonic mean, balances precision and recall\n- **AUC-ROC**: discriminative ability across all thresholds\n- **MCC**: best single metric for imbalanced classes",
		example:
			"Fraud detection: missing fraud (FN) is costly → maximize Recall. Spam filter: FP deletes real emails → maximize Precision.",
		useCases: [
			"Model evaluation",
			"Threshold selection",
			"Class imbalance analysis",
		],
		watchOut:
			"Accuracy is useless for imbalanced classes. A model always predicting 'no fraud' gets 99% accuracy on 1% fraud data.",
		code: 'from sklearn.datasets import make_classification\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import (classification_report, roc_auc_score,\n                              matthews_corrcoef, roc_curve)\n\nX, y = make_classification(n_samples=2_000, weights=[0.9, 0.1], random_state=42)\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\n\nclf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42)\nclf.fit(X_tr, y_tr)\ny_pred = clf.predict(X_te)\ny_prob = clf.predict_proba(X_te)[:, 1]\n\nprint(classification_report(y_te, y_pred))\nprint(f"AUC-ROC : {roc_auc_score(y_te, y_prob):.4f}")\nprint(f"MCC     : {matthews_corrcoef(y_te, y_pred):.4f}")\n',
	},
	{
		name: "Dimensionality Reduction (PCA, t-SNE, UMAP)",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"Techniques to reduce features while preserving important structure, relationships, or variance in the data.",
		formula:
			"PCA: Eigendecompose covariance matrix\nExplained Variance Ratio = λ_k / Σλ\n\nt-SNE minimizes KL divergence between\nhigh-dim and low-dim distributions",
		description:
			"| Method | Type | Preserves | Speed | Use For |\n|--------|------|-----------|-------|---------|\n| PCA | Linear | Global variance | Fast | Preprocessing |\n| t-SNE | Non-linear | Local clusters | Slow | 2D/3D viz |\n| UMAP | Non-linear | Local + global | Moderate | Viz + ML |",
		example:
			"100-feature dataset → 10 PCA components explain 95% variance → train on 10, less overfitting, faster.",
		useCases: [
			"Visualization of high-dimensional data",
			"Noise reduction before modeling",
			"Feature extraction",
			"Genomics and NLP embeddings",
		],
		watchOut:
			"t-SNE axes carry no meaning and inter-cluster distances are unreliable. Never use t-SNE output as ML input features.",
		code: 'import numpy as np\nfrom sklearn.decomposition import PCA\nfrom sklearn.manifold import TSNE\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.datasets import load_digits\n\ndigits = load_digits()\nX_s    = StandardScaler().fit_transform(digits.data)\n\npca    = PCA().fit(X_s)\ncumvar = np.cumsum(pca.explained_variance_ratio_)\nn_95   = np.searchsorted(cumvar, 0.95) + 1\nprint(f"Components for 95% variance: {n_95}")\n\nX_pca = PCA(n_components=n_95).fit_transform(X_s)\nprint(f"Reduced shape: {X_pca.shape}")\n\nX_2d = TSNE(n_components=2, random_state=42, perplexity=30).fit_transform(X_s)\nprint(f"t-SNE shape: {X_2d.shape}")\n',
	},
	{
		name: "Loss Functions",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"A function quantifying the gap between model predictions and actual values — the objective minimized during training.",
		formula:
			"MSE      = (1/n) × Σ(yᵢ − ŷᵢ)²\nMAE      = (1/n) × Σ|yᵢ − ŷᵢ|\nHuber    = MSE if |e|≤δ, else δ(|e|−δ/2)\nLog Loss = −(1/n) × Σ[y·log(ŷ) + (1−y)·log(1−ŷ)]",
		description:
			"| Loss | Outlier Sensitive | Task |\n|------|-------------------|------|\n| MSE | Yes (squares errors) | Regression |\n| MAE | No | Regression |\n| Huber | No | Robust regression |\n| Log Loss | — | Binary classification |\n| Cross-entropy | — | Multi-class |",
		example:
			"House prices with $2M outlier: MSE penalizes it 4× more than MAE. Use Huber when outliers are expected.",
		useCases: [
			"Training all supervised ML",
			"Custom business-constrained objectives",
			"Model evaluation",
		],
		watchOut:
			"Log loss heavily penalizes confident wrong predictions. Miscalibrated models need Platt scaling or isotonic regression.",
		code: 'import numpy as np\nfrom sklearn.metrics import mean_squared_error, mean_absolute_error, log_loss\n\nrng = np.random.default_rng(42)\ny_true = rng.normal(100, 20, 200)\ny_pred = y_true + rng.normal(0, 10, 200)\ny_pred_out = y_pred.copy(); y_pred_out[0] = 500\n\nprint(f"MSE  (clean)  : {mean_squared_error(y_true, y_pred):.2f}")\nprint(f"MSE  (outlier): {mean_squared_error(y_true, y_pred_out):.2f}")\nprint(f"MAE  (clean)  : {mean_absolute_error(y_true, y_pred):.2f}")\nprint(f"MAE  (outlier): {mean_absolute_error(y_true, y_pred_out):.2f}")\n\ndef huber(y, yh, d=10):\n    e = y - yh\n    return np.where(np.abs(e)<=d, 0.5*e**2, d*(np.abs(e)-0.5*d)).mean()\nprint(f"Huber (outlier): {huber(y_true, y_pred_out):.2f}")\n\ny_cls  = np.array([0, 0, 1, 1, 1])\ny_prob = np.array([0.1, 0.2, 0.8, 0.9, 0.7])\nprint(f"Log Loss: {log_loss(y_cls, y_prob):.4f}")\n',
	},
	{
		name: "Feature Engineering & Encoding",
		tags: ["Data Scientist", "Analytics Engineer"],
		difficulty: "Expert",
		definition:
			"Transforming raw data into informative, model-ready features that improve predictive performance.",
		formula:
			"Min-Max:       x' = (x − min) / (max − min)\nZ-score:       x' = (x − μ) / σ\nLog transform: x' = log(x + 1)",
		description:
			"**Encoding:** One-hot (nominal, low cardinality), Label (ordinal only), Target encoding (leakage risk), Frequency encoding.\n**Transforms:** Log (right skew), Polynomial (non-linear), Binning (continuous → ordinal).",
		example:
			"City with 50 unique values → target encoding replaces each city with its historical conversion rate — must be computed inside CV folds.",
		useCases: [
			"All supervised ML pipelines",
			"Reducing cardinality in tree models",
			"NLP preprocessing",
		],
		watchOut:
			"Target encoding leaks label info. Always compute inside CV folds using only training data — never on full dataset before splitting.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.preprocessing import StandardScaler, OneHotEncoder\nfrom sklearn.compose import ColumnTransformer\nfrom sklearn.pipeline import Pipeline\n\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({\n    "revenue":   rng.exponential(1_000, 500),\n    "city":      rng.choice(["Manila","Davao","Cebu"], 500),\n    "logins":    rng.integers(0, 100, 500),\n    "converted": rng.binomial(1, 0.3, 500),\n})\ndf["log_revenue"] = np.log1p(df["revenue"])\ndf["city_freq"]   = df["city"].map(df["city"].value_counts())\n\npreprocessor = ColumnTransformer([\n    ("num", StandardScaler(), ["logins", "log_revenue"]),\n    ("cat", OneHotEncoder(drop="first", sparse_output=False), ["city"]),\n])\nX = preprocessor.fit_transform(df.drop(columns="converted"))\nprint(f"Transformed shape: {X.shape}")\n',
	},
	{
		name: "Class Imbalance Techniques",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"Methods to handle datasets where one class significantly outnumbers another, biasing models toward the majority class.",
		formula:
			"SMOTE: interpolate between k-nearest minority neighbors\n\nClass weight:\n  w_minority = n_total / (2 × n_minority)\n  w_majority = n_total / (2 × n_majority)",
		description:
			"| Approach | Method | When |\n|----------|--------|------|\n| Data-level | SMOTE oversampling | Moderate imbalance |\n| Data-level | Undersampling | Very large majority |\n| Algorithm | Class weighting | Most sklearn classifiers |\n| Threshold | Adjust decision cutoff | Tune precision/recall |",
		example:
			"Fraud: 99% non-fraud. Always predicting 'no fraud' → 99% accuracy, 0% recall. Apply 1:99 weights → recall improves.",
		useCases: [
			"Fraud detection",
			"Medical diagnosis",
			"Rare event prediction",
			"Anomaly detection",
		],
		watchOut:
			"SMOTE creates synthetic points that may not reflect real data. Never oversample the test set — only inside training folds.",
		code: 'import numpy as np\nfrom sklearn.datasets import make_classification\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import classification_report\n# pip install imbalanced-learn\nfrom imblearn.over_sampling import SMOTE\nfrom imblearn.pipeline import Pipeline as ImbPipeline\n\nX, y = make_classification(n_samples=5_000, weights=[0.97, 0.03], random_state=42)\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, stratify=y, test_size=0.2, random_state=42)\n\n# Baseline\nbase = LogisticRegression(max_iter=1_000).fit(X_tr, y_tr)\nprint("Baseline:"); print(classification_report(y_te, base.predict(X_te), digits=3))\n\n# SMOTE pipeline\npipe = ImbPipeline([("smote", SMOTE(random_state=42)),\n                    ("clf", LogisticRegression(max_iter=1_000))])\npipe.fit(X_tr, y_tr)\nprint("SMOTE:"); print(classification_report(y_te, pipe.predict(X_te), digits=3))\n',
	},
	{
		name: "Bayesian vs Frequentist Statistics",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"Two frameworks for statistical inference differing in how probability is defined and how unknown parameters are treated.",
		formula:
			"Frequentist: P(data | hypothesis) → p-value\n\nBayesian: P(hypothesis | data) ∝ P(data|H) × P(H)\n          posterior ∝ likelihood × prior",
		description:
			"| | Frequentist | Bayesian |\n|---|---|---|\n| Probability | Long-run frequency | Degree of belief |\n| Parameters | Fixed, unknown | Random, have distributions |\n| Output | p-values, CIs | Posterior distributions |\n| Prior knowledge | Not incorporated | Explicitly used |",
		example:
			"Bayesian A/B: 'P(B > A) = 94%' — directly interpretable for business. No need for fixed sample size.",
		useCases: [
			"A/B testing with small samples",
			"Incremental model updating",
			"Spam filtering (Naive Bayes)",
			"Medical decisions",
		],
		watchOut:
			"Results depend on the prior. Document prior assumptions explicitly and test sensitivity to prior choice.",
		code: 'import numpy as np\nfrom scipy import stats\nfrom statsmodels.stats.proportion import proportions_ztest\n\nrng = np.random.default_rng(42)\nn = 1_000\nctrl = rng.binomial(1, 0.05, n)\nvar  = rng.binomial(1, 0.07, n)\n\nz, p = proportions_ztest([var.sum(), ctrl.sum()], [n, n])\nprint(f"Frequentist p-value: {p:.4f}")\n\na_ctrl = 1 + ctrl.sum(); b_ctrl = 1 + (n - ctrl.sum())\na_var  = 1 + var.sum();  b_var  = 1 + (n - var.sum())\n\ns_ctrl = stats.beta.rvs(a_ctrl, b_ctrl, size=100_000, random_state=42)\ns_var  = stats.beta.rvs(a_var,  b_var,  size=100_000, random_state=42)\nprob   = (s_var > s_ctrl).mean()\nprint(f"Bayesian P(variant > control) = {prob*100:.1f}%")\n',
	},
	{
		name: "Monte Carlo Simulation",
		tags: ["Data Scientist", "Data Analyst"],
		difficulty: "Expert",
		definition:
			"A technique using repeated random sampling to estimate the probability distribution of outcomes with uncertain inputs.",
		formula:
			"E[f(X)] ≈ (1/N) × Σ f(xᵢ)  where xᵢ ~ P(X)\n\nLaw of Large Numbers: estimate → true value as N → ∞",
		description:
			"**Steps:** Define input distributions → Sample N times (10,000+) → Compute output each iteration → Analyze output distribution (mean, CI, P(loss)).",
		example:
			"Revenue ~ N($500K,$50K), cost ~ N($400K,$40K). 100K simulations → P(profit>0)=89%, median=$95K.",
		useCases: [
			"Financial risk (VaR)",
			"Supply chain scenario planning",
			"Option pricing",
			"Project timeline estimation",
		],
		watchOut:
			"Results are only as good as input distributions — garbage in, garbage out. Always run sensitivity analysis.",
		code: 'import numpy as np\n\nrng = np.random.default_rng(42)\nN = 100_000\nrevenue = rng.normal(500_000, 50_000, N)\ncost    = rng.normal(400_000, 40_000, N)\nprofit  = revenue - cost\n\nprint(f"P(profit > 0)  : {(profit > 0).mean()*100:.1f}%")\nprint(f"Median profit  : ${np.median(profit):,.0f}")\nprint(f"5th percentile : ${np.percentile(profit, 5):,.0f}  (worst-case / VaR)")\nprint(f"95% CI         : ${np.percentile(profit, 2.5):,.0f} – ${np.percentile(profit, 97.5):,.0f}")\n\ncorr_rev = np.corrcoef(revenue, profit)[0,1]\ncorr_cst = np.corrcoef(cost, profit)[0,1]\nprint(f"Revenue sensitivity: {corr_rev:.3f}")\nprint(f"Cost sensitivity   : {corr_cst:.3f}")\n',
	},
	{
		name: "Stream Processing Concepts",
		tags: ["Data Engineer"],
		difficulty: "Expert",
		definition:
			"Processing data records continuously as they arrive, enabling low-latency analytics and real-time pipelines.",
		formula:
			"Tumbling window: fixed, non-overlapping intervals\nSliding window:  fixed size, slides by step\nSession window:  gaps in activity define boundaries",
		description:
			"**Key concepts:** Watermarks (late data handling), Exactly-once semantics, Backpressure, State stores.\n\n**Tools:** Apache Kafka, Apache Flink, Spark Structured Streaming, AWS Kinesis.",
		example:
			"Count page views per user per 5-minute tumbling window → alert if views > 1000 (bot detection).",
		useCases: [
			"Real-time dashboards",
			"Fraud detection pipelines",
			"IoT sensor processing",
			"Event-driven architectures",
		],
		watchOut:
			"Out-of-order events and late data are the #1 challenge. Always define watermark policies and test with delayed records.",
		code: 'import pandas as pd\n\nevents = pd.DataFrame({\n    "user_id":    [1,1,2,1,2,2,1],\n    "event_time": pd.to_datetime([\n        "2024-01-01 10:00:01","2024-01-01 10:02:30",\n        "2024-01-01 10:03:00","2024-01-01 10:06:00",\n        "2024-01-01 10:07:00","2024-01-01 10:08:00",\n        "2024-01-01 10:11:00",\n    ]),\n    "value": [1,1,1,1,1,1,1],\n})\n\n# 5-minute tumbling window aggregation\nevents = events.set_index("event_time").sort_index()\nresult = (events.groupby("user_id")\n          .resample("5min")["value"].sum().reset_index())\nresult.columns = ["user_id","window_start","event_count"]\nresult["window_end"] = result["window_start"] + pd.Timedelta(minutes=5)\nprint(result)\n\n# Equivalent Spark Structured Streaming:\n# df.groupBy("user_id", window("event_time", "5 minutes")).count()\n',
	},
	{
		name: "Graph Metrics & Network Analysis",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Expert",
		definition:
			"Mathematical measures describing properties of nodes and edges in a network to find influential nodes, communities, and paths.",
		formula:
			"Degree Centrality     = degree(v) / (n−1)\nBetweenness          = Σ σ(s,t|v) / σ(s,t)\nPageRank             = (1−d)/n + d × Σ (PR(u)/L(u))\nClustering Coeff     = 2×triangles / (degree×(degree−1))",
		description:
			"**Key metrics:** Degree (connections), Betweenness (bridge importance), Closeness (reach), PageRank (influence), Clustering coefficient (local density).",
		example:
			"High betweenness user bridges two communities — removing them disconnects the network (critical node).",
		useCases: [
			"Fraud ring detection",
			"Recommendation systems",
			"Supply chain mapping",
			"Social influence analysis",
		],
		watchOut:
			"PageRank assumes a random surfer model. Betweenness is O(n³) — expensive on large graphs. Use approximations.",
		code: '# pip install networkx\nimport networkx as nx\n\nG = nx.karate_club_graph()\nprint(f"Nodes: {G.number_of_nodes()}  Edges: {G.number_of_edges()}")\n\ndegree_cent  = nx.degree_centrality(G)\nbetween_cent = nx.betweenness_centrality(G)\npagerank     = nx.pagerank(G, alpha=0.85)\n\ntop3 = lambda d: sorted(d.items(), key=lambda x: -x[1])[:3]\nprint("Top degree      :", top3(degree_cent))\nprint("Top betweenness :", top3(between_cent))\nprint("Top PageRank    :", top3(pagerank))\nprint(f"Avg clustering  : {nx.average_clustering(G):.4f}")\nprint(f"Diameter        : {nx.diameter(G)}")\n',
	},
	{
		name: "Vector Embeddings & Similarity Search",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Expert",
		definition:
			"Representing objects (text, images, users) as dense numerical vectors where semantic similarity maps to geometric proximity.",
		formula:
			"Cosine Similarity = (A · B) / (|A| × |B|)\nEuclidean Distance = √Σ(aᵢ − bᵢ)²\nDot Product        = Σ aᵢ × bᵢ",
		description:
			"**Vector DBs:** Pinecone, Weaviate, pgvector, Chroma, Qdrant.\n\nUsed in RAG (Retrieval-Augmented Generation), semantic search, and recommendations.",
		example:
			"User embedding vs product embedding → cosine sim = 0.98 → recommend product.",
		useCases: [
			"Semantic search",
			"Recommendation systems",
			"RAG pipelines",
			"Duplicate detection",
		],
		watchOut:
			"Cosine similarity ignores magnitude. Two vectors can be 'similar' in direction but very different in scale. Use dot product when magnitude matters.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.metrics.pairwise import cosine_similarity\n\nrng = np.random.default_rng(42)\nembeddings = rng.normal(0, 1, (5, 64))\nlabels = ["product_A","product_B","user_1","product_C","user_2"]\n\ncos_sim = cosine_similarity(embeddings)\nprint("Cosine similarity matrix:")\nprint(pd.DataFrame(cos_sim, index=labels, columns=labels).round(3))\n\nquery = embeddings[2]  # user_1\nsims  = cosine_similarity([query], embeddings)[0]\nranked = sorted(zip(labels, sims), key=lambda x: -x[1])\nprint("\\nRanked similarity to user_1:")\nfor name, score in ranked:\n    print(f"  {name}: {score:.4f}")\n',
	},
	{
		name: "Cumulative Distribution Functions (CDF)",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"The CDF gives the probability that a random variable X takes a value less than or equal to x: F(x) = P(X ≤ x).",
		formula:
			"F(x) = P(X ≤ x)\n\nFor discrete: F(x) = Σ P(X = xᵢ) for all xᵢ ≤ x\nFor continuous: F(x) = ∫ f(t) dt from −∞ to x\n\nPercentile: x at which F(x) = p",
		description:
			"The CDF answers: 'what fraction of observations fall below this value?' It's the cumulative version of the PDF/PMF. The inverse CDF (quantile function) answers: 'below what value do X% of observations fall?'",
		example:
			"Page load times: CDF(2s) = 0.80 → 80% of users experience load times under 2 seconds. P90 = 3.5s means 90% of users load in under 3.5s.",
		useCases: [
			"SLA and percentile reporting (P50, P95, P99)",
			"Setting thresholds for alerting",
			"Comparing distributions visually",
			"Risk exceedance curves",
		],
		watchOut:
			"CDFs look smooth but hide multi-modality. Always plot the PDF/histogram alongside the CDF to reveal shape.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\nload_times = rng.exponential(scale=1.5, size=10_000)\n\nfor p in [50, 75, 90, 95, 99]:\n    print(f"P{p:2d}: {np.percentile(load_times, p):.3f}s")\n\npct_under_2s = (load_times < 2).mean() * 100\nprint(f"\\n% under 2s: {pct_under_2s:.1f}%")\n\nfitted = stats.expon.fit(load_times, floc=0)\ncdf_val = stats.expon.cdf(2.0, *fitted)\nprint(f"Theoretical CDF(2s): {cdf_val:.4f}")\n\necdf_x = np.sort(load_times)\necdf_y = np.arange(1, len(load_times) + 1) / len(load_times)\nidx = np.searchsorted(ecdf_x, 2.0)\nprint(f"Empirical CDF(2s)  : {ecdf_y[idx]:.4f}")\n',
	},
	{
		name: "Pivot Tables & Cross-tabulation",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"A pivot table reshapes data from long to wide format, aggregating values at the intersection of row and column categories.",
		formula:
			"Cell value = AGGREGATE(metric)\n  where row ∈ row_group AND col ∈ col_group\n\nChi-square test of independence:\n  χ² = Σ (O − E)² / E",
		description:
			"Pivot tables are the analyst's workhorse for cross-dimensional summaries. Cross-tabulation counts occurrences at group intersections — the raw material for chi-square independence tests.",
		example:
			"Rows = acquisition channel, Cols = subscription plan, Values = count of users → reveals which channel drives the highest-value plan.",
		useCases: [
			"Channel × plan conversion analysis",
			"Region × product revenue breakdowns",
			"Cohort × week retention heatmaps",
			"Survey response cross-tabs",
		],
		watchOut:
			"Pivot tables hide sample sizes inside cells. A 100% conversion rate from 1 user is noise, not signal — always expose n.",
		code: 'import pandas as pd\nimport numpy as np\nfrom scipy.stats import chi2_contingency\n\nrng = np.random.default_rng(42)\nn = 2_000\ndf = pd.DataFrame({\n    "channel": rng.choice(["organic","paid","referral"], n, p=[0.5,0.3,0.2]),\n    "plan":    rng.choice(["free","pro","enterprise"], n, p=[0.65,0.25,0.10]),\n    "revenue": rng.exponential(100, n),\n})\n\npivot_count = pd.pivot_table(df, values="revenue", index="channel",\n                              columns="plan", aggfunc="count", fill_value=0)\nprint("Count pivot:")\nprint(pivot_count)\n\npivot_rev = pd.pivot_table(df, values="revenue", index="channel",\n                            columns="plan", aggfunc="mean").round(2)\nprint("\\nMean revenue pivot:")\nprint(pivot_rev)\n\nct = pd.crosstab(df["channel"], df["plan"])\nchi2, p, dof, expected = chi2_contingency(ct)\nprint(f"\\nChi-square: {chi2:.3f}  p={p:.4f}  dof={dof}")\nprint("Channel and plan are NOT independent" if p < 0.05 else "No significant association")\n',
	},
	{
		name: "Moving Averages (SMA, EMA, WMA)",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"Moving averages smooth time series by averaging over a rolling window, suppressing noise to reveal underlying trends.",
		formula:
			"SMA(k) = (1/k) × Σ yᵢ  [last k periods]\n\nEMA(t)  = α × y(t) + (1−α) × EMA(t−1)\n  where α = 2 / (k+1)\n\nWMA(k) = Σ(wᵢ × yᵢ) / Σwᵢ  [recent points heavier]",
		description:
			"| Type | Lag | Responds To | Best For |\n|------|-----|-------------|----------|\n| SMA | High | Slow trend | Long-term smoothing |\n| EMA | Low | Recent changes | Reactive dashboards |\n| WMA | Medium | Weighted recency | Custom emphasis |",
		example:
			"7-day SMA on daily revenue: weekend spikes disappear, underlying weekly growth trend becomes visible.",
		useCases: [
			"Daily KPI dashboards",
			"Trend line overlays",
			"Signal denoising",
			"Technical analysis (finance)",
		],
		watchOut:
			"SMA introduces significant lag — it trails the actual series. EMA responds faster but is noisier. Choose window based on business cycle, not personal preference.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\ndates = pd.date_range("2024-01-01", periods=90, freq="D")\nrevenue = pd.Series(\n    np.linspace(100, 200, 90) + 30 * np.sin(np.arange(90) * 2 * np.pi / 7)\n    + rng.normal(0, 10, 90),\n    index=dates, name="revenue"\n)\n\ndf = revenue.to_frame()\ndf["SMA_7"]  = revenue.rolling(7).mean()\ndf["SMA_14"] = revenue.rolling(14).mean()\ndf["EMA_7"]  = revenue.ewm(span=7, adjust=False).mean()\n\nweights = np.arange(1, 8)\ndf["WMA_7"] = revenue.rolling(7).apply(\n    lambda x: np.dot(x, weights) / weights.sum(), raw=True\n)\n\nprint(df.tail(10).round(2))\nprint(f"\\nSMA lag vs EMA lag (last 7 days):")\nprint(f"  SMA vs raw: {(df[\'SMA_7\'] - df[\'revenue\']).tail(7).abs().mean():.2f}")\nprint(f"  EMA vs raw: {(df[\'EMA_7\'] - df[\'revenue\']).tail(7).abs().mean():.2f}")\n',
	},
	{
		name: "Outlier Detection Methods",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Systematic approaches to identifying observations that deviate significantly from expected patterns, either through statistical rules or machine learning.",
		formula:
			"IQR Method:   outlier if x < Q1 − 1.5×IQR or x > Q3 + 1.5×IQR\nModified Z:   Mz = 0.6745 × (x − median) / MAD\n              outlier if |Mz| > 3.5\nIsolation Forest: anomaly score ≈ 2^(−E[h(x)]/c(n))",
		description:
			"| Method | Assumption | Handles Multivariate? | Notes |\n|--------|------------|-----------------------|-------|\n| IQR | Symmetric | No | Simple, robust |\n| Z-score | Normal | No | Sensitive to extreme outliers |\n| Modified Z | Non-normal | No | Uses median/MAD |\n| Isolation Forest | None | Yes | ML-based, scalable |",
		example:
			"Revenue column: IQR fence = [$0, $2,400]. Orders above $2,400 flagged for manual review — catches data entry errors and fraud.",
		useCases: [
			"Data quality checks in pipelines",
			"Fraud signal detection",
			"Sensor anomaly detection",
			"Pre-modeling data cleaning",
		],
		watchOut:
			"Masking: one large outlier inflates the mean/std, making other outliers look normal. Always use robust statistics (median/MAD) first.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\nfrom sklearn.ensemble import IsolationForest\n\nrng = np.random.default_rng(42)\ndata = np.concatenate([rng.normal(100, 15, 200), [250, 280, -30, 500]])\n\ndef iqr_outliers(x):\n    q1, q3 = np.percentile(x, [25, 75])\n    iqr = q3 - q1\n    return (x < q1 - 1.5*iqr) | (x > q3 + 1.5*iqr)\n\nmad = np.median(np.abs(data - np.median(data)))\nmodified_z = 0.6745 * (data - np.median(data)) / mad\n\nprint(f"IQR outliers       : {iqr_outliers(data).sum()}")\nprint(f"Modified Z outliers: {(np.abs(modified_z) > 3.5).sum()}")\nprint(f"Z-score outliers   : {(np.abs(stats.zscore(data)) > 3).sum()}")\n\nX = data.reshape(-1, 1)\niso = IsolationForest(contamination=0.02, random_state=42).fit(X)\niso_labels = iso.predict(X)\nprint(f"Isolation Forest   : {(iso_labels == -1).sum()} outliers")\n\ndf = pd.DataFrame({"value": data, "iqr": iqr_outliers(data),\n                   "mod_z": np.abs(modified_z) > 3.5,\n                   "iso_forest": iso_labels == -1})\nprint(df[df.any(axis=1)].head(10))\n',
	},
	{
		name: "Statistical Process Control (SPC)",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"A method using control charts to monitor process stability over time, distinguishing natural variation (common cause) from unexpected shifts (special cause).",
		formula:
			"X̄ chart (means):\n  UCL = X̄̄ + 3σ\n  LCL = X̄̄ − 3σ\n\nP chart (proportions):\n  UCL = p̄ + 3√(p̄(1−p̄)/n)\n  LCL = p̄ − 3√(p̄(1−p̄)/n)\n\nNelson Rule 1: Any point beyond ±3σ",
		description:
			"**Nelson Rules (signal = special cause):**\n- Rule 1: 1 point beyond 3σ\n- Rule 2: 9 consecutive points same side of mean\n- Rule 3: 6 points in a row trending up or down\n- Rule 4: 14 alternating up/down\n\nControl limits ≠ specification limits. One is about process behavior; the other is about customer requirements.",
		example:
			"Error rate control chart: UCL = 3.2%. Alert fires when three consecutive days exceed 2.5% (approaching UCL) — catch drift before it breaches.",
		useCases: [
			"Data pipeline error rate monitoring",
			"API latency control charts",
			"Product quality tracking",
			"Business metric anomaly detection",
		],
		watchOut:
			"Recalculate control limits after confirmed process changes. Stale limits from old baselines will either over-alert or miss real shifts.",
		code: 'import numpy as np\nimport pandas as pd\n\nrng = np.random.default_rng(42)\nn_days = 60\nerror_rate = pd.Series(\n    np.concatenate([rng.normal(0.02, 0.003, 40),\n                    rng.normal(0.035, 0.003, 20)]),  # shift at day 40\n    name="error_rate"\n)\n\nmean_rate = error_rate[:30].mean()\nstd_rate  = error_rate[:30].std()\nucl = mean_rate + 3 * std_rate\nlcl = max(0, mean_rate - 3 * std_rate)\n\nprint(f"Center line: {mean_rate:.4f}")\nprint(f"UCL: {ucl:.4f}  |  LCL: {lcl:.4f}")\n\nviolations = error_rate[error_rate > ucl]\nprint(f"\\nRule 1 violations (>{ucl:.4f}): {len(violations)} points")\nprint(violations)\n\nrun_above = (error_rate > mean_rate).rolling(9).sum() == 9\nprint(f"Rule 2 violations (9-in-a-row): {run_above.sum()} windows")\n\np_chart = pd.DataFrame({\n    "day": range(n_days),\n    "rate": error_rate,\n    "ucl": ucl,\n    "lcl": lcl,\n    "violation": error_rate > ucl,\n})\nprint(p_chart[p_chart["violation"]].head())\n',
	},
	{
		name: "Logistic Regression",
		tags: ["Data Scientist", "Data Analyst"],
		difficulty: "Intermediate",
		definition:
			"A classification model that predicts the probability of a binary outcome using the logistic (sigmoid) function, keeping predictions between 0 and 1.",
		formula:
			"log(p / (1−p)) = β₀ + β₁X₁ + β₂X₂ + ...\n\np = 1 / (1 + e^(−(β₀ + β₁X)))\n\nOdds Ratio = e^β\nlog-likelihood: ℓ = Σ[y·log(p) + (1−y)·log(1−p)]",
		description:
			"Logistic regression is the foundational binary classifier. The coefficients are in log-odds units — exponentiate to get interpretable odds ratios.\n\n- **Positive β**: feature increases probability of the positive class\n- **Odds Ratio > 1**: feature increases odds\n- **Pseudo-R²**: McFadden's R² = 1 − (ℓ_model / ℓ_null)",
		example:
			"Churn model: β(last_login_days) = 0.05 → OR = 1.051 → each additional day since login increases churn odds by 5.1%.",
		useCases: [
			"Churn prediction",
			"Credit default scoring",
			"Medical diagnosis",
			"Lead conversion probability",
		],
		watchOut:
			"Assumes linear relationship between log-odds and predictors. Check with calibration curves — a high AUC model can still be badly miscalibrated.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import classification_report, roc_auc_score\nfrom sklearn.preprocessing import StandardScaler\nimport statsmodels.api as sm\n\nrng = np.random.default_rng(42)\nn = 2_000\ndf = pd.DataFrame({\n    "days_since_login": rng.integers(0, 90, n).astype(float),\n    "sessions_month":  rng.integers(0, 30, n).astype(float),\n    "plan_pro":        rng.binomial(1, 0.3, n).astype(float),\n})\ndf["churn"] = (\n    (0.03 * df["days_since_login"]\n     - 0.05 * df["sessions_month"]\n     - 0.5 * df["plan_pro"]\n     + rng.normal(0, 1, n)) > 0\n).astype(int)\n\nX = df.drop("churn", axis=1)\ny = df["churn"]\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\n\nsc = StandardScaler()\nX_tr_s = sc.fit_transform(X_tr)\nX_te_s  = sc.transform(X_te)\n\nclf = LogisticRegression(max_iter=1_000)\nclf.fit(X_tr_s, y_tr)\nprint(classification_report(y_te, clf.predict(X_te_s)))\nprint(f"AUC-ROC: {roc_auc_score(y_te, clf.predict_proba(X_te_s)[:,1]):.4f}")\n\nX_sm = sm.add_constant(X_tr_s)\nlogit = sm.Logit(y_tr, X_sm).fit(disp=0)\nodds_ratios = np.exp(logit.params)\nprint("\\nOdds ratios:"); print(odds_ratios.round(4))\n',
	},
	{
		name: "TF-IDF & Text Vectorization",
		tags: ["Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"TF-IDF (Term Frequency–Inverse Document Frequency) weights terms by how often they appear in a document relative to how common they are across all documents.",
		formula:
			"TF(t,d)  = count(t in d) / total terms in d\nIDF(t)   = log(N / df(t))\nTF-IDF   = TF × IDF\n\nN   = total documents\ndf(t) = documents containing term t",
		description:
			"- **High TF-IDF**: term is frequent in this document but rare across the corpus — informative\n- **Low TF-IDF**: term is either rare in the doc or common everywhere (e.g., 'the', 'is') — uninformative\n\n**Pipeline:** Tokenize → remove stopwords → stem/lemmatize → vectorize → optional SVD/LSA reduction.",
		example:
			"Document about Python: 'python' has high TF-IDF; 'the' has near-zero IDF (appears everywhere).",
		useCases: [
			"Document classification",
			"Search relevance ranking",
			"Duplicate document detection",
			"Feature extraction for NLP models",
		],
		watchOut:
			"TF-IDF ignores word order and semantics. 'not good' and 'good' look similar. Use sentence transformers for semantic meaning.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer\nfrom sklearn.metrics.pairwise import cosine_similarity\n\ndocs = [\n    "python data analysis pandas numpy statistics",\n    "machine learning python scikit-learn model training",\n    "sql database query analytics warehouse bigquery",\n    "python machine learning deep learning neural network",\n    "data warehouse etl pipeline ingestion analytics",\n]\n\ntfidf = TfidfVectorizer(ngram_range=(1,2), max_features=20, stop_words="english")\nmatrix = tfidf.fit_transform(docs)\ndf = pd.DataFrame(matrix.toarray().round(3),\n                  columns=tfidf.get_feature_names_out())\nprint("TF-IDF matrix (top terms):")\nprint(df.iloc[:, :8])\n\nsim = cosine_similarity(matrix)\nprint("\\nDocument similarity matrix:")\nprint(pd.DataFrame(sim.round(3)).to_string())\n\nquery = tfidf.transform(["python analytics pipeline"])\nscores = cosine_similarity(query, matrix)[0]\nranked = sorted(enumerate(scores), key=lambda x: -x[1])\nprint("\\nQuery \'python analytics pipeline\' → ranked results:")\nfor idx, score in ranked:\n    print(f"  Doc {idx}: {score:.4f} | {docs[idx][:50]}")\n',
	},
	{
		name: "SQL Query Optimization for Analytics",
		tags: ["Analytics Engineer", "Data Engineer"],
		difficulty: "Intermediate",
		definition:
			"Techniques for reducing query execution time and cost in analytical databases by understanding how query planners process SQL.",
		formula:
			"Cost ≈ rows_scanned × bytes_per_row × CPU_factor\n\nPartition pruning: scans 1 of N partitions\nClustering benefit: scans 1/k of micro-partitions",
		description:
			"**Key principles:**\n- **Filter early**: push WHERE clauses as far upstream as possible\n- **Avoid SELECT \\***: read only needed columns (columnar storage)\n- **Partition pruning**: filter on partition keys (date) to skip entire partitions\n- **CTEs vs subqueries**: CTEs materialize in some engines — benchmark both\n- **Avoid functions on indexed columns**: WHERE DATE(created_at) = today breaks partition pruning",
		example:
			"Replacing `SELECT *` with named columns on a 10-column table in BigQuery reduces bytes billed by 80% if only 2 columns are needed.",
		useCases: [
			"Cost optimization in BigQuery/Snowflake/Redshift",
			"dbt model performance",
			"Dashboard query acceleration",
			"Large-scale ETL efficiency",
		],
		watchOut:
			"EXPLAIN / EXPLAIN ANALYZE is your best friend. Never optimize without measuring — the query planner often surprises you.",
		code: '# Illustrative patterns — run in your actual SQL engine with EXPLAIN\n\nbad_patterns = {\n    "full_scan":       "SELECT * FROM orders",\n    "no_partition":    "SELECT * FROM orders WHERE DATE(created_at) = \'2024-01-01\'",\n    "correlated_sub":  "SELECT * FROM users u WHERE (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) > 5",\n    "implicit_cast":   "SELECT * FROM events WHERE user_id = 12345",  # if user_id is VARCHAR\n}\n\ngood_patterns = {\n    "column_pruning":  "SELECT order_id, user_id, revenue FROM orders",\n    "partition_key":   "SELECT * FROM orders WHERE created_at >= \'2024-01-01\' AND created_at < \'2024-01-02\'",\n    "join_approach":   "SELECT u.* FROM users u JOIN (SELECT DISTINCT user_id FROM orders GROUP BY user_id HAVING COUNT(*) > 5) o ON u.id = o.user_id",\n    "explicit_cast":   "SELECT * FROM events WHERE user_id = \'12345\'",\n}\n\nimport pandas as pd\ncomparison = pd.DataFrame({\n    "anti_pattern": list(bad_patterns.keys()),\n    "preferred":    list(good_patterns.keys()),\n    "why_it_matters": [\n        "Columnar DBs charge per byte read — only read needed cols",\n        "Function on column prevents partition pruning, full table scan",\n        "Executes subquery once per outer row — O(n²) cost",\n        "Implicit cast disables index/clustering benefit",\n    ]\n})\nprint(comparison.to_string(index=False))\n',
	},
	{
		name: "Clustering Algorithms (K-Means, DBSCAN, Hierarchical)",
		tags: ["Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Unsupervised methods that group observations into clusters based on similarity, without pre-defined labels.",
		formula:
			"K-Means objective:\n  minimize Σ Σ ||xᵢ − μk||²\n\nDBSCAN:\n  core point if |N_ε(x)| ≥ min_pts\n  N_ε(x) = {y : dist(x,y) ≤ ε}\n\nElbow: find k where inertia drop levels off\nSilhouette: s(i) = (b−a) / max(a,b)",
		description:
			"| Algorithm | Shape | Outliers | k needed | Notes |\n|-----------|-------|----------|----------|-------|\n| K-Means | Spherical | Sensitive | Yes | Fast, scalable |\n| DBSCAN | Arbitrary | Robust | No | Finds noise points |\n| Hierarchical | Any | Moderate | No | Dendrogram output |",
		example:
			"RFM customer segmentation: K-Means with k=4 → Champions, At-Risk, Lost, New — each needs a different marketing strategy.",
		useCases: [
			"Customer segmentation",
			"Anomaly detection (DBSCAN)",
			"Document grouping",
			"Image compression",
		],
		watchOut:
			"K-Means assumes spherical, equal-size clusters. Normalize features first — otherwise high-magnitude features dominate distance calculations.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.metrics import silhouette_score\nfrom sklearn.datasets import make_blobs\n\nX, _ = make_blobs(n_samples=500, centers=4, cluster_std=0.8, random_state=42)\nX_s  = StandardScaler().fit_transform(X)\n\n# Elbow method\ninertias = [KMeans(n_clusters=k, random_state=42, n_init=10).fit(X_s).inertia_\n            for k in range(2, 9)]\nprint("Inertias k=2..8:", [f"{v:.0f}" for v in inertias])\n\nkm = KMeans(n_clusters=4, random_state=42, n_init=10).fit(X_s)\nprint(f"K-Means silhouette: {silhouette_score(X_s, km.labels_):.4f}")\n\ndb = DBSCAN(eps=0.4, min_samples=5).fit(X_s)\nn_clusters = len(set(db.labels_)) - (1 if -1 in db.labels_ else 0)\nnoise      = (db.labels_ == -1).sum()\nprint(f"DBSCAN: {n_clusters} clusters, {noise} noise points")\n\nhc = AgglomerativeClustering(n_clusters=4).fit(X_s)\nprint(f"Hierarchical silhouette: {silhouette_score(X_s, hc.labels_):.4f}")\n',
	},
	{
		name: "Causal Inference & Difference-in-Differences",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Methods for estimating causal effects from observational data where true randomization was not possible.",
		formula:
			"DiD Estimator:\n  τ = (Ȳ_treat,post − Ȳ_treat,pre)\n    − (Ȳ_ctrl,post − Ȳ_ctrl,pre)\n\nRegression form:\n  Y = β₀ + β₁·Treat + β₂·Post + β₃·(Treat×Post) + ε\n  τ = β₃",
		description:
			"**Causal toolkit:**\n- **DiD**: parallel trends assumption — control group shows what would have happened\n- **RDD**: exploit arbitrary threshold cutoffs\n- **IV**: instrument variable correlated with treatment but not outcome directly\n- **PSM**: propensity score matching to balance treatment/control\n\n**Parallel trends**: the treatment and control groups would have followed the same trend absent the intervention.",
		example:
			"Feature rolled out to Region A (treatment). Region B is control. DiD removes seasonal trends common to both — isolates the feature's true causal effect.",
		useCases: [
			"Evaluating non-randomized product rollouts",
			"Policy impact analysis",
			"Marketing channel attribution",
			"Pricing experiment analysis",
		],
		watchOut:
			"DiD requires the parallel trends assumption — test it visually with pre-period data. Violation makes the estimate biased.",
		code: 'import numpy as np\nimport pandas as pd\nimport statsmodels.formula.api as smf\n\nrng = np.random.default_rng(42)\nn = 400\n\ndf = pd.DataFrame({\n    "unit_id":   np.tile(range(n // 2), 2),\n    "period":    np.repeat(["pre","post"], n // 2),\n    "treated":   np.tile(rng.binomial(1, 0.5, n // 2), 2),\n})\ndf["post"]  = (df["period"] == "post").astype(int)\ndf["trend"] = rng.normal(0, 5, n)\ntrue_effect = 15\ndf["outcome"] = (\n    50\n    + 5 * df["treated"]        # baseline difference\n    + 8 * df["post"]           # time trend\n    + true_effect * df["treated"] * df["post"]  # treatment effect\n    + df["trend"]\n)\n\nmodel = smf.ols("outcome ~ treated * post", data=df).fit()\nprint(model.summary().tables[1])\nprint(f"\\nTrue causal effect  : {true_effect}")\nprint(f"DiD estimate (β₃)  : {model.params[\'treated:post\']:.3f}")\nprint(f"95% CI             : [{model.conf_int().loc[\'treated:post\',0]:.3f}, {model.conf_int().loc[\'treated:post\',1]:.3f}]")\n',
	},
	{
		name: "Ensemble Methods (Bagging & Boosting)",
		tags: ["Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Ensemble methods combine multiple weak learners into a stronger predictor. Bagging trains models in parallel on bootstrap samples; boosting trains sequentially, each correcting the last.",
		formula:
			"Bagging prediction: ŷ = (1/B) × Σ f_b(x)\n\nBoosting (AdaBoost):\n  F_m(x) = F_{m-1}(x) + α_m × h_m(x)\n  where h_m focuses on previously misclassified points\n\nGBM gradient step:\n  F_m(x) = F_{m-1}(x) − γ × ∇L(F_{m-1})",
		description:
			"| Method | Reduces | Sequential? | Key Param |\n|--------|---------|-------------|----------|\n| Bagging / RF | Variance | No | n_estimators, max_features |\n| AdaBoost | Bias+Variance | Yes | n_estimators, learning_rate |\n| Gradient Boosting | Bias | Yes | n_estimators, max_depth, learning_rate |\n| XGBoost/LightGBM | Both | Yes | same + reg_lambda |",
		example:
			"Single decision tree: 75% accuracy. Random Forest (100 trees): 89%. XGBoost: 92% — each corrects remaining error.",
		useCases: [
			"Tabular data prediction (XGBoost/LightGBM dominate Kaggle)",
			"Feature importance ranking",
			"Fraud detection",
			"Churn and LTV prediction",
		],
		watchOut:
			"Boosting is prone to overfitting if learning rate is too high or trees too deep. Always tune with early stopping on a validation set.",
		code: 'import numpy as np\nfrom sklearn.datasets import make_classification\nfrom sklearn.ensemble import (RandomForestClassifier, AdaBoostClassifier,\n                               GradientBoostingClassifier, BaggingClassifier)\nfrom sklearn.tree import DecisionTreeClassifier\nfrom sklearn.model_selection import cross_val_score\n\nX, y = make_classification(n_samples=2_000, n_features=20, n_informative=10,\n                            random_state=42)\n\nmodels = {\n    "Single Tree":    DecisionTreeClassifier(max_depth=5, random_state=42),\n    "Bagging":        BaggingClassifier(n_estimators=50, random_state=42),\n    "Random Forest":  RandomForestClassifier(n_estimators=100, random_state=42),\n    "AdaBoost":       AdaBoostClassifier(n_estimators=100, learning_rate=0.1, random_state=42),\n    "Gradient Boost": GradientBoostingClassifier(n_estimators=100, max_depth=3,\n                                                  learning_rate=0.1, random_state=42),\n}\nfor name, model in models.items():\n    scores = cross_val_score(model, X, y, cv=5, scoring="roc_auc")\n    print(f"{name:18s}  AUC = {scores.mean():.4f} ± {scores.std():.4f}")\n\nrf = RandomForestClassifier(n_estimators=100, random_state=42).fit(X, y)\nimportances = sorted(zip(range(20), rf.feature_importances_),\n                     key=lambda x: -x[1])[:5]\nprint("\\nTop 5 features (Random Forest):")\nfor feat, imp in importances:\n    print(f"  feature_{feat}: {imp:.4f}")\n',
	},
	{
		name: "Forecasting — Exponential Smoothing & Prophet",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Advanced",
		definition:
			"Exponential smoothing models weight recent observations more heavily using a decay factor. Prophet decomposes time series into trend + seasonality + holidays using an additive model.",
		formula:
			"Simple ES:  S_t = α·y_t + (1−α)·S_{t−1}\n  α ∈ (0,1) — smoothing parameter\n\nHolt-Winters (additive):\n  Level:    L_t = α(y_t − S_{t−m}) + (1−α)(L_{t−1}+T_{t−1})\n  Trend:    T_t = β(L_t − L_{t−1}) + (1−β)T_{t−1}\n  Seasonal: S_t = γ(y_t − L_t) + (1−γ)S_{t−m}\n  Forecast: ŷ_{t+h} = L_t + h·T_t + S_{t+h−m}",
		description:
			"| Model | Handles Trend | Handles Seasonality | Notes |\n|-------|--------------|---------------------|-------|\n| SES | No | No | Simplest |\n| Holt | Yes | No | Double ES |\n| Holt-Winters | Yes | Yes | Triple ES |\n| Prophet | Yes | Multi-period | Handles holidays, missing data |",
		example:
			"E-commerce weekly revenue: Holt-Winters captures the upward trend AND December spikes. Prophet additionally handles Black Friday anomalies.",
		useCases: [
			"Demand planning",
			"Revenue forecasting dashboards",
			"Inventory optimization",
			"Capacity planning",
		],
		watchOut:
			"Forecasting uncertainty compounds: a 6-month forecast is far wider than a 1-month forecast. Always communicate prediction intervals, not point estimates.",
		code: 'import numpy as np\nimport pandas as pd\nfrom statsmodels.tsa.holtwinters import ExponentialSmoothing\nfrom statsmodels.tsa.statespace.sarimax import SARIMAX\n\nrng = np.random.default_rng(42)\ndates = pd.date_range("2022-01", periods=104, freq="W")\ntrend    = np.linspace(100, 250, 104)\nseasonal = 30 * np.sin(2 * np.pi * np.arange(104) / 52)\nseries   = pd.Series(trend + seasonal + rng.normal(0, 8, 104), index=dates)\n\ntrain, test = series[:-12], series[-12:]\n\nhw = ExponentialSmoothing(train, trend="add", seasonal="add",\n                          seasonal_periods=52).fit()\nhw_forecast = hw.forecast(12)\nhw_mae = np.abs(test - hw_forecast).mean()\nprint(f"Holt-Winters MAE: {hw_mae:.2f}")\n\nsarima = SARIMAX(train, order=(1,1,1), seasonal_order=(1,1,1,52)).fit(disp=False)\nsarima_fc = sarima.forecast(12)\nsarima_mae = np.abs(test - sarima_fc).mean()\nprint(f"SARIMA MAE      : {sarima_mae:.2f}")\n\nprint("\\nHolt-Winters 12-week forecast:")\nprint(hw_forecast.round(2).to_string())\n\n# Prophet usage (requires: pip install prophet)\n# from prophet import Prophet\n# df_p = series.reset_index().rename(columns={"index":"ds", 0:"y"})\n# m = Prophet(yearly_seasonality=True).fit(df_p[:-12])\n# future = m.make_future_dataframe(periods=12, freq="W")\n# forecast = m.predict(future)\n',
	},
	{
		name: "Data Contracts & Observability SLAs",
		tags: ["Data Engineer", "Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"A data contract is a formal, versioned agreement between data producers and consumers specifying schema, semantics, quality guarantees, and SLAs.",
		formula:
			"Freshness SLA  : max(current_time − max(updated_at)) < threshold\nVolume SLA     : |row_count − expected_rows| / expected_rows < tolerance\nSchema SLA     : all required columns present with correct dtype\nNull SLA       : null_rate < max_null_rate per column",
		description:
			"**Contract components:**\n- Schema: column names, types, required/optional\n- Semantics: what each field means (not just its type)\n- Quality: null rates, value ranges, uniqueness rules\n- SLAs: freshness, volume, availability\n- Ownership: team, on-call contact, escalation path\n\n**Observability triad:** Freshness, Volume, Schema.",
		example:
			"Contract for `fact_orders`: `order_id` must be unique, non-null; `revenue` > 0; updated daily by 06:00 UTC; row count within ±10% of prior 7-day average.",
		useCases: [
			"Data mesh governance",
			"dbt contract testing",
			"Incident SLA alerting",
			"Cross-team data sharing agreements",
		],
		watchOut:
			"Contracts without enforcement are documentation, not contracts. Automate checks in CI/CD and alert on breach before downstream consumers notice.",
		code: 'import pandas as pd\nimport numpy as np\nfrom dataclasses import dataclass, field\nfrom typing import Optional\n\n@dataclass\nclass ColumnContract:\n    name: str\n    dtype: str\n    nullable: bool = False\n    unique: bool = False\n    min_val: Optional[float] = None\n    max_val: Optional[float] = None\n    max_null_rate: float = 0.0\n\n@dataclass\nclass TableContract:\n    table_name: str\n    columns: list\n    freshness_hours: float = 24.0\n    volume_tolerance: float = 0.15\n\ndef validate(df: pd.DataFrame, contract: TableContract) -> dict:\n    results = {}\n    for col in contract.columns:\n        c = col\n        if c.name not in df.columns:\n            results[c.name] = "MISSING COLUMN"\n            continue\n        issues = []\n        null_rate = df[c.name].isna().mean()\n        if null_rate > c.max_null_rate:\n            issues.append(f"null_rate={null_rate:.3f} > {c.max_null_rate}")\n        if c.unique and df[c.name].duplicated().any():\n            issues.append("uniqueness violated")\n        if c.min_val is not None and (df[c.name] < c.min_val).any():\n            issues.append(f"values below min={c.min_val}")\n        results[c.name] = "PASS" if not issues else " | ".join(issues)\n    return results\n\ncontract = TableContract("fact_orders", columns=[\n    ColumnContract("order_id", "int64", nullable=False, unique=True),\n    ColumnContract("revenue",  "float64", nullable=False, min_val=0.0),\n    ColumnContract("country",  "object", nullable=True, max_null_rate=0.05),\n])\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({\n    "order_id": [1, 2, 2, 4],   # duplicate!\n    "revenue":  [100.0, -5.0, 200.0, 300.0],   # negative!\n    "country":  ["PH", None, "US", "SG"],\n})\nprint(validate(df, contract))\n',
	},
	{
		name: "Recommendation Systems (Collaborative Filtering & Matrix Factorization)",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Expert",
		definition:
			"Algorithms that predict a user's preference for items based on behavioral patterns, either from similar users (collaborative) or item features (content-based).",
		formula:
			"User-User CF similarity:\n  sim(u,v) = (rᵤ · rᵥ) / (|rᵤ| × |rᵥ|)  [cosine]\n\nMatrix Factorization (SVD):\n  R ≈ U × Σ × Vᵀ\n  r̂(u,i) = μ + bᵤ + bᵢ + qᵢᵀ · pᵤ\n\nImplicit ALS minimizes:\n  Σ cᵤᵢ(pᵤᵀ qᵢ − rᵤᵢ)² + λ(||pᵤ||² + ||qᵢ||²)",
		description:
			"| Method | Data Needed | Cold Start | Scalability |\n|--------|-------------|------------|-------------|\n| User-User CF | Ratings | Poor | Low (O(n²)) |\n| Item-Item CF | Ratings | Medium | Medium |\n| Matrix Factorization | Ratings | Poor | High |\n| ALS (implicit) | Interactions | Poor | High |\n| Two-tower neural | Features | Good | High |",
		example:
			"Netflix: user-item interaction matrix factorized into 50-dim latent factors. dot(user_vector, item_vector) → predicted rating.",
		useCases: [
			"E-commerce product recommendations",
			"Content feed ranking",
			"Playlist generation",
			"Cross-sell/upsell engines",
		],
		watchOut:
			"Cold start problem: new users/items have no interaction history. Hybrid approaches combine collaborative + content features.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.metrics.pairwise import cosine_similarity\nfrom sklearn.decomposition import TruncatedSVD\nfrom scipy.sparse import csr_matrix\n\nrng = np.random.default_rng(42)\nn_users, n_items = 100, 50\nratings_dense = rng.integers(0, 6, (n_users, n_items)).astype(float)\nratings_dense[ratings_dense < 3] = 0   # sparse: many zeros = no interaction\nR = csr_matrix(ratings_dense)\n\n# Item-item collaborative filtering\nitem_sim = cosine_similarity(R.T)\nnp.fill_diagonal(item_sim, 0)\ntop3_for_item0 = np.argsort(item_sim[0])[::-1][:3]\nprint(f"Items most similar to item_0: {top3_for_item0}")\n\n# Matrix factorization via SVD\nsvd = TruncatedSVD(n_components=10, random_state=42)\nuser_factors = svd.fit_transform(R)\nitem_factors = svd.components_.T\nprint(f"User factors shape: {user_factors.shape}")\nprint(f"Explained variance: {svd.explained_variance_ratio_.sum():.3f}")\n\n# Predict ratings for user 0\npredicted_ratings = user_factors[0] @ item_factors.T\ntop5_items = np.argsort(predicted_ratings)[::-1][:5]\nprint(f"Top 5 recommended items for user_0: {top5_items}")\n\n# RMSE on observed entries\nmask = ratings_dense > 0\nR_approx = user_factors @ item_factors.T\nrmse = np.sqrt(((ratings_dense[mask] - R_approx[mask])**2).mean())\nprint(f"SVD reconstruction RMSE: {rmse:.4f}")\n',
	},
	{
		name: "Uplift Modeling & Heterogeneous Treatment Effects",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"Uplift modeling predicts the incremental causal effect of a treatment on an individual, targeting those for whom treatment makes a meaningful difference (true positives).",
		formula:
			"Uplift = P(Y=1 | T=1, X=x) − P(Y=1 | T=0, X=x)\n\nQINI coefficient (area between uplift and random):\n  Q = ∫ [U(φ) − random] dφ\n\nTwo-model approach:\n  uplift(x) = model_treat.predict(x) − model_ctrl.predict(x)",
		description:
			"**The four segments:**\n- **Persuadables**: respond only to treatment — target these\n- **Sure Things**: convert regardless — wasted spend\n- **Lost Causes**: won't convert either way — ignore\n- **Do Not Disturb**: treatment has negative effect — actively avoid",
		example:
			"Email campaign: targeting top decile by uplift score vs. top decile by propensity score doubles incremental revenue for the same send volume.",
		useCases: [
			"Targeted marketing campaigns",
			"Clinical trial subgroup analysis",
			"Retention intervention targeting",
			"Pricing personalization",
		],
		watchOut:
			"Uplift models require randomized training data (treatment must be randomly assigned). Observational data requires causal adjustment first.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import roc_auc_score\n\nrng = np.random.default_rng(42)\nn = 5_000\nX = rng.normal(0, 1, (n, 5))\ntreatment = rng.binomial(1, 0.5, n)\n\n# Heterogeneous treatment effects: feature X[:,0] determines who responds\nbase_prob  = 0.1 + 0.05 * X[:, 1]\ntreat_prob = base_prob + np.where(X[:, 0] > 0, 0.15, 0.02)  # responders if X0 > 0\nprob       = np.where(treatment == 1, treat_prob, base_prob)\nprob       = np.clip(prob, 0, 1)\noutcome    = rng.binomial(1, prob, n)\n\ndf = pd.DataFrame(X, columns=[f"x{i}" for i in range(5)])\ndf["treatment"] = treatment\ndf["outcome"]   = outcome\n\nX_tr, X_te, y_tr, y_te = train_test_split(df, df.index, test_size=0.2, random_state=42)\nfeat_cols = [c for c in df.columns if c.startswith("x")]\n\ntreated_mask = X_tr["treatment"] == 1\nctrl_mask    = X_tr["treatment"] == 0\n\nm_treat = LogisticRegression(max_iter=500).fit(X_tr.loc[treated_mask, feat_cols], X_tr.loc[treated_mask, "outcome"])\nm_ctrl  = LogisticRegression(max_iter=500).fit(X_tr.loc[ctrl_mask,   feat_cols], X_tr.loc[ctrl_mask,   "outcome"])\n\nuplift_score = (m_treat.predict_proba(X_te[feat_cols])[:, 1]\n                - m_ctrl.predict_proba(X_te[feat_cols])[:, 1])\n\nX_te = X_te.copy()\nX_te["uplift"] = uplift_score\ntop_decile = X_te.nlargest(int(0.1 * len(X_te)), "uplift")\nrandom_decile = X_te.sample(frac=0.1, random_state=42)\n\nprint(f"Top decile conversion rate  : {top_decile[\'outcome\'].mean():.4f}")\nprint(f"Random decile conversion    : {random_decile[\'outcome\'].mean():.4f}")\nprint(f"Incremental lift            : {top_decile[\'outcome\'].mean() - random_decile[\'outcome\'].mean():.4f}")\n',
	},
	{
		name: "Online Learning & Multi-Armed Bandit Algorithms",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Expert",
		definition:
			"Online learning updates models incrementally as new data arrives. Bandits balance exploring new options against exploiting known good ones — formalizing the explore/exploit tradeoff.",
		formula:
			"ε-Greedy:\n  exploit (best arm) with prob 1−ε\n  explore (random arm) with prob ε\n\nUCB1:\n  score(a) = μ̂(a) + √(2·ln(N) / n(a))\n  N = total pulls, n(a) = pulls of arm a\n\nThompson Sampling:\n  θ(a) ~ Beta(α_a, β_a)\n  play argmax θ(a)",
		description:
			"| Algorithm | Exploration | Regret | Use When |\n|-----------|-------------|--------|----------|\n| ε-Greedy | Fixed random | O(√T) | Simple baseline |\n| UCB1 | Uncertainty-based | O(log T) | Known horizon |\n| Thompson Sampling | Bayesian posterior | O(log T) | Best practical performance |",
		example:
			"Auto-optimizing A/B test: Thompson Sampling allocates more traffic to winning variants as evidence accumulates — reducing regret vs. fixed 50/50.",
		useCases: [
			"Adaptive A/B testing",
			"Ad serving optimization",
			"Recommendation exploration",
			"Clinical trial adaptive design",
		],
		watchOut:
			"Bandits assume stationarity — arm quality doesn't change over time. Use contextual bandits (LinUCB) or sliding-window approaches for non-stationary rewards.",
		code: 'import numpy as np\nimport pandas as pd\n\nrng = np.random.default_rng(42)\ntrue_rates = [0.04, 0.07, 0.05, 0.06]  # true conversion rates per variant\nn_arms = len(true_rates)\nn_steps = 10_000\n\n# Thompson Sampling\nalpha = np.ones(n_arms)\nbeta  = np.ones(n_arms)\nts_rewards = []\nts_choices = []\n\nfor t in range(n_steps):\n    theta  = rng.beta(alpha, beta)\n    arm    = np.argmax(theta)\n    reward = rng.binomial(1, true_rates[arm])\n    alpha[arm] += reward\n    beta[arm]  += 1 - reward\n    ts_rewards.append(reward)\n    ts_choices.append(arm)\n\nts_rewards = np.array(ts_rewards)\nts_choices = np.array(ts_choices)\nprint("Thompson Sampling results:")\nfor arm in range(n_arms):\n    mask = ts_choices == arm\n    chosen_pct = mask.mean() * 100\n    obs_rate   = ts_rewards[mask].mean() if mask.sum() > 0 else 0\n    print(f"  Arm {arm} (true={true_rates[arm]:.2f}): chosen {chosen_pct:.1f}% | obs_rate={obs_rate:.4f}")\n\nbest_arm_rate = max(true_rates)\nregret = best_arm_rate * n_steps - ts_rewards.sum()\nprint(f"\\nCumulative regret: {regret:.0f} (vs optimal {best_arm_rate * n_steps:.0f})")\n\n# UCB1 for comparison\ncounts  = np.zeros(n_arms)\nsums    = np.zeros(n_arms)\nucb_rew = 0\nfor t in range(1, n_steps + 1):\n    if t <= n_arms:\n        arm = t - 1\n    else:\n        ucb = sums / counts + np.sqrt(2 * np.log(t) / counts)\n        arm = np.argmax(ucb)\n    reward = rng.binomial(1, true_rates[arm])\n    counts[arm] += 1\n    sums[arm]   += reward\n    ucb_rew     += reward\n\nprint(f"UCB1 total reward      : {ucb_rew}")\nprint(f"Thompson total reward  : {ts_rewards.sum()}")\n',
	},
	{
		name: "Percentiles & Quantiles",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"A percentile indicates the value below which a given percentage of observations fall. Quantiles divide a distribution into equal-sized intervals.",
		formula:
			"P_k = value at which k% of data falls below\n\nQuartiles: Q1=P25, Q2=P50 (median), Q3=P75\nIQR = Q3 − Q1\nDeciles: P10, P20, ..., P90\nNTILE(n): SQL function dividing rows into n buckets",
		description:
			"Percentiles are more robust than means for skewed distributions. P50 (median) is the central value. P95 and P99 capture tail behavior — critical for SLA monitoring and outlier analysis.",
		example:
			"User session times: P50=2min, P95=12min, P99=45min. The average (5min) misrepresents most users — P50 is more honest.",
		useCases: [
			"SLA threshold setting (P95, P99 latency)",
			"Salary band benchmarking",
			"Revenue decile segmentation",
			"Test score norming",
		],
		watchOut:
			"Interpolation method matters for small samples. Pandas, NumPy, and SQL engines use slightly different interpolation — results can differ.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\nsessions = rng.exponential(scale=3, size=10_000)\n\nfor p in [25, 50, 75, 90, 95, 99]:\n    print(f"P{p:2d}: {np.percentile(sessions, p):.3f} min")\n\ns = pd.Series(sessions)\nprint("\\nDescribe:")\nprint(s.describe(percentiles=[.25,.5,.75,.9,.95,.99]).round(3))\n\ndf = pd.DataFrame({"user_id": range(1000),\n                   "revenue": rng.exponential(200, 1000)})\ndf["decile"] = pd.qcut(df["revenue"], q=10, labels=False) + 1\nprint("\\nMean revenue by decile:")\nprint(df.groupby("decile")["revenue"].mean().round(2))\n',
	},
	{
		name: "Null Handling & Imputation Strategies",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Foundational",
		definition:
			"Nulls represent missing, unknown, or inapplicable values. Imputation fills them with estimated values to enable analysis and modeling.",
		formula:
			"Mean imputation:   x̂ = μ\nMedian imputation: x̂ = median\nKNN imputation:    x̂ = weighted avg of k nearest neighbors\nMICE:              iterative multivariate regression imputation",
		description:
			"**Types of missingness:**\n- **MCAR** (Missing Completely At Random): safe to drop\n- **MAR** (Missing At Random): depends on observed data → impute\n- **MNAR** (Missing Not At Random): systematic → investigate root cause\n\nAlways ask *why* the value is missing before deciding how to handle it.",
		example:
			"Revenue is null for free-plan users → MNAR, not random. Replacing with 0 is correct; replacing with mean would be wrong.",
		useCases: [
			"Pre-modeling data prep",
			"Survey analysis",
			"Pipeline data cleaning",
			"Feature engineering",
		],
		watchOut:
			"Mean imputation reduces variance and distorts correlations. For ML, prefer KNN or model-based imputation. For reporting, flag imputed values explicitly.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.impute import SimpleImputer, KNNImputer\nfrom sklearn.experimental import enable_iterative_imputer  # noqa\nfrom sklearn.impute import IterativeImputer\n\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({\n    "age":     rng.integers(18, 65, 200).astype(float),\n    "income":  rng.exponential(50_000, 200),\n    "score":   rng.normal(70, 15, 200),\n})\ndf.loc[rng.choice(200, 30, replace=False), "age"]    = np.nan\ndf.loc[rng.choice(200, 40, replace=False), "income"] = np.nan\n\nprint("Missing rate:")\nprint((df.isna().mean() * 100).round(2))\n\nmean_imp = SimpleImputer(strategy="mean")\nmedian_imp = SimpleImputer(strategy="median")\nknn_imp  = KNNImputer(n_neighbors=5)\nmice_imp = IterativeImputer(random_state=42, max_iter=10)\n\nresults = {}\nfor name, imp in [("mean", mean_imp), ("median", median_imp),\n                  ("knn", knn_imp), ("mice", mice_imp)]:\n    filled = pd.DataFrame(imp.fit_transform(df), columns=df.columns)\n    results[name] = filled["income"].std()\n\nprint("\\nIncome std dev after imputation (original:", df["income"].std().round(2), ")")\nfor name, std in results.items():\n    print(f"  {name:8s}: {std:.2f}")\n',
	},
	{
		name: "Data Joins — Types & Pitfalls",
		tags: ["Data Analyst", "Analytics Engineer", "Data Engineer"],
		difficulty: "Foundational",
		definition:
			"Joins combine rows from two or more tables based on a related column. The join type determines which rows appear in the result.",
		formula:
			"INNER JOIN  : only matching rows in both tables\nLEFT JOIN   : all left rows + matching right (null if no match)\nRIGHT JOIN  : all right rows + matching left\nFULL OUTER  : all rows from both, null where no match\nCROSS JOIN  : every row × every row (Cartesian product)\nSELF JOIN   : table joined to itself",
		description:
			"**Fan-out trap**: joining on a non-unique key causes row multiplication. One-to-many becomes many-to-many if both sides have duplicates.\n\n**Rule of thumb**: always check row counts before and after joins during development.",
		example:
			"orders (500 rows) LEFT JOIN customers → still 500 rows if customer_id is unique in customers. If customers has duplicates on customer_id → fan-out to 600+ rows.",
		useCases: [
			"Fact-dimension joins in data warehouse",
			"Pipeline data enrichment",
			"Deduplication diagnosis",
			"Attribution joining",
		],
		watchOut:
			"INNER JOIN silently drops unmatched rows. Use LEFT JOIN + WHERE right.key IS NULL to find orphan records before deciding to drop them.",
		code: 'import pandas as pd\nimport numpy as np\n\norders = pd.DataFrame({\n    "order_id":    [1, 2, 3, 4, 5],\n    "customer_id": [101, 102, 103, 101, 999],\n    "amount":      [50, 80, 30, 120, 200],\n})\ncustomers = pd.DataFrame({\n    "customer_id": [101, 102, 103],\n    "name":        ["Alice", "Bob", "Carol"],\n})\n\ninner = orders.merge(customers, on="customer_id", how="inner")\nleft  = orders.merge(customers, on="customer_id", how="left")\nprint(f"Original orders : {len(orders)}")\nprint(f"INNER JOIN      : {len(inner)}  (order 999 dropped)")\nprint(f"LEFT JOIN       : {len(left)}   (order 999 kept, name=NaN)")\n\norphans = left[left["name"].isna()]\nprint(f"\\nOrphan orders (no matching customer):")\nprint(orphans)\n\ndup_customers = pd.concat([customers,\n    pd.DataFrame({"customer_id": [101], "name": ["Alice_dup"]})])\nfan_out = orders.merge(dup_customers, on="customer_id", how="inner")\nprint(f"\\nWith duplicate customer 101 → {len(fan_out)} rows (fan-out!)")\n',
	},
	{
		name: "Funnel Analysis",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"Funnel analysis tracks user progression through a defined sequence of steps, measuring conversion and drop-off at each stage.",
		formula:
			"Step conversion rate  = Users reaching step N / Users at step N−1\nOverall conversion    = Users at final step / Users at first step\nDrop-off rate         = 1 − step conversion rate\nTime-to-convert       = median(timestamp_final − timestamp_first)",
		description:
			"Funnels reveal where users abandon a flow. The critical insight is not just the drop-off rate but *why* — segment by device, channel, cohort to isolate the cause.",
		example:
			"Checkout funnel: Cart (1,000) → Shipping (700, −30%) → Payment (420, −40%) → Confirm (380, −9%). Payment is the biggest friction point.",
		useCases: [
			"E-commerce checkout optimization",
			"SaaS onboarding flow analysis",
			"Marketing campaign attribution",
			"Feature adoption tracking",
		],
		watchOut:
			"Ordered vs. unordered funnels give different results. Decide whether users must complete steps in sequence or can take any path.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nn = 5_000\nevents = []\nsteps = ["visit", "signup", "activate", "purchase"]\nprobs = [1.0, 0.35, 0.55, 0.40]  # cumulative probability of reaching each step\n\nfor user_id in range(n):\n    ts = pd.Timestamp("2024-01-01")\n    for step, prob in zip(steps, probs):\n        if rng.random() < prob:\n            events.append({"user_id": user_id, "step": step,\n                           "ts": ts + pd.Timedelta(hours=rng.integers(0, 48))})\n            ts += pd.Timedelta(hours=rng.integers(1, 24))\n        else:\n            break\n\ndf = pd.DataFrame(events)\n\nfunnel = df.groupby("step")["user_id"].nunique().reindex(steps)\nfunnel_df = pd.DataFrame({\n    "step":        steps,\n    "users":       funnel.values,\n    "pct_of_top":  (funnel.values / funnel.values[0] * 100).round(1),\n    "step_conv":   [100.0] + (funnel.values[1:] / funnel.values[:-1] * 100).round(1).tolist(),\n    "dropoff":     [0.0] + (100 - funnel.values[1:] / funnel.values[:-1] * 100).round(1).tolist(),\n})\nprint(funnel_df.to_string(index=False))\n\ntime_to_purchase = (\n    df[df["step"] == "purchase"].merge(df[df["step"] == "visit"], on="user_id")\n    .assign(hours=lambda x: (x["ts_x"] - x["ts_y"]).dt.total_seconds() / 3600)\n)\nprint(f"\\nMedian time to purchase: {time_to_purchase[\'hours\'].median():.1f} hours")\n',
	},
	{
		name: "Customer Lifetime Value (LTV / CLV)",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"The total net revenue a business can expect from a customer over their entire relationship. Used to justify acquisition costs and segment customers by strategic value.",
		formula:
			"Simple LTV    = ARPU × Average Customer Lifespan\nSimple LTV    = ARPU / Churn Rate\n\nDiscounted LTV = Σ [ margin_t / (1+d)^t ]\n  d = discount rate, t = period\n\nCAC Payback   = CAC / (ARPU × Gross Margin %)",
		description:
			"**Key relationships:**\n- LTV > CAC → profitable acquisition\n- LTV/CAC ≥ 3 → healthy SaaS unit economics\n- CAC Payback < 12 months → strong cash efficiency\n\n**BG/NBD model**: probabilistic LTV using transaction frequency and recency.",
		example:
			"ARPU = $50/month, churn = 5%/month → LTV = $50 / 0.05 = $1,000. If CAC = $200 → LTV/CAC = 5x → healthy.",
		useCases: [
			"Marketing budget allocation",
			"Customer acquisition bid optimization",
			"Cohort health comparison",
			"Investor unit economics reporting",
		],
		watchOut:
			"LTV projections depend heavily on churn rate. A 1% improvement in monthly churn doubles LTV at low churn rates. Never report LTV without confidence intervals.",
		code: 'import numpy as np\nimport pandas as pd\n\narpu       = 50\nchurn_rate = 0.05\ngross_margin = 0.70\ndiscount_rate = 0.10 / 12  # monthly\ncac        = 200\n\nsimple_ltv    = arpu / churn_rate\ndiscounted_ltv = sum(\n    (arpu * gross_margin * (1 - churn_rate)**t) / (1 + discount_rate)**t\n    for t in range(120)  # 10 years\n)\npayback_months = cac / (arpu * gross_margin)\n\nprint(f"Simple LTV         : ${simple_ltv:,.0f}")\nprint(f"Discounted LTV     : ${discounted_ltv:,.0f}")\nprint(f"LTV / CAC          : {discounted_ltv / cac:.1f}x")\nprint(f"CAC Payback        : {payback_months:.1f} months")\n\nchurn_rates = np.arange(0.02, 0.15, 0.01)\nltvs = arpu / churn_rates\nsensitivity = pd.DataFrame({"churn_rate": churn_rates.round(2),\n                             "ltv": ltvs.round(0),\n                             "ltv_cac_ratio": (ltvs / cac).round(2)})\nprint("\\nLTV sensitivity to churn rate:")\nprint(sensitivity.to_string(index=False))\n',
	},
	{
		name: "Time-Based Train/Test Splits",
		tags: ["Data Scientist", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"For time series data, train/test splits must respect temporal order — training only on past data and evaluating on future data to prevent lookahead bias.",
		formula:
			"Walk-forward validation:\n  Train: [t₀, t₁]  → Test: [t₁, t₂]\n  Train: [t₀, t₂]  → Test: [t₂, t₃]\n  ... (expanding window)\n\nSliding window:\n  Train: [t₀, t₁]  → Test: [t₁, t₂]\n  Train: [t₁, t₂]  → Test: [t₂, t₃]\n  ... (fixed window size)",
		description:
			"**Why random splits fail for time series:**\n- Data leakage: future values inform past predictions\n- Autocorrelation: nearby time points are correlated\n- Non-stationarity: distribution shifts over time\n\nAlways visualize the split boundary on a time axis before modeling.",
		example:
			"Predicting December sales using data from Jan–Nov as training is valid. Using random 80/20 split leaks December patterns into training — artificially inflates performance.",
		useCases: [
			"Demand forecasting model evaluation",
			"Financial model backtesting",
			"Churn model with temporal features",
			"Fraud detection pipelines",
		],
		watchOut:
			"Feature engineering leakage is subtle — rolling averages or lag features computed on the full dataset before splitting will contain future information.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.model_selection import TimeSeriesSplit\nfrom sklearn.linear_model import Ridge\nfrom sklearn.metrics import mean_absolute_error\n\nrng = np.random.default_rng(42)\ndates = pd.date_range("2022-01-01", periods=104, freq="W")\ny = pd.Series(\n    np.linspace(100, 200, 104) + 20 * np.sin(np.arange(104) * 2 * np.pi / 52)\n    + rng.normal(0, 8, 104), index=dates\n)\n\ndf = pd.DataFrame({"y": y})\nfor lag in [1, 2, 4, 8, 13, 26, 52]:\n    df[f"lag_{lag}"] = df["y"].shift(lag)\ndf = df.dropna()\n\ntscv = TimeSeriesSplit(n_splits=5)\nX = df.drop("y", axis=1).values\nY = df["y"].values\n\nmaes = []\nfor fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):\n    model = Ridge().fit(X[tr_idx], Y[tr_idx])\n    preds = model.predict(X[te_idx])\n    mae   = mean_absolute_error(Y[te_idx], preds)\n    maes.append(mae)\n    print(f"Fold {fold+1}: train={len(tr_idx):3d}  test={len(te_idx):2d}  MAE={mae:.2f}")\n\nprint(f"\\nMean MAE across folds: {np.mean(maes):.2f} ± {np.std(maes):.2f}")\n',
	},
	{
		name: "RFM Analysis",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"RFM segments customers by Recency (how recently they purchased), Frequency (how often), and Monetary value (how much they spend).",
		formula:
			"Recency  = days since last purchase (lower = better)\nFrequency = total transactions in window\nMonetary = total or average spend in window\n\nRFM score = rank each metric into quintiles (1–5)\nCombined  = concat(R_score, F_score, M_score)",
		description:
			"**Typical RFM segments:**\n- **Champions** (555): recent, frequent, high spend\n- **At-Risk** (155): once loyal, haven't bought recently\n- **Lost** (111): haven't bought in a long time\n- **New Customers** (511): recent, low frequency\n- **Potential Loyalists** (452): recent, growing frequency",
		example:
			"Champion customers: offer loyalty rewards. At-Risk customers: win-back campaign with discount. Lost customers: low-cost re-engagement or accept churn.",
		useCases: [
			"CRM segmentation",
			"Email campaign targeting",
			"Retention program design",
			"LTV proxy scoring",
		],
		watchOut:
			"Quintile-based RFM is sensitive to data distribution. Heavy skew in monetary value means quintile 5 captures a tiny group with enormous spend — adjust bin edges if needed.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nn = 2_000\nsnapshot_date = pd.Timestamp("2024-12-31")\n\ndf = pd.DataFrame({\n    "customer_id": rng.integers(1, 501, n),\n    "order_date":  pd.to_datetime(rng.choice(\n        pd.date_range("2023-01-01", "2024-12-31"), n)),\n    "revenue":     rng.exponential(150, n),\n})\n\nrfm = df.groupby("customer_id").agg(\n    recency  =("order_date", lambda x: (snapshot_date - x.max()).days),\n    frequency=("order_date", "count"),\n    monetary =("revenue", "sum"),\n).reset_index()\n\nrfm["R"] = pd.qcut(rfm["recency"],  5, labels=[5,4,3,2,1])\nrfm["F"] = pd.qcut(rfm["frequency"].rank(method="first"), 5, labels=[1,2,3,4,5])\nrfm["M"] = pd.qcut(rfm["monetary"], 5, labels=[1,2,3,4,5])\nrfm["RFM_score"] = rfm["R"].astype(str) + rfm["F"].astype(str) + rfm["M"].astype(str)\n\ndef segment(row):\n    r, f, m = int(row["R"]), int(row["F"]), int(row["M"])\n    if r >= 4 and f >= 4: return "Champion"\n    if r >= 3 and f >= 3: return "Loyal"\n    if r >= 4 and f <= 2: return "New Customer"\n    if r <= 2 and f >= 3: return "At-Risk"\n    if r <= 2 and f <= 2: return "Lost"\n    return "Potential Loyalist"\n\nrfm["segment"] = rfm.apply(segment, axis=1)\nprint(rfm.groupby("segment")[["recency","frequency","monetary"]].mean().round(1))\nprint("\\nSegment counts:")\nprint(rfm["segment"].value_counts())\n',
	},
	{
		name: "Propensity Score Matching (PSM)",
		tags: ["Data Scientist", "Data Analyst"],
		difficulty: "Advanced",
		definition:
			"A technique that reduces selection bias in observational studies by matching treated and control units with similar probability of receiving treatment, given observed covariates.",
		formula:
			"Propensity score: e(X) = P(T=1 | X)\n\nEstimated via logistic regression:\n  e(X) = 1 / (1 + exp(−Xβ))\n\nATT (Average Treatment Effect on Treated):\n  ATT = E[Y(1) − Y(0) | T=1]\n      ≈ mean(Y_treated) − mean(Y_matched_control)",
		description:
			"**PSM pipeline:**\n1. Estimate propensity scores (logistic regression)\n2. Check common support — overlap in score distributions\n3. Match on score (nearest neighbor, caliper, kernel)\n4. Check covariate balance after matching (SMD < 0.1)\n5. Estimate treatment effect on matched sample",
		example:
			"Email campaign sent to active users (not random). PSM matches each recipient with a similar non-recipient — isolates email effect from activity bias.",
		useCases: [
			"Observational A/B analysis",
			"Marketing attribution",
			"Policy evaluation",
			"Retrospective clinical studies",
		],
		watchOut:
			"PSM only controls for *observed* confounders. Unmeasured confounders still bias results. Always conduct sensitivity analysis (Rosenbaum bounds).",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.neighbors import NearestNeighbors\n\nrng = np.random.default_rng(42)\nn = 2_000\nage      = rng.integers(18, 65, n).astype(float)\nlogins   = rng.poisson(10, n).astype(float)\ntreatment = (0.05 * logins + rng.normal(0, 1, n) > 0).astype(int)\noutcome  = 0.3 * logins + 2.5 * treatment + rng.normal(0, 2, n)\n\ndf = pd.DataFrame({"age": age, "logins": logins, "treatment": treatment, "outcome": outcome})\nX = df[["age", "logins"]]\nsc = StandardScaler()\nX_s = sc.fit_transform(X)\n\nlr = LogisticRegression().fit(X_s, df["treatment"])\ndf["pscore"] = lr.predict_proba(X_s)[:, 1]\n\ntreated = df[df["treatment"] == 1].copy()\ncontrol = df[df["treatment"] == 0].copy()\n\nnn = NearestNeighbors(n_neighbors=1).fit(control[["pscore"]])\n_, indices = nn.kneighbors(treated[["pscore"]])\nmatched_ctrl = control.iloc[indices.flatten()].copy()\n\nnaive_ate = treated["outcome"].mean() - control["outcome"].mean()\npsm_att   = treated["outcome"].mean() - matched_ctrl["outcome"].mean()\ntrue_att  = 2.5\n\nprint(f"True ATT          : {true_att:.3f}")\nprint(f"Naive estimate    : {naive_ate:.3f}  (biased — selection into treatment)")\nprint(f"PSM ATT estimate  : {psm_att:.3f}")\n\nsmd_before = (treated["logins"].mean() - control["logins"].mean()) / df["logins"].std()\nsmd_after  = (treated["logins"].mean() - matched_ctrl["logins"].mean()) / df["logins"].std()\nprint(f"\\nLogins SMD before matching: {smd_before:.3f}")\nprint(f"Logins SMD after  matching: {smd_after:.3f}  (target < 0.1)")\n',
	},
	{
		name: "Bayesian A/B Testing",
		tags: ["Data Scientist", "Data Analyst"],
		difficulty: "Advanced",
		definition:
			"A Bayesian approach to experiment analysis that outputs the full posterior distribution over the treatment effect, enabling direct probability statements like P(B > A).",
		formula:
			"Prior:      p ~ Beta(α₀, β₀)\nLikelihood: k successes in n trials ~ Binomial(n, p)\nPosterior:  p | data ~ Beta(α₀+k, β₀+n−k)\n\nP(B > A) = P(p_B > p_A) estimated by Monte Carlo\nExpected loss = E[max(0, p_A − p_B) | data]",
		description:
			"**Frequentist vs Bayesian output:**\n- Frequentist: p=0.03 → reject H₀ (binary decision, no prob statement on effect)\n- Bayesian: P(B > A) = 97%, expected lift = +0.8%, credible interval [+0.2%, +1.5%]\n\nBayesian testing allows continuous monitoring without inflating false positive rate.",
		example:
			"After 3,000 users: P(variant > control) = 94.2%, expected loss if we ship = 0.003% → ship it.",
		useCases: [
			"Early stopping A/B tests safely",
			"Small sample experiments",
			"Revenue metric testing",
			"Sequential analysis",
		],
		watchOut:
			"Prior choice affects results significantly with small samples. Use a weakly informative prior (Beta(1,1) or historical data) and document it explicitly.",
		code: 'import numpy as np\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\n\n# Prior: Beta(1,1) = uniform (no prior knowledge)\nalpha_prior, beta_prior = 1, 1\n\n# Observed data\nn_ctrl, conv_ctrl = 2_000, 82   # ~4.1%\nn_var,  conv_var  = 2_000, 104  # ~5.2%\n\n# Posterior: Beta(alpha + successes, beta + failures)\nctrl_post = stats.beta(alpha_prior + conv_ctrl, beta_prior + n_ctrl - conv_ctrl)\nvar_post  = stats.beta(alpha_prior + conv_var,  beta_prior + n_var  - conv_var)\n\n# Monte Carlo estimate\nN = 200_000\ns_ctrl = ctrl_post.rvs(N, random_state=42)\ns_var  = var_post.rvs(N, random_state=42)\n\nprob_var_wins = (s_var > s_ctrl).mean()\nexpected_lift = (s_var - s_ctrl).mean()\nexpected_loss = np.maximum(0, s_ctrl - s_var).mean()\nci = np.percentile(s_var - s_ctrl, [2.5, 97.5])\n\nprint(f"Control  posterior mean : {ctrl_post.mean()*100:.2f}%")\nprint(f"Variant  posterior mean : {var_post.mean()*100:.2f}%")\nprint(f"\\nP(variant > control)    : {prob_var_wins*100:.1f}%")\nprint(f"Expected lift           : {expected_lift*100:.3f}%")\nprint(f"Expected loss if ship   : {expected_loss*100:.4f}%")\nprint(f"95% credible interval   : [{ci[0]*100:.2f}%, {ci[1]*100:.2f}%]")\n',
	},
	{
		name: "Model Calibration",
		tags: ["Data Scientist"],
		difficulty: "Advanced",
		definition:
			"A model is well-calibrated when its predicted probabilities match observed event frequencies — a model that predicts 70% confidence should be right roughly 70% of the time.",
		formula:
			"Expected Calibration Error (ECE):\n  ECE = Σ (|B_m| / n) × |acc(B_m) − conf(B_m)|\n\nBrier Score:\n  BS = (1/n) × Σ (p̂ᵢ − yᵢ)²\n  Range [0,1], lower is better\n  Brier Skill Score = 1 − BS/BS_ref",
		description:
			"**Why calibration matters:**\n- AUC measures ranking ability — calibration measures probability accuracy\n- A model with AUC=0.95 can still be badly miscalibrated\n- Risk scoring, medical diagnosis, and financial models require calibrated probabilities\n\n**Fixes:** Platt scaling (logistic regression on scores), Isotonic regression (non-parametric).",
		example:
			"Churn model: users predicted at 80% probability actually churn 40% of the time → model is overconfident. Platt scaling fixes this.",
		useCases: [
			"Credit risk scoring",
			"Medical diagnosis models",
			"Insurance pricing",
			"Any model where the probability itself is consumed",
		],
		watchOut:
			"Calibration and discrimination are independent. Always evaluate both. A model can have poor AUC but great calibration, or vice versa.",
		code: 'import numpy as np\nfrom sklearn.datasets import make_classification\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.calibration import CalibratedClassifierCV, calibration_curve\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import brier_score_loss\n\nX, y = make_classification(n_samples=5_000, n_features=20, random_state=42,\n                            weights=[0.85, 0.15])\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, random_state=42)\n\nrf = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_tr, y_tr)\nrf_cal = CalibratedClassifierCV(rf, method="isotonic", cv=5).fit(X_tr, y_tr)\n\nfor name, model in [("Random Forest (uncal)", rf), ("RF + Isotonic Cal", rf_cal)]:\n    probs = model.predict_proba(X_te)[:, 1]\n    frac_pos, mean_pred = calibration_curve(y_te, probs, n_bins=10)\n    ece = np.mean(np.abs(frac_pos - mean_pred))\n    bs  = brier_score_loss(y_te, probs)\n    print(f"{name:25s}  ECE={ece:.4f}  Brier={bs:.4f}")\n\n# Reliability diagram data\nprobs_rf = rf.predict_proba(X_te)[:, 1]\nfrac, pred = calibration_curve(y_te, probs_rf, n_bins=10)\nprint("\\nReliability diagram (predicted → actual):")\nfor p, f in zip(pred.round(2), frac.round(2)):\n    bar = "█" * int(f * 20)\n    print(f"  {p:.2f} → {f:.2f}  {bar}")\n',
	},
	{
		name: "Shapley Values & Model Explainability (SHAP)",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"SHAP (SHapley Additive exPlanations) assigns each feature a contribution value to a specific prediction, based on Shapley values from cooperative game theory.",
		formula:
			"φᵢ = Σ [|S|!(|F|−|S|−1)!/|F|!] × [f(S∪{i}) − f(S)]\n  S ⊆ F\\{i}\n\nPrediction = base_value + Σ SHAP(feature_i)\n\nSHAP properties:\n  Efficiency: Σ φᵢ = f(x) − E[f(X)]\n  Symmetry, Dummy, Additivity",
		description:
			"**Types of SHAP explanations:**\n- **Local**: why did this specific prediction happen?\n- **Global**: which features matter most overall?\n- **Dependence plots**: how does feature X interact with feature Y?\n\nSHAP is model-agnostic but has efficient exact implementations for tree models (TreeSHAP: O(TLD²)).",
		example:
			"Loan denial: SHAP shows credit_score=−0.32, debt_ratio=−0.18, income=+0.12 → credit score was the primary reason for rejection.",
		useCases: [
			"Regulatory compliance (model explainability laws)",
			"Debugging model behavior",
			"Feature selection",
			"Customer-facing explanations",
		],
		watchOut:
			"SHAP values explain the model, not the true causal effect. A high SHAP value means the model relies on a feature — not that the feature causes the outcome.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.ensemble import GradientBoostingClassifier\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.datasets import load_breast_cancer\n# pip install shap\nimport shap\n\ndata = load_breast_cancer()\nX = pd.DataFrame(data.data, columns=data.feature_names)\ny = data.target\n\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\nmodel = GradientBoostingClassifier(n_estimators=100, random_state=42).fit(X_tr, y_tr)\n\nexplainer   = shap.TreeExplainer(model)\nshap_values = explainer.shap_values(X_te)\n\nmean_abs_shap = pd.Series(\n    np.abs(shap_values).mean(axis=0),\n    index=data.feature_names\n).sort_values(ascending=False)\n\nprint("Top 10 features by mean |SHAP|:")\nprint(mean_abs_shap.head(10).round(4))\n\ninstance_idx = 0\ninstance_shap = pd.Series(shap_values[instance_idx], index=data.feature_names)\nprint(f"\\nPrediction for instance {instance_idx}:")\nprint(f"  Base value   : {explainer.expected_value:.4f}")\nprint(f"  SHAP sum     : {instance_shap.sum():.4f}")\nprint(f"  Final logit  : {explainer.expected_value + instance_shap.sum():.4f}")\nprint("\\nTop 5 contributors:")\nprint(instance_shap.abs().sort_values(ascending=False).head(5).round(4))\n',
	},
	{
		name: "Instrumental Variables & Two-Stage Least Squares",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"An instrumental variable (IV) is a variable that affects the treatment but has no direct effect on the outcome — used to estimate causal effects when confounders are unobserved.",
		formula:
			"Validity conditions:\n  Relevance:  Cov(Z, T) ≠ 0  (instrument affects treatment)\n  Exclusion:  Cov(Z, ε) = 0  (instrument only affects Y through T)\n  Exogeneity: Z is independent of confounders\n\n2SLS:\n  Stage 1: T̂ = γ₀ + γ₁Z + controls\n  Stage 2: Y  = β₀ + β₁T̂ + controls + ε\n  β₁ is the LATE (Local Average Treatment Effect)",
		description:
			"2SLS isolates the variation in treatment caused by the instrument — which is (by assumption) unconfounded. The price: you only identify LATE (effect for compliers), and IV estimates have higher variance than OLS.",
		example:
			"Effect of education on earnings: instrument = distance to nearest college (affects years of schooling but not earnings directly). Removes ability bias from OLS.",
		useCases: [
			"Estimating causal returns to treatment in observational data",
			"Mendelian randomization in genetics",
			"Policy evaluation with partial compliance",
			"Pricing elasticity with cost instruments",
		],
		watchOut:
			"Weak instruments (F < 10 in Stage 1) produce biased and imprecise IV estimates. Always report the first-stage F-statistic.",
		code: 'import numpy as np\nimport pandas as pd\nimport statsmodels.api as sm\nfrom linearmodels.iv import IV2SLS\n\nrng = np.random.default_rng(42)\nn = 2_000\n\n# Data generating process\nability      = rng.normal(0, 1, n)         # unobserved confounder\ninstrument_z = rng.binomial(1, 0.5, n)     # distance to college (instrument)\neducation    = 12 + 2 * instrument_z + 1.5 * ability + rng.normal(0, 1, n)\nearnings     = 20 + 3 * education + 4 * ability + rng.normal(0, 5, n)\n\ndf = pd.DataFrame({"earnings": earnings, "education": education,\n                   "instrument": instrument_z, "ability": ability})\n\n# Naive OLS (biased — ability is unobserved)\nX_ols = sm.add_constant(df["education"])\nols = sm.OLS(df["earnings"], X_ols).fit()\nprint(f"OLS β (biased)   : {ols.params[\'education\']:.3f}  (true = 3.0, bias from ability)")\n\n# 2SLS\nX_2sls = df[["education"]]\nZ_2sls = df[["instrument"]]\nendog  = df["education"]\nexog   = pd.DataFrame({"const": np.ones(n)})\n\niv_model = IV2SLS(df["earnings"], exog, X_2sls, Z_2sls).fit(cov_type="robust")\nprint(f"2SLS β (causal)  : {iv_model.params[\'education\']:.3f}  (closer to true = 3.0)")\nprint(f"First-stage F    : {iv_model.first_stage.diagnostics[\'f.stat\'].values[0]:.1f}  (need > 10)")\n\n# Oracle OLS with ability (would never have in practice)\nX_oracle = sm.add_constant(df[["education", "ability"]])\noracle = sm.OLS(df["earnings"], X_oracle).fit()\nprint(f"Oracle OLS β     : {oracle.params[\'education\']:.3f}  (ideal with observed ability)")\n',
	},
	{
		name: "Transformer Architecture & Attention Mechanism",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"The transformer is a neural network architecture using self-attention to model relationships between all positions in a sequence simultaneously, without recurrence.",
		formula:
			"Attention(Q,K,V) = softmax(QKᵀ / √d_k) × V\n\nQ = XW_Q  (queries)\nK = XW_K  (keys)\nV = XW_V  (values)\nd_k = key dimension (scaling prevents vanishing gradients)\n\nMulti-Head: concat(head₁,...,headₕ) × W_O\nPositional encoding: PE(pos,2i) = sin(pos/10000^(2i/d))",
		description:
			"**Key components:**\n- **Self-attention**: each token attends to all others — captures long-range dependencies\n- **Multi-head attention**: multiple attention patterns in parallel\n- **Feed-forward**: per-position MLP after attention\n- **Layer norm + residual**: training stability\n\nFoundation of BERT, GPT, T5, and all modern LLMs.",
		example:
			"In 'The animal didn't cross the street because it was too tired', attention links 'it' to 'animal' — resolves coreference across distance.",
		useCases: [
			"Text classification and generation (LLMs)",
			"Tabular data (TabTransformer)",
			"Time series (Temporal Fusion Transformer)",
			"Recommendation systems",
		],
		watchOut:
			"Attention complexity is O(n²) in sequence length. For long sequences use efficient variants (Longformer, Flash Attention).",
		code: 'import numpy as np\n\ndef softmax(x, axis=-1):\n    e = np.exp(x - x.max(axis=axis, keepdims=True))\n    return e / e.sum(axis=axis, keepdims=True)\n\ndef scaled_dot_product_attention(Q, K, V):\n    d_k = Q.shape[-1]\n    scores = Q @ K.T / np.sqrt(d_k)      # (seq, seq)\n    weights = softmax(scores, axis=-1)    # attention weights\n    return weights @ V, weights\n\nrng = np.random.default_rng(42)\nseq_len, d_model = 5, 16\nd_k = d_v = 8\n\nX    = rng.normal(0, 1, (seq_len, d_model))\nW_Q  = rng.normal(0, 0.1, (d_model, d_k))\nW_K  = rng.normal(0, 0.1, (d_model, d_k))\nW_V  = rng.normal(0, 0.1, (d_model, d_v))\n\nQ = X @ W_Q\nK = X @ W_K\nV = X @ W_V\n\noutput, attn_weights = scaled_dot_product_attention(Q, K, V)\nprint(f"Input  shape : {X.shape}")\nprint(f"Output shape : {output.shape}")\nprint(f"Attn weights shape: {attn_weights.shape}")\nprint("\\nAttention weight matrix (row i = how much token i attends to each token):")\nprint(attn_weights.round(3))\nprint(f"\\nEach row sums to: {attn_weights.sum(axis=1).round(4)}")\n',
	},
	{
		name: "Approximate Nearest Neighbor Search (ANN)",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Expert",
		definition:
			"Algorithms that find the most similar vectors in high-dimensional spaces in sub-linear time by trading exact recall for speed, enabling real-time similarity search at scale.",
		formula:
			"Exact NN: O(n × d) — linear scan\n\nHNSW (Hierarchical Navigable Small World):\n  Build: O(n × log n)\n  Query: O(log n)\n  Space: O(n × M)  [M = connections per node]\n\nIVF (Inverted File Index):\n  Cluster into C centroids\n  Query: search top nprobe clusters only",
		description:
			"**Key algorithms:**\n| Method | Speed | Recall | Memory | Notes |\n|--------|-------|--------|--------|---------|\n| Brute force | Slow | 100% | Low | Ground truth |\n| LSH | Fast | ~85% | Low | Hash-based |\n| HNSW | Fast | ~99% | High | Best accuracy/speed |\n| IVF+PQ | Fast | ~95% | Low | Compressed vectors |",
		example:
			"1M product embeddings (768d) → HNSW index builds in 3 minutes, queries in <1ms at 98% recall. Brute force: 200ms per query.",
		useCases: [
			"Vector database backends (Pinecone, Weaviate, pgvector)",
			"RAG retrieval",
			"Real-time recommendations",
			"Semantic search at scale",
		],
		watchOut:
			"Recall vs. speed is tunable via `ef_search` (HNSW) or `nprobe` (IVF). Benchmark at your target latency, not maximum recall.",
		code: 'import numpy as np\nimport time\n# pip install faiss-cpu\nimport faiss\n\nrng = np.random.default_rng(42)\nd = 128          # embedding dimension\nn_corpus = 100_000\nn_queries = 100\n\ncorpus  = rng.random((n_corpus, d)).astype("float32")\nqueries = rng.random((n_queries, d)).astype("float32")\nfaiss.normalize_L2(corpus)\nfaiss.normalize_L2(queries)\n\n# Brute force (exact)\nt0 = time.time()\nindex_flat = faiss.IndexFlatIP(d)\nindex_flat.add(corpus)\n_, I_exact = index_flat.search(queries, k=5)\nt_exact = time.time() - t0\nprint(f"Exact (Flat IP)  : {t_exact*1000:.1f}ms  recall=100%")\n\n# HNSW (approximate)\nindex_hnsw = faiss.IndexHNSWFlat(d, 32)  # M=32 connections\nindex_hnsw.hnsw.efConstruction = 64\nindex_hnsw.add(corpus)\nt0 = time.time()\n_, I_hnsw = index_hnsw.search(queries, k=5)\nt_hnsw = time.time() - t0\n\noverlap = sum(len(set(I_exact[i]) & set(I_hnsw[i])) for i in range(n_queries))\nrecall = overlap / (n_queries * 5)\nprint(f"HNSW             : {t_hnsw*1000:.1f}ms  recall={recall:.3f}")\nprint(f"Speedup          : {t_exact/t_hnsw:.1f}x")\n',
	},
	{
		name: "Decision Trees (CART Algorithm)",
		tags: ["Data Scientist", "Data Analyst"],
		difficulty: "Intermediate",
		definition:
			"A tree-structured model that recursively splits data using binary rules on features, creating a hierarchy of decisions that maps inputs to outputs.",
		formula:
			"Split criterion (Gini impurity):\n  Gini(t) = 1 − Σ pᵢ²\n\nSplit criterion (Variance reduction for regression):\n  ΔVar = Var(parent) − [n_L/n × Var(left) + n_R/n × Var(right)]\n\nLeaf prediction:\n  Classification: majority class\n  Regression:     mean of leaf samples",
		description:
			"CART (Classification and Regression Trees) finds the single best binary split at each node by exhaustively searching all features and thresholds. Stops when max_depth, min_samples_leaf, or pure leaves are reached.\n\n**Pruning** removes branches that add little predictive power, trading accuracy on training data for better generalization.",
		example:
			"Churn tree: first split on `days_since_login > 30` → left node (high churn risk) → next split on `plan == free` → leaf: 72% churn probability.",
		useCases: [
			"Interpretable business rules",
			"Feature importance baseline",
			"Building block for Random Forests / XGBoost",
			"Decision support systems",
		],
		watchOut:
			"Unpruned trees memorize training data perfectly. A single tree is high-variance — small data changes produce very different trees. Use as a baseline, not a final model.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor, export_text\nfrom sklearn.datasets import load_breast_cancer\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import accuracy_score\n\ndata = load_breast_cancer()\nX, y = data.data, data.target\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\n\nfor depth in [2, 4, 6, None]:\n    dt = DecisionTreeClassifier(max_depth=depth, criterion="gini", random_state=42)\n    dt.fit(X_tr, y_tr)\n    tr_acc = accuracy_score(y_tr, dt.predict(X_tr))\n    te_acc = accuracy_score(y_te, dt.predict(X_te))\n    n_leaves = dt.get_n_leaves()\n    print(f"depth={str(depth):4s}  train={tr_acc:.3f}  test={te_acc:.3f}  leaves={n_leaves:3d}")\n\nbest = DecisionTreeClassifier(max_depth=4, random_state=42).fit(X_tr, y_tr)\nprint("\\nTree structure (depth=4):")\nprint(export_text(best, feature_names=list(data.feature_names), max_depth=3))\n\nimportances = pd.Series(best.feature_importances_, index=data.feature_names)\nprint("Top 5 features:")\nprint(importances.nlargest(5).round(4))\n',
	},
	{
		name: "Neural Networks & Backpropagation",
		tags: ["Data Scientist"],
		difficulty: "Advanced",
		definition:
			"A neural network is a layered composition of linear transformations and non-linear activation functions. Backpropagation uses the chain rule to compute gradients of the loss with respect to every weight.",
		formula:
			"Forward pass:\n  z⁽ˡ⁾ = W⁽ˡ⁾ a⁽ˡ⁻¹⁾ + b⁽ˡ⁾\n  a⁽ˡ⁾ = σ(z⁽ˡ⁾)\n\nBackward pass (chain rule):\n  δ⁽ˡ⁾ = (W⁽ˡ⁺¹⁾ᵀ δ⁽ˡ⁺¹⁾) ⊙ σ′(z⁽ˡ⁾)\n  ∂L/∂W⁽ˡ⁾ = δ⁽ˡ⁾ (a⁽ˡ⁻¹⁾)ᵀ\n\nActivations: ReLU = max(0,x), Sigmoid = 1/(1+e⁻ˣ)",
		description:
			"**Common activations:**\n| Function | Range | Use Case |\n|----------|-------|----------|\n| ReLU | [0, ∞) | Hidden layers (default) |\n| Sigmoid | (0, 1) | Binary output |\n| Softmax | (0,1) sum=1 | Multi-class output |\n| Tanh | (−1, 1) | RNNs, zero-centered |\n| LeakyReLU | (−∞,∞) | Avoids dying ReLU |",
		example:
			"3-layer MLP: input(20) → hidden(64, ReLU) → hidden(32, ReLU) → output(1, Sigmoid). Backprop adjusts all 64×20 + 32×64 + 1×32 weights each step.",
		useCases: [
			"Image classification",
			"Tabular deep learning",
			"Time series (LSTM/GRU)",
			"Foundation for all deep learning architectures",
		],
		watchOut:
			"Vanishing gradients: deep sigmoid networks stop learning in early layers. Use ReLU + batch normalization + residual connections to fix.",
		code: 'import numpy as np\nfrom sklearn.datasets import make_classification\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.metrics import roc_auc_score\nimport torch\nimport torch.nn as nn\nfrom torch.utils.data import DataLoader, TensorDataset\n\nX, y = make_classification(n_samples=2_000, n_features=20, n_informative=10, random_state=42)\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\nsc = StandardScaler()\nX_tr = sc.fit_transform(X_tr); X_te = sc.transform(X_te)\n\nX_tr_t = torch.FloatTensor(X_tr); y_tr_t = torch.FloatTensor(y_tr)\nX_te_t = torch.FloatTensor(X_te)\n\nclass MLP(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.net = nn.Sequential(\n            nn.Linear(20, 64), nn.ReLU(), nn.Dropout(0.3),\n            nn.Linear(64, 32), nn.ReLU(), nn.Dropout(0.3),\n            nn.Linear(32, 1),  nn.Sigmoid()\n        )\n    def forward(self, x): return self.net(x).squeeze()\n\nmodel    = MLP()\noptim    = torch.optim.Adam(model.parameters(), lr=1e-3)\nloss_fn  = nn.BCELoss()\nloader   = DataLoader(TensorDataset(X_tr_t, y_tr_t), batch_size=64, shuffle=True)\n\nfor epoch in range(20):\n    for xb, yb in loader:\n        optim.zero_grad()\n        loss_fn(model(xb), yb).backward()\n        optim.step()\n\nmodel.eval()\nwith torch.no_grad():\n    probs = model(X_te_t).numpy()\nprint(f"AUC-ROC: {roc_auc_score(y_te, probs):.4f}")\n',
	},
	{
		name: "Hyperparameter Tuning",
		tags: ["Data Scientist"],
		difficulty: "Advanced",
		definition:
			"The process of finding the optimal configuration of model settings (not learned from data) that maximizes generalization performance.",
		formula:
			"Grid Search:    exhaustive search over all combinations\nRandom Search:  sample n random combinations\n\nBayesian Optimization:\n  Fit surrogate model (GP) on observed (params → score)\n  Maximize acquisition function (EI, UCB)\n  Evaluate at argmax → update surrogate\n\nEI(x) = E[max(0, f(x) − f(x⁺))]",
		description:
			"| Method | Evaluations | Best For |\n|--------|-------------|----------|\n| Grid Search | All combos | ≤3 params, small ranges |\n| Random Search | n samples | 4+ params |\n| Bayesian (Optuna) | Intelligent | Expensive models |\n| Successive Halving | Budget-aware | Large search spaces |",
		example:
			"XGBoost with 5 hyperparameters: grid search = 10,000 fits. Random search with 100 trials finds 95% as good in 1% of the time.",
		useCases: [
			"All ML model training pipelines",
			"Neural architecture search",
			"AutoML systems",
			"Competition optimization",
		],
		watchOut:
			"Tune hyperparameters on a validation set, never the test set. Nested CV is required for unbiased performance estimates when tuning and evaluating simultaneously.",
		code: 'import numpy as np\nfrom sklearn.datasets import make_classification\nfrom sklearn.ensemble import GradientBoostingClassifier\nfrom sklearn.model_selection import (train_test_split, RandomizedSearchCV,\n                                      cross_val_score)\nfrom sklearn.metrics import roc_auc_score\nfrom scipy.stats import uniform, randint\nimport optuna\noptuna.logging.set_verbosity(optuna.logging.WARNING)\n\nX, y = make_classification(n_samples=2_000, n_features=20, n_informative=10, random_state=42)\nX_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)\n\nparam_dist = {\n    "n_estimators":    randint(50, 300),\n    "max_depth":       randint(2, 8),\n    "learning_rate":   uniform(0.01, 0.3),\n    "subsample":       uniform(0.6, 0.4),\n    "min_samples_leaf": randint(5, 50),\n}\nrs = RandomizedSearchCV(GradientBoostingClassifier(random_state=42),\n                        param_dist, n_iter=30, cv=5, scoring="roc_auc",\n                        random_state=42, n_jobs=-1)\nrs.fit(X_tr, y_tr)\nprint(f"RandomSearch best AUC: {rs.best_score_:.4f}")\nprint(f"Best params: {rs.best_params_}")\n\ndef objective(trial):\n    params = {\n        "n_estimators":  trial.suggest_int("n_estimators", 50, 300),\n        "max_depth":     trial.suggest_int("max_depth", 2, 8),\n        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),\n        "subsample":     trial.suggest_float("subsample", 0.6, 1.0),\n    }\n    model = GradientBoostingClassifier(**params, random_state=42)\n    return cross_val_score(model, X_tr, y_tr, cv=3, scoring="roc_auc").mean()\n\nstudy = optuna.create_study(direction="maximize")\nstudy.optimize(objective, n_trials=30, show_progress_bar=False)\nprint(f"Optuna best AUC: {study.best_value:.4f}")\n',
	},
	{
		name: "Model Drift & Monitoring",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Advanced",
		definition:
			"Model drift is the degradation of model performance over time due to changes in the real-world data distribution (data drift) or the relationship between inputs and outputs (concept drift).",
		formula:
			"Data drift (PSI — Population Stability Index):\n  PSI = Σ (Actual% − Expected%) × ln(Actual%/Expected%)\n  PSI < 0.1 → stable\n  PSI 0.1–0.25 → monitor\n  PSI > 0.25 → retrain\n\nKS Test: max|F_train(x) − F_prod(x)|",
		description:
			"**Types of drift:**\n- **Data drift (covariate shift)**: P(X) changes, P(Y|X) stable\n- **Concept drift**: P(Y|X) changes — the world changed\n- **Label drift**: P(Y) changes — class balance shifts\n- **Upstream drift**: schema change or pipeline bug\n\n**Monitoring stack**: prediction distribution → feature distributions → PSI/KS alerts → performance metrics (when labels available).",
		example:
			"Fraud model trained in 2023: PSI for transaction_amount spikes to 0.38 in Q1 2024 after inflation. Model flags too many legitimate transactions — retrain required.",
		useCases: [
			"Production ML model health",
			"Scheduled retraining triggers",
			"Data pipeline quality gates",
			"SLA compliance",
		],
		watchOut:
			"Performance metrics lag reality — you need ground truth labels to compute them. Drift metrics (PSI, KS) give earlier warning without labels.",
		code: 'import numpy as np\nimport pandas as pd\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\ntrain_data = rng.normal(50, 10, 5_000)\nstable_prod = rng.normal(50, 10, 1_000)\ndrifted_prod = rng.normal(65, 15, 1_000)\n\ndef psi(expected, actual, n_bins=10):\n    bins = np.percentile(expected, np.linspace(0, 100, n_bins + 1))\n    bins[0], bins[-1] = -np.inf, np.inf\n    exp_pct = np.histogram(expected, bins=bins)[0] / len(expected)\n    act_pct = np.histogram(actual,   bins=bins)[0] / len(actual)\n    exp_pct = np.where(exp_pct == 0, 1e-6, exp_pct)\n    act_pct = np.where(act_pct == 0, 1e-6, act_pct)\n    return np.sum((act_pct - exp_pct) * np.log(act_pct / exp_pct))\n\nks_stable  = stats.ks_2samp(train_data, stable_prod)\nks_drifted = stats.ks_2samp(train_data, drifted_prod)\n\nprint("--- Stable production data ---")\nprint(f"  PSI : {psi(train_data, stable_prod):.4f}  (<0.1 = stable)")\nprint(f"  KS  : stat={ks_stable.statistic:.4f}  p={ks_stable.pvalue:.4f}")\n\nprint("\\n--- Drifted production data ---")\nprint(f"  PSI : {psi(train_data, drifted_prod):.4f}  (>0.25 = retrain)")\nprint(f"  KS  : stat={ks_drifted.statistic:.4f}  p={ks_drifted.pvalue:.6f}")\n\nwindow_size = 100\nrolling_means = pd.Series(drifted_prod).rolling(window_size).mean()\ndrift_detected = rolling_means[rolling_means > 60].index[0] if any(rolling_means > 60) else None\nprint(f"\\nRolling mean breach detected at index: {drift_detected}")\n',
	},
	{
		name: "Reinforcement Learning Fundamentals",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"A learning paradigm where an agent learns to maximize cumulative reward by taking actions in an environment, receiving feedback, and updating its policy.",
		formula:
			"Bellman equation:\n  V(s) = max_a [ R(s,a) + γ × Σ P(s′|s,a) × V(s′) ]\n\nQ-learning update:\n  Q(s,a) ← Q(s,a) + α[r + γ × max_a′ Q(s′,a′) − Q(s,a)]\n\nPolicy gradient (REINFORCE):\n  ∇J(θ) = E[∇logπ_θ(a|s) × G_t]",
		description:
			"**Key concepts:**\n- **State (s)**: current situation\n- **Action (a)**: choice made by agent\n- **Reward (r)**: feedback signal\n- **Policy (π)**: mapping from state to action\n- **Value function V(s)**: expected cumulative reward from state s\n- **Discount factor γ**: weight of future rewards (0=myopic, 1=far-sighted)",
		example:
			"Recommender as RL: state = user context, action = item to show, reward = click/purchase. Policy learns to maximize long-term engagement, not just immediate clicks.",
		useCases: [
			"Game playing (AlphaGo, OpenAI Five)",
			"Robotic control",
			"Ad bid optimization",
			"LLM fine-tuning (RLHF)",
		],
		watchOut:
			"Sample efficiency is the core challenge — RL requires millions of environment interactions to learn. Reward shaping bugs cause catastrophic unexpected behavior.",
		code: 'import numpy as np\n\nrng = np.random.default_rng(42)\n\n# Simple grid world Q-learning\nn_states, n_actions = 16, 4   # 4x4 grid, 4 directions\ngoal_state = 15\nQ = np.zeros((n_states, n_actions))\n\nalpha, gamma, epsilon = 0.1, 0.95, 0.3\n\ndef step(state, action):\n    row, col = state // 4, state % 4\n    moves = [(-1,0),(1,0),(0,-1),(0,1)]   # up, down, left, right\n    dr, dc = moves[action]\n    new_row = max(0, min(3, row + dr))\n    new_col = max(0, min(3, col + dc))\n    next_state = new_row * 4 + new_col\n    reward = 10.0 if next_state == goal_state else -0.1\n    done = next_state == goal_state\n    return next_state, reward, done\n\nfor episode in range(2_000):\n    state = rng.integers(0, 15)\n    for _ in range(50):\n        if rng.random() < epsilon:\n            action = rng.integers(0, n_actions)\n        else:\n            action = np.argmax(Q[state])\n        next_state, reward, done = step(state, action)\n        td_target = reward + gamma * np.max(Q[next_state]) * (1 - done)\n        Q[state, action] += alpha * (td_target - Q[state, action])\n        state = next_state\n        if done: break\n\nprint("Learned Q-values (best action per state):")\npolicy_names = ["↑","↓","←","→"]\nfor s in range(n_states):\n    best = policy_names[np.argmax(Q[s])]\n    val  = Q[s].max()\n    print(f"  s={s:2d}: {best}  V={val:.3f}", end="  " if s % 4 < 3 else "\\n")\n',
	},
	{
		name: "Anomaly Detection in Time Series",
		tags: ["Data Scientist", "Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"Identifying time points where a metric deviates significantly from its expected value given its historical pattern, seasonality, and trend.",
		formula:
			"STL residual method:\n  residual(t) = y(t) − trend(t) − seasonal(t)\n  anomaly if |residual(t)| > k × σ_residual\n\nFacebook Prophet anomaly:\n  anomaly if y(t) ∉ [yhat_lower, yhat_upper]\n\nIQR on residuals:\n  anomaly if residual < Q1 − 3×IQR or > Q3 + 3×IQR",
		description:
			"**Types of time series anomalies:**\n- **Point anomaly**: single outlier spike\n- **Contextual anomaly**: normal value in wrong context (e.g., Sunday traffic on Monday)\n- **Collective anomaly**: sequence of values that together are abnormal\n\nKey challenge: distinguishing real anomalies from seasonal patterns and trend changes.",
		example:
			"Daily signups: sudden spike on Tuesday → anomaly. But December always spikes → seasonal, not anomaly. STL decomposition separates these.",
		useCases: [
			"Infrastructure metric alerting",
			"Business KPI anomaly detection",
			"Fraud pattern detection",
			"IoT sensor monitoring",
		],
		watchOut:
			"Static thresholds fail as the metric grows. Always use relative thresholds (% deviation from expected) or model-based bounds, not absolute cutoffs.",
		code: 'import numpy as np\nimport pandas as pd\nfrom statsmodels.tsa.seasonal import STL\n\nrng = np.random.default_rng(42)\ndates = pd.date_range("2023-01-01", periods=365, freq="D")\ntrend    = np.linspace(100, 150, 365)\nseasonal = 20 * np.sin(2 * np.pi * np.arange(365) / 7)\nnoise    = rng.normal(0, 5, 365)\nsignal   = trend + seasonal + noise\n\nsignal[100] += 80   # point anomaly\nsignal[200:205] += 40  # collective anomaly\n\nseries = pd.Series(signal, index=dates, name="signups")\n\nstl = STL(series, period=7, robust=True).fit()\nresiduals = stl.resid\n\nq1, q3 = np.percentile(residuals, [25, 75])\niqr = q3 - q1\nlower, upper = q1 - 3 * iqr, q3 + 3 * iqr\n\nanomalies = series[(residuals < lower) | (residuals > upper)]\nprint(f"Detected {len(anomalies)} anomalies:")\nprint(anomalies.round(1))\n\nsigma = residuals.std()\nzscore_anomalies = series[np.abs(residuals) > 3 * sigma]\nprint(f"\\nZ-score method (3σ): {len(zscore_anomalies)} anomalies")\nprint(f"Trend range  : {stl.trend.min():.1f} – {stl.trend.max():.1f}")\nprint(f"Seasonal amp : ±{stl.seasonal.std():.1f}")\n',
	},
	{
		name: "DAU / MAU / WAU & Engagement Ratios",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"Activity metrics counting unique users who interact with a product in a given time window: Daily, Weekly, or Monthly Active Users.",
		formula:
			"DAU  = distinct users active on a given day\nWAU  = distinct users active in a rolling 7-day window\nMAU  = distinct users active in a rolling 28/30-day window\n\nDAU/MAU ratio (stickiness) = DAU / MAU\n  > 0.20 → good retention signal\n  > 0.50 → exceptional (WhatsApp-level)\n\nL7 = users active on 7 of last 7 days (power users)",
		description:
			"**Common traps:**\n- MAU hides churn: you can grow MAU while losing core users if acquisition > churn\n- Definition matters: 'active' must be a meaningful action, not just a login or session open\n- Rolling vs calendar windows give different results — document which you use",
		example:
			"App: MAU=500K, DAU=75K → stickiness=15% (needs improvement). Competitor: MAU=300K, DAU=90K → stickiness=30% (much healthier engagement).",
		useCases: [
			"Product health dashboards",
			"Investor reporting",
			"Growth vs retention decomposition",
			"Benchmark against competitors",
		],
		watchOut:
			"Stickiness alone is misleading for weekly-use products (e.g. gym apps). Always contextualize with product use-case frequency.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nn_events = 50_000\nevents = pd.DataFrame({\n    "user_id": rng.integers(1, 10_001, n_events),\n    "date":    pd.to_datetime(rng.choice(\n        pd.date_range("2024-01-01", "2024-03-31"), n_events)),\n})\n\ndau = events.groupby("date")["user_id"].nunique().rename("DAU")\n\nmau_list = []\nfor date in pd.date_range("2024-01-28", "2024-03-31"):\n    window = events[(events["date"] > date - pd.Timedelta(days=28)) &\n                    (events["date"] <= date)]\n    mau_list.append({"date": date, "MAU": window["user_id"].nunique()})\nmau = pd.DataFrame(mau_list).set_index("date")["MAU"]\n\nmetrics = pd.concat([dau, mau], axis=1).dropna()\nmetrics["stickiness"] = (metrics["DAU"] / metrics["MAU"]).round(3)\n\nprint(metrics.tail(10))\nprint(f"\\nAvg DAU         : {metrics[\'DAU\'].mean():,.0f}")\nprint(f"Avg MAU         : {metrics[\'MAU\'].mean():,.0f}")\nprint(f"Avg stickiness  : {metrics[\'stickiness\'].mean():.3f}")\n\npower_users = (events.groupby("user_id")["date"]\n               .nunique()\n               .pipe(lambda s: (s >= 21).sum()))\nprint(f"Power users (active 21+ days): {power_users:,}")\n',
	},
	{
		name: "North Star Metric & Metric Trees",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"A North Star Metric (NSM) is the single metric that best captures the core value a product delivers to users. A metric tree decomposes it into measurable, actionable sub-metrics.",
		formula:
			"NSM decomposition (multiplicative):\n  NSM = Driver₁ × Driver₂ × Driver₃\n\nExample (e-commerce revenue):\n  Revenue = Visitors × CVR × AOV\n  CVR     = Sessions with purchase / Total sessions\n  AOV     = Revenue / Orders\n\nWoW growth decomposition:\n  ΔNSM = ΔNSM_new + ΔNSM_retained − ΔNSM_churned",
		description:
			"**Good NSM criteria:**\n- Reflects value delivered to users (not just business value)\n- Leads revenue, not lags it\n- Actionable by multiple teams\n- Sensitive to product changes\n\n**Examples:** Airbnb = nights booked, Spotify = time listening, Slack = messages sent, LinkedIn = weekly active professionals.",
		example:
			"NSM = Weekly Active Buyers. Tree: WAB = MAU × purchase_rate. MAU = new_users + retained_users. purchase_rate = sessions_with_purchase / sessions.",
		useCases: [
			"OKR / goal setting",
			"Team metric alignment",
			"Root cause analysis frameworks",
			"Dashboard design",
		],
		watchOut:
			"Optimizing a sub-metric without watching the NSM leads to local maxima. A team improving CTR while degrading purchase rate is moving in the wrong direction.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nweeks = pd.date_range("2024-01-01", periods=12, freq="W")\n\ndata = pd.DataFrame({\n    "week":         weeks,\n    "visitors":     rng.integers(80_000, 120_000, 12),\n    "sessions":     rng.integers(100_000, 160_000, 12),\n    "purchases":    rng.integers(3_000, 5_000, 12),\n    "revenue":      rng.uniform(400_000, 700_000, 12),\n})\n\ndata["CVR"]  = data["purchases"] / data["visitors"]\ndata["AOV"]  = data["revenue"]   / data["purchases"]\ndata["NSM"]  = data["revenue"]              # North Star = Revenue\ndata["NSM_check"] = data["visitors"] * data["CVR"] * data["AOV"]\n\ndata["NSM_wow"] = data["NSM"].pct_change() * 100\ndata["CVR_wow"] = data["CVR"].pct_change() * 100\ndata["AOV_wow"] = data["AOV"].pct_change() * 100\ndata["vis_wow"] = data["visitors"].pct_change() * 100\n\nprint(data[["week","NSM","CVR","AOV","NSM_wow","CVR_wow","AOV_wow"]].round(2).to_string(index=False))\n\nlatest = data.iloc[-1]\nprint(f"\\nLatest NSM drivers:")\nprint(f"  Visitors : {latest[\'visitors\']:,}")\nprint(f"  CVR      : {latest[\'CVR\']*100:.2f}%")\nprint(f"  AOV      : ${latest[\'AOV\']:.2f}")\nprint(f"  Revenue  : ${latest[\'NSM\']:,.0f}")\n',
	},
	{
		name: "SaaS Business Metrics (MRR, ARR, NRR, NDR)",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"Standardized financial metrics for subscription businesses that track revenue predictability, growth, and the quality of existing customer relationships.",
		formula:
			"MRR = Σ monthly recurring revenue across all active subscriptions\nARR = MRR × 12\n\nMRR movement:\n  Net New MRR = New MRR + Expansion MRR − Churned MRR − Contraction MRR\n\nNRR (Net Revenue Retention):\n  NRR = (Beginning MRR + Expansion − Churn − Contraction) / Beginning MRR × 100\n\nGross Revenue Retention (GRR):\n  GRR = (Beginning MRR − Churn − Contraction) / Beginning MRR × 100",
		description:
			"**Benchmarks:**\n- NRR > 100%: revenue grows from existing customers alone (expansion > churn)\n- NRR > 120%: world-class (Snowflake, Datadog territory)\n- GRR > 90%: healthy downgrade/churn control\n- Quick Ratio = (New + Expansion) / (Churn + Contraction) > 4 = efficient growth",
		example:
			"Jan MRR=$100K. Feb: +$20K new, +$8K expansion, −$5K churn, −$2K contraction. Feb MRR=$121K. NRR=(100+8−5−2)/100=101%.",
		useCases: [
			"Investor reporting",
			"Board dashboards",
			"Sales and CS team targets",
			"Valuation multiples (ARR-based)",
		],
		watchOut:
			"NRR > 100% does NOT mean you don't have churn. It means expansion revenue is outpacing churn. GRR reveals the true churn picture.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nmonths = pd.date_range("2024-01", periods=12, freq="ME")\n\nmrr = pd.DataFrame({\n    "month":       months,\n    "new_mrr":     rng.integers(15_000, 30_000, 12),\n    "expansion":   rng.integers(5_000, 12_000, 12),\n    "churn_mrr":   rng.integers(3_000, 8_000, 12),\n    "contraction": rng.integers(1_000, 3_000, 12),\n})\nmrr["beginning_mrr"] = 100_000\nfor i in range(1, len(mrr)):\n    mrr.loc[i, "beginning_mrr"] = (\n        mrr.loc[i-1, "beginning_mrr"]\n        + mrr.loc[i-1, "new_mrr"]\n        + mrr.loc[i-1, "expansion"]\n        - mrr.loc[i-1, "churn_mrr"]\n        - mrr.loc[i-1, "contraction"]\n    )\n\nmrr["ending_mrr"] = (mrr["beginning_mrr"] + mrr["new_mrr"] +\n                     mrr["expansion"] - mrr["churn_mrr"] - mrr["contraction"])\nmrr["NRR"] = ((mrr["beginning_mrr"] + mrr["expansion"] -\n               mrr["churn_mrr"] - mrr["contraction"]) /\n               mrr["beginning_mrr"] * 100).round(1)\nmrr["GRR"] = ((mrr["beginning_mrr"] - mrr["churn_mrr"] -\n               mrr["contraction"]) / mrr["beginning_mrr"] * 100).round(1)\nmrr["quick_ratio"] = ((mrr["new_mrr"] + mrr["expansion"]) /\n                       (mrr["churn_mrr"] + mrr["contraction"])).round(2)\nmrr["ARR"] = mrr["ending_mrr"] * 12\n\nprint(mrr[["month","ending_mrr","NRR","GRR","quick_ratio","ARR"]].to_string(index=False))\nprint(f"\\nAvg NRR: {mrr[\'NRR\'].mean():.1f}%  |  Avg GRR: {mrr[\'GRR\'].mean():.1f}%")\nprint(f"Final ARR: ${mrr[\'ARR\'].iloc[-1]:,.0f}")\n',
	},
	{
		name: "Chart Selection & Data Visualization Principles",
		tags: ["Data Analyst", "Analytics Engineer"],
		difficulty: "Foundational",
		definition:
			"Choosing the right chart type based on the relationship being communicated and the data types involved, following perceptual principles that maximize clarity.",
		formula:
			"Lie Factor (Tufte) = size of effect in graphic / size of effect in data\n  Ideal = 1.0\n\nData-Ink Ratio = data ink / total ink\n  Maximize: remove non-data ink\n\nChart selection logic:\n  Comparison over time   → line chart\n  Part-to-whole          → bar chart (not pie)\n  Distribution           → histogram / box plot\n  Correlation            → scatter plot\n  Composition over time  → stacked area\n  Ranking                → horizontal bar",
		description:
			"**Core principles (Tufte, Few):**\n- Maximize data-ink ratio — remove grid lines, borders, chart junk\n- Start y-axis at zero for bar charts (never for line charts)\n- Use color to encode meaning, not decoration\n- Order categorical axes by value, not alphabetically\n- Avoid 3D charts — they distort perception",
		example:
			"Comparing 5 categories over time: use line chart (not grouped bar chart — too busy). Showing single month's breakdown: horizontal bar chart sorted by value.",
		useCases: [
			"Dashboard design",
			"Executive presentation",
			"Exploratory data analysis",
			"Stakeholder reporting",
		],
		watchOut:
			"Pie charts fail beyond 3–4 slices. Human perception is poor at comparing angles — use bar charts instead.",
		code: 'import pandas as pd\nimport numpy as np\n\nchart_guide = pd.DataFrame({\n    "question": [\n        "How does X change over time?",\n        "How do categories compare?",\n        "What is the distribution?",\n        "How are two variables related?",\n        "What is the part-whole breakdown?",\n        "How do groups differ statistically?",\n        "Where are things located?",\n        "How does X correlate across many vars?",\n    ],\n    "best_chart": [\n        "Line chart",\n        "Horizontal bar (sorted by value)",\n        "Histogram / KDE / Box plot",\n        "Scatter plot",\n        "Bar chart (not pie)",\n        "Box plot / Violin plot",\n        "Map / Scatter with geo coords",\n        "Heatmap (correlation matrix)",\n    ],\n    "avoid": [\n        "Bar chart",\n        "Pie / Donut chart",\n        "Line chart",\n        "Bar chart",\n        "Pie chart (>3 slices)",\n        "Bar chart of means only",\n        "Bar chart",\n        "Individual scatter plots",\n    ],\n    "data_types": [\n        "Continuous Y, datetime X",\n        "Continuous Y, categorical X",\n        "Continuous X",\n        "Continuous X and Y",\n        "Proportions of categorical",\n        "Continuous Y, categorical groups",\n        "Lat/lon + metric",\n        "Multiple continuous vars",\n    ]\n})\nprint(chart_guide.to_string(index=False))\n\nrng = np.random.default_rng(42)\ndata = pd.DataFrame({\n    "category": list("ABCDE"),\n    "value":    rng.integers(10, 100, 5),\n})\nprint("\\nSorted horizontal bar data (correct):")\nprint(data.sort_values("value", ascending=False))\nprint("\\nAlphabetical order (wrong — harder to compare):")\nprint(data.sort_values("category"))\n',
	},
	{
		name: "dbt Testing & Documentation Patterns",
		tags: ["Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"dbt tests validate data quality assertions on transformed models. Documentation creates a queryable data catalog with column-level descriptions and lineage.",
		formula:
			"Built-in dbt tests:\n  unique:       SELECT count(*) > 0 WHERE count(col) > 1\n  not_null:     SELECT count(*) WHERE col IS NULL\n  accepted_values: SELECT col NOT IN (list)\n  relationships:  FK integrity check\n\nTest severity:\n  error   → pipeline fails\n  warn    → logs warning, continues",
		description:
			"**Test pyramid for dbt:**\n- **Source tests**: raw data freshness + schema\n- **Staging tests**: uniqueness + not_null on PKs\n- **Mart tests**: business logic assertions, referential integrity\n- **Custom tests**: SQL macros for complex rules (revenue > 0, date ranges)\n\ndbt-expectations and dbt-utils extend native tests significantly.",
		example:
			"fact_orders: `order_id` unique + not_null. `revenue` > 0 (custom test). `customer_id` references dim_customers. Freshness: source updated within 24h.",
		useCases: [
			"Data contract enforcement in CI/CD",
			"Pipeline observability",
			"Onboarding documentation",
			"Governance and compliance",
		],
		watchOut:
			"Tests without severity=error are suggestions, not guards. Set error thresholds on business-critical columns and warn on secondary columns.",
		code: '# dbt schema.yml equivalent — shown as Python dict for illustration\n# In practice this lives in schema.yml alongside your .sql model files\n\nschema_config = {\n    "version": 2,\n    "models": [\n        {\n            "name": "fact_orders",\n            "description": "One row per completed order. Grain: order_id.",\n            "columns": [\n                {\n                    "name": "order_id",\n                    "description": "Surrogate key for each order.",\n                    "tests": ["unique", "not_null"],\n                },\n                {\n                    "name": "customer_id",\n                    "description": "FK to dim_customers.",\n                    "tests": [{"relationships": {"to": "ref(\'dim_customers\')",\n                                                  "field": "customer_id"}}],\n                },\n                {\n                    "name": "revenue_usd",\n                    "description": "Order revenue in USD, post-refund.",\n                    "tests": [{"dbt_expectations.expect_column_values_to_be_between":\n                                {"min_value": 0, "max_value": 1_000_000,\n                                 "severity": "error"}}],\n                },\n                {\n                    "name": "order_date",\n                    "tests": ["not_null",\n                              {"dbt_expectations.expect_column_values_to_be_of_type":\n                               {"column_type": "date"}}],\n                },\n            ],\n        }\n    ],\n    "sources": [\n        {\n            "name": "raw_postgres",\n            "freshness": {"warn_after": {"count": 12, "period": "hour"},\n                          "error_after": {"count": 24, "period": "hour"}},\n            "tables": [{"name": "orders", "loaded_at_field": "updated_at"}],\n        }\n    ],\n}\n\nimport json\nprint(json.dumps(schema_config, indent=2))\n',
	},
	{
		name: "dbt Materializations & Incremental Models",
		tags: ["Analytics Engineer"],
		difficulty: "Intermediate",
		definition:
			"dbt materializations control how a model is persisted in the warehouse. Incremental models process only new or changed records, dramatically reducing compute cost for large tables.",
		formula:
			"Incremental filter (standard):\n  WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})\n\nUnique key merge (upsert):\n  MERGE INTO target USING source ON target.id = source.id\n  WHEN MATCHED   → UPDATE\n  WHEN NOT MATCHED → INSERT\n\nPartition-based incremental (BigQuery):\n  WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY)",
		description:
			"| Materialization | Behavior | Best For |\n|-----------------|----------|----------|\n| view | Query runs each time | Small, simple models |\n| table | Full rebuild each run | Medium tables, slow sources |\n| incremental | Append/merge new rows | Large event tables |\n| ephemeral | CTE, no storage | Intermediate logic only |\n| snapshot | SCD Type 2 | Slowly changing dimensions |",
		example:
			"events table: 2 billion rows. Full rebuild = 45 minutes. Incremental processing last 3 days = 90 seconds.",
		useCases: [
			"Large event stream processing",
			"Cost optimization in cloud warehouses",
			"Near-real-time data pipelines",
			"SCD tracking (snapshots)",
		],
		watchOut:
			"Incremental models can drift from full refreshes if the filter logic or source data changes. Schedule periodic full refreshes and always test with `dbt run --full-refresh`.",
		code: '# Illustrative dbt incremental model logic in Python\nimport pandas as pd\nimport numpy as np\nfrom datetime import datetime, timedelta\n\nrng = np.random.default_rng(42)\n\ndef simulate_source(n=10_000):\n    return pd.DataFrame({\n        "event_id":   range(n),\n        "user_id":    rng.integers(1, 1_001, n),\n        "event_type": rng.choice(["click","view","purchase"], n),\n        "revenue":    np.where(rng.random(n) < 0.1, rng.exponential(50, n), 0),\n        "updated_at": pd.date_range("2024-01-01", periods=n, freq="1min"),\n    })\n\ndef incremental_load(source: pd.DataFrame, existing: pd.DataFrame,\n                     unique_key: str, watermark_col: str) -> pd.DataFrame:\n    if existing.empty:\n        return source\n    max_watermark = existing[watermark_col].max()\n    new_records   = source[source[watermark_col] > max_watermark]\n    print(f"New records to process: {len(new_records):,}")\n    updated = new_records[new_records[unique_key].isin(existing[unique_key])]\n    inserted = new_records[~new_records[unique_key].isin(existing[unique_key])]\n    result = existing[~existing[unique_key].isin(updated[unique_key])]\n    return pd.concat([result, updated, inserted]).sort_values("updated_at")\n\nsource_data = simulate_source(10_000)\nexisting_table = source_data.iloc[:8_000].copy()\n\nresult = incremental_load(source_data, existing_table, "event_id", "updated_at")\nprint(f"Existing rows: {len(existing_table):,}")\nprint(f"After incremental load: {len(result):,}")\nprint(f"Revenue total check: ${result[\'revenue\'].sum():,.2f}")\n',
	},
	{
		name: "Table Partitioning & Clustering Strategies",
		tags: ["Data Engineer", "Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"Partitioning divides a table into physical segments by column value. Clustering sorts data within partitions to reduce bytes scanned per query.",
		formula:
			"Partition pruning savings:\n  bytes_scanned = total_bytes × (matching_partitions / total_partitions)\n\nBigQuery partition types:\n  - Ingestion time: _PARTITIONTIME\n  - Column: DATE/TIMESTAMP column\n  - Integer range: RANGE BUCKET\n\nSnowflake clustering depth:\n  CD = (total_constant + 0.5 × total_overlapping) / total_partitions\n  Lower depth = better clustering",
		description:
			"**Partition strategy selection:**\n- Partition on the column most commonly used in WHERE filters\n- Date/timestamp is almost always the right partition key for event tables\n- Cardinality too high (user_id) → too many partitions\n- Cardinality too low (country, 5 values) → little benefit\n\n**Clustering** (Snowflake/BigQuery): secondary sort within partition — use for columns commonly in JOIN ON or additional WHERE conditions.",
		example:
			"events table partitioned by event_date, clustered by user_id. Query: `WHERE event_date = '2024-01-15' AND user_id = 12345` → scans 1 partition × small cluster range.",
		useCases: [
			"Cloud warehouse cost optimization",
			"Query performance tuning",
			"Large table design",
			"dbt model configuration",
		],
		watchOut:
			"Partitioning on low-cardinality columns (e.g., boolean) gives minimal benefit. Partitioning on high-cardinality columns creates too many small partitions — worse performance.",
		code: 'import pandas as pd\nimport numpy as np\n\nrng = np.random.default_rng(42)\nn = 1_000_000\nevents = pd.DataFrame({\n    "event_id":   range(n),\n    "event_date": pd.to_datetime(rng.choice(\n        pd.date_range("2024-01-01", "2024-12-31"), n)),\n    "user_id":    rng.integers(1, 100_001, n),\n    "event_type": rng.choice(["click","view","purchase"], n),\n    "revenue":    rng.exponential(50, n),\n})\n\n# Simulate partition pruning benefit\ntarget_date = pd.Timestamp("2024-06-15")\ntotal_partitions = 366\n\nfull_scan_rows = len(events)\npartition_scan = len(events[events["event_date"] == target_date])\npruning_benefit = (1 - partition_scan / full_scan_rows) * 100\n\nprint(f"Total rows        : {full_scan_rows:,}")\nprint(f"Rows in partition : {partition_scan:,}")\nprint(f"Pruning benefit   : {pruning_benefit:.1f}% bytes saved")\n\npartition_stats = (events.groupby("event_date")\n                   .agg(row_count=("event_id","count"),\n                        revenue_sum=("revenue","sum"))\n                   .describe().round(0))\nprint("\\nPartition size distribution:")\nprint(partition_stats)\n\nprint("\nSQL DDL examples:")\nprint(\'\'\'\n        - - BigQuery partitioned + clustered table\n        CREATE TABLE `project.dataset.events`\n        PARTITION BY DATE(event_date)\n        CLUSTER BY user_id, event_type\n        AS SELECT * FROM source;\n\n        -- Snowflake\n        CREATE TABLE events\n        CLUSTER BY(event_date, user_id)\n        AS SELECT * FROM source;\n        \'\'\')\n',
	},
	{
		name: "Change Data Capture (CDC)",
		tags: ["Data Engineer"],
		difficulty: "Advanced",
		definition:
			"CDC is a pattern for tracking row-level changes (inserts, updates, deletes) in source databases and propagating them to downstream systems in near-real-time.",
		formula:
			"Log-based CDC latency:\n  lag = current_time − log_sequence_number_timestamp\n\nDeduplication for out-of-order events:\n  keep row with MAX(lsn) per primary key\n\nMerge pattern:\n  WHEN op='d' → DELETE\n  WHEN op='u' → UPDATE\n  WHEN op='i' → INSERT",
		description:
			"**CDC methods:**\n| Method | Latency | Source Impact | Notes |\n|--------|---------|---------------|-------|\n| Timestamp polling | Minutes | Read load | Misses deletes |\n| Trigger-based | Seconds | Write overhead | Fragile |\n| Log-based (Debezium) | Sub-second | Near-zero | Best practice |\n\n**Common tools:** Debezium (Kafka), AWS DMS, Fivetran, Airbyte, Striim.",
		example:
			"PostgreSQL → Debezium reads WAL → Kafka topic `postgres.public.orders` → Flink job merges into Iceberg table. End-to-end latency: ~3 seconds.",
		useCases: [
			"Real-time data warehouse sync",
			"Event-driven microservices",
			"Audit trail creation",
			"Cache invalidation",
		],
		watchOut:
			"Log-based CDC requires database log retention configuration. If the consumer falls behind and logs rotate, you lose events — set retention ≥ 24 hours.",
		code: 'import pandas as pd\nimport numpy as np\nfrom datetime import datetime\n\n# Simulate CDC event stream (Debezium-style messages)\ncdc_events = pd.DataFrame({\n    "lsn":        [1001, 1002, 1003, 1004, 1005, 1006],\n    "op":         ["i", "i", "u", "i", "d", "u"],\n    "id":         [1, 2, 1, 3, 2, 3],\n    "name":       ["Alice", "Bob", "Alice Updated", "Carol", "Bob", "Carol Updated"],\n    "revenue":    [100.0, 200.0, 150.0, 300.0, None, 320.0],\n    "ts":         pd.date_range("2024-01-01 10:00", periods=6, freq="30s"),\n})\n\nprint("CDC event stream:")\nprint(cdc_events)\n\ndef apply_cdc(events: pd.DataFrame) -> pd.DataFrame:\n    target = {}\n    for _, row in events.sort_values("lsn").iterrows():\n        pk = row["id"]\n        if row["op"] == "d":\n            target.pop(pk, None)\n        else:\n            target[pk] = {"id": pk, "name": row["name"],\n                          "revenue": row["revenue"], "lsn": row["lsn"]}\n    return pd.DataFrame(target.values()).sort_values("id").reset_index(drop=True)\n\nresult = apply_cdc(cdc_events)\nprint("\\nTarget table after applying CDC:")\nprint(result)\n\n# Deduplication for out-of-order events\nooo_events = cdc_events.sample(frac=1, random_state=42)\ndeduped = (ooo_events.sort_values("lsn", ascending=False)\n           .drop_duplicates(subset="id", keep="first")\n           .query("op != \'d\'")\n           .sort_values("id"))\nprint("\\nDeduplicated (latest state per id):")\nprint(deduped[["id","name","revenue","lsn"]])\n',
	},
	{
		name: "Data Lakehouse Architecture",
		tags: ["Data Engineer", "Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"A lakehouse combines the low-cost storage of a data lake with the ACID transactions, schema enforcement, and query performance of a data warehouse using open table formats.",
		formula:
			"Open table formats (Delta Lake / Iceberg / Hudi):\n  Storage = Parquet data files + transaction log\n  ACID via optimistic concurrency control\n\nZ-ordering (data skipping):\n  co-locate related data within files\n  bytes_skipped = files_where_min > filter OR max < filter\n\nVacuum: removes files older than retention_hours",
		description:
			"**Architecture layers:**\n1. **Bronze** (raw): append-only, full history, schema-on-read\n2. **Silver** (cleaned): validated, deduplicated, typed\n3. **Gold** (curated): aggregated, business-ready, modeled\n\n**Key features vs traditional lake:**\n- ACID transactions (no partial writes)\n- Time travel (query as-of any version)\n- Schema evolution with enforcement\n- Unified batch + streaming",
		example:
			"Medallion architecture: raw Kafka events → Bronze Iceberg table → Silver (deduped, typed) → Gold (daily aggregates for BI).",
		useCases: [
			"Unified batch + streaming pipelines",
			"Cost-efficient large-scale analytics",
			"ML feature stores",
			"Regulatory data retention",
		],
		watchOut:
			"Small file problem: streaming writes create many small Parquet files, degrading read performance. Schedule compaction jobs (OPTIMIZE / REWRITE DATA FILES).",
		code: 'import pandas as pd\nimport numpy as np\nfrom datetime import datetime\n\n# Simulate medallion architecture layers\nrng = np.random.default_rng(42)\nn = 10_000\n\n# Bronze: raw ingestion (append-only, duplicates allowed)\nbronze = pd.DataFrame({\n    "raw_id":     range(n),\n    "event_id":   rng.integers(1, 8_001, n),   # intentional duplicates\n    "user_id":    rng.integers(1, 2_001, n),\n    "event_type": rng.choice(["click","view","purchase",None], n, p=[.4,.4,.15,.05]),\n    "amount_raw": rng.choice(["$50.00","100","75.5",None,"invalid"], n,\n                             p=[.3,.3,.2,.1,.1]),\n    "ingested_at": datetime.now(),\n})\nprint(f"Bronze rows : {len(bronze):,}  (with dups + nulls + bad data)")\n\n# Silver: clean + deduplicate + type\ndef clean_amount(x):\n    try: return float(str(x).replace("$",""))\n    except: return np.nan\n\nsilver = (bronze\n    .dropna(subset=["event_type"])\n    .assign(amount=lambda df: df["amount_raw"].apply(clean_amount))\n    .drop_duplicates(subset="event_id", keep="last")\n    .drop(columns=["raw_id","amount_raw","ingested_at"])\n    .assign(processed_at=datetime.now())\n)\nprint(f"Silver rows : {len(silver):,}  (deduped, typed, validated)")\n\n# Gold: business aggregates\ngold = (silver\n    .groupby(["user_id","event_type"])\n    .agg(event_count=("event_id","count"),\n         total_amount=("amount","sum"),\n         avg_amount=("amount","mean"))\n    .reset_index()\n    .assign(updated_at=datetime.now())\n)\nprint(f"Gold rows   : {len(gold):,}  (aggregated, BI-ready)")\nprint(gold.head())\n',
	},
	{
		name: "Differential Privacy & k-Anonymity",
		tags: ["Data Scientist", "Data Engineer"],
		difficulty: "Expert",
		definition:
			"Privacy-preserving techniques that mathematically bound the information that can be inferred about individuals from published data or model outputs.",
		formula:
			"k-Anonymity:\n  every record is indistinguishable from ≥ k−1 others\n  on quasi-identifier columns\n\nDifferential Privacy:\n  P[M(D) ∈ S] ≤ e^ε × P[M(D′) ∈ S]\n  D, D′ differ by one individual\n  ε = privacy budget (lower = more private)\n\nLaplace mechanism: add noise ~ Laplace(0, Δf/ε)\n  Δf = global sensitivity of query f",
		description:
			"**Privacy hierarchy:**\n- k-Anonymity: simple, deterministic, vulnerable to homogeneity attacks\n- l-Diversity: extends k-anonymity with diverse sensitive values\n- t-Closeness: distribution of sensitive values matches population\n- Differential Privacy: gold standard — probabilistic, composable, mathematical guarantees",
		example:
			"Census: add Laplace noise with ε=1.0 to each county count. Individual's presence changes any count by at most 1, noise overwhelms that signal.",
		useCases: [
			"Census data publication",
			"ML model training on sensitive data",
			"Analytics on health/financial data",
			"Federated learning",
		],
		watchOut:
			"ε composition: running multiple queries consumes privacy budget. Total ε = sum of individual ε values — budget exhaustion degrades privacy guarantees.",
		code: 'import numpy as np\nimport pandas as pd\nfrom itertools import combinations\n\nrng = np.random.default_rng(42)\nn = 1_000\n\ndf = pd.DataFrame({\n    "age":     rng.integers(18, 80, n),\n    "zipcode": rng.choice(["94101","94102","94103","94104","94105"], n),\n    "gender":  rng.choice(["M","F","NB"], n),\n    "disease": rng.choice(["None","Diabetes","Hypertension"], n, p=[0.7,0.15,0.15]),\n})\n\ndef generalize_age(age, bucket=10):\n    return f"{(age // bucket) * bucket}-{(age // bucket) * bucket + 9}"\n\ndef k_anonymize(df, quasi_ids, k=3):\n    df_anon = df.copy()\n    df_anon["age_gen"] = df_anon["age"].apply(generalize_age)\n    groups = df_anon.groupby(quasi_ids + ["age_gen"]).size()\n    suppressed = (groups < k).sum()\n    min_group  = groups.min()\n    print(f"Min group size: {min_group}  |  Groups < k={k}: {suppressed}")\n    return df_anon\n\nanon = k_anonymize(df, ["gender","zipcode"], k=3)\n\ndef laplace_mechanism(true_value, sensitivity, epsilon):\n    noise = rng.laplace(0, sensitivity / epsilon)\n    return true_value + noise\n\ntrue_count = (df["disease"] == "Diabetes").sum()\nfor eps in [0.1, 0.5, 1.0, 5.0]:\n    noisy = laplace_mechanism(true_count, sensitivity=1, epsilon=eps)\n    print(f"ε={eps:.1f}  true={true_count}  noisy={noisy:.0f}  error={abs(noisy-true_count):.1f}")\n',
	},
	{
		name: "Fairness & Bias in ML Models",
		tags: ["Data Scientist"],
		difficulty: "Expert",
		definition:
			"Algorithmic fairness measures whether model predictions systematically disadvantage protected groups (race, gender, age). Multiple fairness definitions exist and often conflict.",
		formula:
			"Demographic Parity:\n  P(Ŷ=1|A=0) = P(Ŷ=1|A=1)\n\nEqualized Odds:\n  TPR_A=0 = TPR_A=1  AND  FPR_A=0 = FPR_A=1\n\nPredictive Parity:\n  P(Y=1|Ŷ=1,A=0) = P(Y=1|Ŷ=1,A=1)\n\nDisparate Impact Ratio:\n  DIR = P(Ŷ=1|A=minority) / P(Ŷ=1|A=majority)\n  < 0.8 → adverse impact (US EEOC threshold)",
		description:
			"**Impossibility theorem (Chouldechova 2017):** Demographic parity, equalized odds, and predictive parity cannot all be satisfied simultaneously when base rates differ across groups.\n\n**Bias sources:** historical bias in labels, representation bias in training data, measurement bias, aggregation bias.",
		example:
			"Hiring model: approval rate 45% for Group A, 28% for Group B → DIR=0.62 → below 0.8 threshold → adverse impact. Investigate feature importance for protected proxies.",
		useCases: [
			"Hiring and lending models",
			"Criminal justice risk scoring",
			"Ad targeting compliance",
			"Healthcare treatment recommendations",
		],
		watchOut:
			"Removing protected attributes does NOT prevent discrimination. Proxy variables (zip code, name, browsing history) can reconstruct protected characteristics.",
		code: 'import numpy as np\nimport pandas as pd\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import confusion_matrix\n\nrng = np.random.default_rng(42)\nn = 5_000\ngroup      = rng.binomial(1, 0.4, n)\nability    = rng.normal(0.5 * group, 1, n)  # historical bias: group A has lower mean\napproved   = (ability + 0.3 * group + rng.normal(0, 0.5, n) > 0.5).astype(int)\n\nX = pd.DataFrame({"ability": ability, "group": group})\nX_tr, X_te, y_tr, y_te = train_test_split(X, approved, test_size=0.3, random_state=42)\n\nclf = LogisticRegression().fit(X_tr, y_tr)\ny_pred = clf.predict(X_te)\ngroups = X_te["group"]\n\ndef fairness_report(y_true, y_pred, group):\n    results = {}\n    for g in [0, 1]:\n        mask = group == g\n        yt, yp = y_true[mask], y_pred[mask]\n        tn, fp, fn, tp = confusion_matrix(yt, yp).ravel()\n        results[f"group_{g}"] = {\n            "approval_rate": yp.mean().round(3),\n            "TPR (recall)":  (tp / (tp + fn)).round(3),\n            "FPR":           (fp / (fp + tn)).round(3),\n            "precision":     (tp / (tp + fp)).round(3),\n        }\n    df = pd.DataFrame(results)\n    df["disparity_ratio"] = (df["group_0"] / df["group_1"]).round(3)\n    return df\n\nreport = fairness_report(y_te.values, y_pred, groups.values)\nprint(report)\ndir_val = report.loc["approval_rate", "disparity_ratio"]\nprint(f"\\nDisparate Impact Ratio: {dir_val:.3f}  {\'⚠ ADVERSE IMPACT\' if dir_val < 0.8 else \'✓ OK\'}")\n',
	},
	{
		name: "Query Cost Optimization in Cloud Warehouses",
		tags: ["Analytics Engineer", "Data Engineer"],
		difficulty: "Advanced",
		definition:
			"Techniques for minimizing compute and storage costs in cloud-billed analytical databases like BigQuery, Snowflake, and Redshift through query and schema design.",
		formula:
			"BigQuery cost:\n  bytes_billed = bytes_scanned (rounded up to 10MB)\n  cost = bytes_billed × $6.25 / TB\n\nSnowflake cost:\n  credits = warehouse_seconds / 3600 × credits_per_hour\n  cost = credits × credit_price\n\nCost reduction levers:\n  1. Partition pruning → fewer bytes scanned\n  2. Column pruning → SELECT named cols vs SELECT *\n  3. Materialization → avoid repeated heavy transforms\n  4. Result caching → identical queries = $0",
		description:
			"**Quick wins ranked by impact:**\n1. Add date partition filter to all queries on event tables\n2. Replace `SELECT *` with named columns\n3. Use `APPROX_COUNT_DISTINCT` instead of `COUNT(DISTINCT)` for dashboards\n4. Materialize expensive CTEs as tables if queried frequently\n5. Use clustering keys matching your join and filter columns\n6. Cache BI tool queries — avoid per-user re-computation",
		example:
			"Daily dashboard query on 3TB events table: `SELECT *` with no date filter = $18.75/run × 50 users = $937/day. Add partition + columns = $0.06/run.",
		useCases: [
			"Cloud cost reduction",
			"dbt model design",
			"BI tool backend optimization",
			"Data platform budgeting",
		],
		watchOut:
			"Premature optimization wastes engineering time. Profile query costs first — 80% of cost often comes from 20% of queries. Fix those first.",
		code: 'import pandas as pd\n\ncost_patterns = pd.DataFrame({\n    "pattern": [\n        "SELECT * — no filter",\n        "SELECT * — with date filter",\n        "SELECT 3 cols — with date filter",\n        "SELECT * — wrong date function",\n        "APPROX_COUNT_DISTINCT",\n        "COUNT(DISTINCT id)",\n        "Uncached repeated query",\n        "Cached repeated query (BQ)",\n    ],\n    "example_sql": [\n        "SELECT * FROM events",\n        "SELECT * FROM events WHERE date = \'2024-01-01\'",\n        "SELECT id, type, revenue FROM events WHERE date = \'2024-01-01\'",\n        "SELECT * FROM events WHERE DATE(created_at) = \'2024-01-01\'",\n        "SELECT APPROX_COUNT_DISTINCT(user_id) FROM events",\n        "SELECT COUNT(DISTINCT user_id) FROM events",\n        "SELECT SUM(revenue) FROM fact_orders -- run 50x/day",\n        "SELECT SUM(revenue) FROM fact_orders -- result reused",\n    ],\n    "tb_scanned": [3.0, 0.008, 0.001, 3.0, 3.0, 3.0, 0.05, 0.0],\n    "bq_cost_usd": [18.75, 0.05, 0.006, 18.75, 18.75, 18.75, 0.31, 0.0],\n    "note": [\n        "Full table scan, all columns",\n        "Partition pruning — 99.7% savings",\n        "Partition + column pruning — 99.97% savings",\n        "Function breaks partition pruning!",\n        "~2% error, 10x faster",\n        "Exact but expensive",\n        "50 × $6.25/TB × 50MB",\n        "Cached — free in BigQuery",\n    ]\n})\ncost_patterns["daily_cost_50x"] = cost_patterns["bq_cost_usd"] * 50\nprint(cost_patterns[["pattern","tb_scanned","bq_cost_usd","daily_cost_50x"]].to_string(index=False))\n',
	},
	{
		name: "Semantic Layer & Metrics Layer",
		tags: ["Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"A semantic layer is a centralized, governed definition of business metrics and dimensions that sits between the warehouse and BI tools, ensuring consistent metric definitions across all reports.",
		formula:
			"Metric definition components:\n  name:        unique identifier\n  type:        simple | ratio | cumulative | derived\n  measure:     SUM/COUNT/AVG of a column\n  filters:     WHERE conditions on the metric\n  dimensions:  columns to slice/group by\n  time_grains: day | week | month | quarter\n\nRatio metric:\n  value = numerator_measure / denominator_measure",
		description:
			"**Problem it solves:** Without a semantic layer, every analyst hard-codes metric logic in SQL. Revenue is defined differently in 5 dashboards. The semantic layer is the single source of truth.\n\n**Tools:** dbt Semantic Layer (MetricFlow), LookML (Looker), Cube.dev, AtScale.",
		example:
			"Conversion rate defined once: `conversions / sessions` where status='complete'. Every dashboard queries this definition — impossible to have inconsistent numbers.",
		useCases: [
			"Consistent KPI definitions across BI tools",
			"Self-service analytics governance",
			"Metric versioning and deprecation",
			"Cross-tool metric reuse",
		],
		watchOut:
			"A semantic layer adds abstraction overhead. Don't build one for 10 metrics — it pays off at 50+ metrics with multiple teams and BI tools.",
		code: '# Illustrative metric definitions (dbt Semantic Layer / MetricFlow style)\n# In practice: metrics.yml in dbt project\n\nmetrics_config = {\n    "metrics": [\n        {\n            "name": "monthly_revenue",\n            "label": "Monthly Revenue",\n            "type": "simple",\n            "type_params": {"measure": {"name": "revenue_usd", "agg": "sum"}},\n            "filter": "{{ Dimension(\'order__status\') }} = \'completed\'",\n            "time_spine": {"node_relation": {"alias": "orders"},\n                          "time_column": "order_date"},\n        },\n        {\n            "name": "conversion_rate",\n            "label": "Conversion Rate",\n            "type": "ratio",\n            "type_params": {\n                "numerator":   {"name": "purchases", "agg": "count"},\n                "denominator": {"name": "sessions",  "agg": "count"},\n            },\n        },\n        {\n            "name": "nrr",\n            "label": "Net Revenue Retention",\n            "type": "derived",\n            "type_params": {\n                "expr": "ending_mrr / beginning_mrr",\n                "metrics": [\n                    {"name": "ending_mrr"},\n                    {"name": "beginning_mrr"},\n                ],\n            },\n        },\n    ]\n}\n\nimport json\nprint(json.dumps(metrics_config, indent=2))\n\n# Python equivalent — metric registry pattern\nclass MetricRegistry:\n    def __init__(self): self._metrics = {}\n    def register(self, name, fn): self._metrics[name] = fn\n    def compute(self, name, df): return self._metrics[name](df)\n\nimport pandas as pd, numpy as np\nrng = np.random.default_rng(42)\ndf = pd.DataFrame({"revenue": rng.exponential(100, 1000),\n                   "status": rng.choice(["completed","pending"], 1000, p=[.8,.2]),\n                   "sessions": np.ones(1000)})\n\nregistry = MetricRegistry()\nregistry.register("monthly_revenue",\n    lambda df: df[df["status"]=="completed"]["revenue"].sum())\nregistry.register("conversion_rate",\n    lambda df: (df["status"]=="completed").sum() / len(df))\n\nprint(f"\nmonthly_revenue : ${registry.compute(\'monthly_revenue\', df):,.2f}")\nprint(f"conversion_rate : {registry.compute(\'conversion_rate\', df)*100:.1f}%")\n',
	},
	{
		name: "Kafka Architecture & Message Queue Fundamentals",
		tags: ["Data Engineer"],
		difficulty: "Advanced",
		definition:
			"Apache Kafka is a distributed event streaming platform using a log-based, partitioned, replicated architecture for high-throughput, fault-tolerant data transport.",
		formula:
			"Throughput:\n  max_throughput = partitions × consumer_threads × msg/s_per_thread\n\nRetention:\n  bytes_retained = partitions × retention_hours × write_rate_bytes/s\n\nConsumer lag:\n  lag = latest_offset − committed_offset\n  lag_seconds ≈ lag / (throughput_msgs/s)",
		description:
			"**Core concepts:**\n- **Topic**: named category of messages\n- **Partition**: ordered, immutable log — unit of parallelism\n- **Offset**: position of message within partition\n- **Producer**: writes to topic (with partitioner)\n- **Consumer group**: each partition consumed by one member\n- **Broker**: server storing partitions\n- **Replication factor**: number of replicas for durability\n\n**Delivery semantics:**\n- At-most-once: may lose messages\n- At-least-once: may duplicate (default)\n- Exactly-once: requires transactions + idempotent consumers",
		example:
			"Orders topic: 12 partitions, 3 brokers, replication=3. 12 consumer instances process in parallel. Max consumer lag alert: >10,000 messages.",
		useCases: [
			"Real-time event streaming",
			"Microservice decoupling",
			"CDC pipeline transport",
			"Activity tracking at scale",
		],
		watchOut:
			"Consumer lag is the key health metric. Growing lag means consumers can't keep up with producers — scale consumer group or optimize processing logic.",
		code: 'import pandas as pd\nimport numpy as np\nfrom dataclasses import dataclass, field\nfrom collections import defaultdict, deque\nfrom typing import Dict, List\n\n@dataclass\nclass KafkaMessage:\n    key: str\n    value: dict\n    offset: int\n    partition: int\n\nclass SimulatedKafkaTopic:\n    def __init__(self, name: str, n_partitions: int = 3):\n        self.name = name\n        self.partitions: Dict[int, deque] = {i: deque() for i in range(n_partitions)}\n        self.offsets: Dict[int, int] = {i: 0 for i in range(n_partitions)}\n        self.n_partitions = n_partitions\n\n    def produce(self, key: str, value: dict):\n        partition = hash(key) % self.n_partitions\n        offset = self.offsets[partition]\n        msg = KafkaMessage(key=key, value=value, offset=offset, partition=partition)\n        self.partitions[partition].append(msg)\n        self.offsets[partition] += 1\n        return partition, offset\n\n    def consume(self, partition: int, from_offset: int = 0) -> List[KafkaMessage]:\n        return [m for m in self.partitions[partition] if m.offset >= from_offset]\n\ntopic = SimulatedKafkaTopic("orders", n_partitions=3)\n\nrng = np.random.default_rng(42)\nfor i in range(20):\n    user_id = str(rng.integers(1, 6))\n    topic.produce(key=user_id, value={"order_id": i, "user_id": user_id,\n                                      "amount": rng.exponential(100).round(2)})\n\nprint("Partition distribution:")\nfor p in range(3):\n    msgs = topic.consume(p)\n    print(f"  Partition {p}: {len(msgs)} messages  "\n          f"keys={set(m.key for m in msgs)}")\n\ncommitted_offsets = {0: 2, 1: 1, 2: 3}\nlags = {p: topic.offsets[p] - committed_offsets[p] for p in range(3)}\ntotal_lag = sum(lags.values())\nprint(f"\\nConsumer group lag per partition: {lags}")\nprint(f"Total lag: {total_lag} messages")\n',
	},
	{
		name: "Bootstrap Resampling & Confidence Intervals",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Bootstrap resampling estimates the sampling distribution of a statistic by repeatedly sampling observations with replacement from the observed dataset.",
		formula:
			"Bootstrap sample: draw n observations with replacement\nBootstrap SE = std(statistic across bootstrap samples)\n95% CI = [2.5th percentile, 97.5th percentile]",
		description:
			"Bootstrap methods are useful when the sampling distribution is unknown or the statistic is complicated. Each resample has the same size as the original data and may contain repeated observations.",
		example:
			"A sample median of $42 has a bootstrap 95% CI of [$38, $47]. The interval communicates uncertainty without assuming the data are normally distributed.",
		useCases: [
			"Confidence intervals for medians and percentiles",
			"Model metric uncertainty",
			"Small-sample inference",
			"A/B test lift estimation",
		],
		watchOut:
			"Bootstrap samples cannot repair a biased or unrepresentative original sample. Resampling repeats the information you have; it does not create new information.",
		code: 'import numpy as np\n\nrng = np.random.default_rng(42)\ndata = rng.exponential(50, size=200)\n\nboot_medians = np.array([\n    np.median(rng.choice(data, size=len(data), replace=True))\n    for _ in range(10_000)\n])\n\nci = np.percentile(boot_medians, [2.5, 97.5])\nprint(f"Median: {np.median(data):.2f}")\nprint(f"Bootstrap 95% CI: [{ci[0]:.2f}, {ci[1]:.2f}]")\nprint(f"Bootstrap SE: {boot_medians.std(ddof=1):.2f}")',
	},
	{
		name: "ANOVA & Post-hoc Comparisons",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Analysis of variance (ANOVA) tests whether the means of three or more groups differ by comparing between-group variation with within-group variation.",
		formula:
			"F = Mean Square Between / Mean Square Within\nH₀: all group means are equal\nIf p < α: at least one group mean differs",
		description:
			"A significant omnibus ANOVA does not identify which groups differ. Use a planned contrast or a multiple-comparison correction such as Tukey's HSD for pairwise follow-up tests.",
		example:
			"Three landing-page variants have conversion means of 4.0%, 4.6%, and 5.1%. ANOVA p = 0.02 indicates a difference exists, but post-hoc tests are needed to locate it.",
		useCases: [
			"Comparing three or more experiments",
			"Supplier or region comparisons",
			"Manufacturing quality analysis",
			"Evaluating multiple model groups",
		],
		watchOut:
			"ANOVA assumes independent observations, approximately normal residuals, and comparable variances. Welch's ANOVA is safer when variances differ.",
		code: 'import numpy as np\nfrom scipy import stats\n\nrng = np.random.default_rng(42)\ngroups = [\n    rng.normal(100, 10, 30),\n    rng.normal(105, 10, 30),\n    rng.normal(112, 10, 30),\n]\n\nf_stat, p_value = stats.f_oneway(*groups)\nprint(f"ANOVA F={f_stat:.3f}, p={p_value:.4f}")\n\nif p_value < 0.05:\n    print("At least one group mean differs")',
	},
	{
		name: "Nonparametric Tests",
		tags: ["Data Analyst", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Nonparametric tests compare distributions or ranks without requiring a normal distribution for the raw measurements.",
		formula:
			"Mann-Whitney U: two independent groups\nWilcoxon signed-rank: two paired groups\nKruskal-Wallis H: three or more independent groups\nSpearman rho: ranked association",
		description:
			"Use rank-based tests when data are strongly skewed, ordinal, or dominated by outliers. They generally test distributional or rank differences rather than ordinary mean differences.",
		example:
			"Compare customer resolution times for two support teams with Mann-Whitney U when a few extreme tickets make a t-test questionable.",
		useCases: [
			"Skewed revenue or latency data",
			"Ordinal survey responses",
			"Small samples",
			"Paired before-and-after measurements",
		],
		watchOut:
			"A nonparametric test is not assumption-free. Check independence, measurement pairing, ties, and whether the question concerns medians or whole distributions.",
		code: 'from scipy import stats\n\ncontrol = [12, 15, 18, 20, 95]\nvariant = [10, 13, 14, 17, 21]\n\nu_stat, p_value = stats.mannwhitneyu(\n    control, variant, alternative="two-sided"\n)\nprint(f"U={u_stat:.1f}, p={p_value:.4f}")\n\nbefore = [80, 75, 90, 88, 92]\nafter = [84, 79, 91, 95, 94]\nprint(stats.wilcoxon(before, after))',
	},
	{
		name: "Effect Sizes & Practical Significance",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Effect size quantifies the magnitude of a difference or relationship, helping distinguish business importance from statistical significance.",
		formula:
			"Cohen's d = (mean₁ − mean₂) / pooled SD\nRelative lift = (variant − control) / control\nOdds ratio = odds₁ / odds₂\nCommon d guide: 0.2 small, 0.5 medium, 0.8 large",
		description:
			"P-values are affected by sample size. A tiny change can be statistically significant with enough observations, while a meaningful change can be uncertain in a small sample. Report effect size with an interval whenever possible.",
		example:
			"A checkout change improves conversion by 0.2 percentage points with p < 0.01. The result is statistically reliable, but its implementation value depends on traffic, margin, and expected revenue.",
		useCases: [
			"A/B test interpretation",
			"Model comparison",
			"Power and sample-size planning",
			"Communicating impact to stakeholders",
		],
		watchOut:
			"There is no universal threshold for a practically important effect. Define the minimum meaningful effect before analyzing results, using business or domain context.",
		code: 'import numpy as np\n\ncontrol = np.array([10, 12, 11, 9, 13])\nvariant = np.array([12, 14, 13, 11, 15])\npooled_sd = np.sqrt((control.var(ddof=1) + variant.var(ddof=1)) / 2)\ncohens_d = (variant.mean() - control.mean()) / pooled_sd\nrelative_lift = (variant.mean() - control.mean()) / control.mean()\n\nprint(f"Cohen\\\'s d: {cohens_d:.3f}")\nprint(f"Relative lift: {relative_lift:.1%}")',
	},
	{
		name: "Missing Data Mechanisms",
		tags: ["Data Analyst", "Analytics Engineer", "Data Scientist"],
		difficulty: "Intermediate",
		definition:
			"Missing-data mechanisms describe why values are absent: completely at random (MCAR), conditionally at random (MAR), or dependent on the unobserved value itself (MNAR).",
		formula:
			"MCAR: P(R | Y, X) = P(R)\nMAR:  P(R | Y, X) = P(R | X)\nMNAR: P(R | Y, X) depends on unobserved Y",
		description:
			"The mechanism determines whether dropping rows or standard imputation is defensible. Compare missingness rates across observed groups and add a missingness indicator when absence may carry signal.",
		example:
			"Income is missing more often for high earners who decline to answer. Treating those nulls as MCAR can bias the estimated average income downward.",
		useCases: [
			"Survey and form analysis",
			"Healthcare datasets",
			"Feature engineering",
			"Bias assessment before modeling",
		],
		watchOut:
			"MCAR, MAR, and MNAR cannot usually be proven from the observed data alone. Document assumptions and run sensitivity analyses under plausible alternatives.",
		code: 'import pandas as pd\n\ndf = pd.DataFrame({\n    "plan": ["free", "pro", "free", "pro", "free"],\n    "income": [None, 120_000, 35_000, None, 42_000],\n})\n\ndf["income_missing"] = df["income"].isna().astype(int)\nprint(df.groupby("plan")["income_missing"].mean())\nprint(df["income"].fillna(df["income"].median()))',
	},
	{
		name: "Data Leakage in Machine Learning",
		tags: ["Data Scientist", "Analytics Engineer"],
		difficulty: "Advanced",
		definition:
			"Data leakage occurs when information unavailable at prediction time influences model training or evaluation, producing performance estimates that are too optimistic.",
		formula:
			"Valid pipeline: split → fit preprocessing on train → transform train/test → fit model\nLeakage: fit preprocessing or features on train + test before splitting",
		description:
			"Common leakage sources include target-derived features, random splits for temporal data, duplicated entities across folds, imputation before splitting, and selecting features using the full dataset.",
		example:
			"A churn model uses a cancellation timestamp to predict churn. Its validation AUC is excellent because the feature reveals the label, but it does not exist when the prediction is made.",
		useCases: [
			"Production ML pipelines",
			"Cross-validation design",
			"Time-series forecasting",
			"Fraud and churn modeling",
		],
		watchOut:
			"Ask what would be known at the exact prediction timestamp. Build features inside each training fold and validate with a realistic future or entity-based split.",
		code: 'from sklearn.pipeline import Pipeline\nfrom sklearn.impute import SimpleImputer\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.linear_model import LogisticRegression\n\npipe = Pipeline([\n    ("imputer", SimpleImputer(strategy="median")),\n    ("scaler", StandardScaler()),\n    ("model", LogisticRegression(max_iter=1_000)),\n])\n\n# Fit each transformation only on the training fold\npipe.fit(X_train, y_train)\nscore = pipe.score(X_test, y_test)\nprint(f"Leakage-safe test score: {score:.3f}")',
	},
];

const ROLE_OPTIONS = [
	"Data Analyst",
	"Analytics Engineer",
	"Data Engineer",
	"Data Scientist",
];
const DIFFICULTY_OPTIONS = [
	"Foundational",
	"Intermediate",
	"Advanced",
	"Expert",
];

export function MathStats({ item }: CustomizedComponentProps) {
	const [role, setRole] = useState("All roles");
	const [difficulty, setDifficulty] = useState("All levels");
	const [query, setQuery] = useState("");
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return TOPICS.filter((topic) => {
			const matchesRole = role === "All roles" || topic.tags.includes(role);
			const matchesDifficulty =
				difficulty === "All levels" || topic.difficulty === difficulty;
			const searchable = [
				topic.name,
				topic.tags.join(" "),
				topic.difficulty,
				topic.definition,
				topic.formula,
				topic.description,
				topic.example,
				topic.useCases.join(" "),
				topic.watchOut,
				topic.code,
			]
				.join(" ")
				.toLowerCase();
			return matchesRole && matchesDifficulty && (!q || searchable.includes(q));
		});
	}, [difficulty, query, role]);

	return (
		<div className='space-y-6'>
			<div className='border-b border-border pb-5'>
				<p className='max-w-3xl text-[15px] leading-relaxed text-muted-foreground'>
					A complete reference for the statistics, applied math, analytics
					engineering, and machine learning concepts in the original cheat
					sheet.
				</p>
			</div>
			<div className='grid gap-3 sm:grid-cols-3'>
				<Summary
					label='Showing'
					value={`${filtered.length} of ${TOPICS.length} topics`}
				/>
				<Summary
					label='Roles'
					value={`${new Set(filtered.flatMap((topic) => topic.tags.filter((tag) => ROLE_OPTIONS.includes(tag)))).size} represented`}
				/>
				<Summary
					label='Levels'
					value={`${new Set(filtered.map((topic) => topic.difficulty)).size} represented`}
				/>
			</div>
			<div className='grid gap-3 border-y border-border py-4 sm:grid-cols-[1fr_auto_auto]'>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder='Search topics, formulas, code...'
					className='h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring'
				/>
				<select
					value={role}
					onChange={(event) => setRole(event.target.value)}
					className='h-9 rounded-md border border-input bg-background px-3 text-sm'>
					<option>All roles</option>
					{ROLE_OPTIONS.map((option) => (
						<option key={option}>{option}</option>
					))}
				</select>
				<select
					value={difficulty}
					onChange={(event) => setDifficulty(event.target.value)}
					className='h-9 rounded-md border border-input bg-background px-3 text-sm'>
					<option>All levels</option>
					{DIFFICULTY_OPTIONS.map((option) => (
						<option key={option}>{option}</option>
					))}
				</select>
			</div>
			{filtered.length === 0 ? (
				<p className='border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
					No topics match the current filters.
				</p>
			) : (
				<div className='grid items-start gap-3 md:grid-cols-2'>
					{filtered.map((topic, index) => (
						<TopicRow key={topic.name} index={index + 1} topic={topic} />
					))}
				</div>
			)}
			<div className='border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground'>
				{item.covers}
			</div>
		</div>
	);
}

function Summary({ label, value }: { label: string; value: string }) {
	return (
		<div className='rounded-lg border border-border bg-card px-4 py-3'>
			<div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
				{label}
			</div>
			<div className='mt-1 text-sm font-medium text-foreground'>{value}</div>
		</div>
	);
}
function TopicRow({ index, topic }: { index: number; topic: Topic }) {
	return (
		<details className='group rounded-lg border border-border bg-card open:shadow-sm'>
			<summary className='flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden'>
				<span className='font-mono text-xs text-foreground-faint'>
					{String(index).padStart(2, "0")}
				</span>
				<span className='flex-1 text-sm font-semibold text-foreground'>
					{topic.name}
				</span>
				<span className='text-xs text-foreground-faint transition-transform group-open:rotate-180'>
					v
				</span>
			</summary>
			<div className='border-t border-border px-4 pb-5 pt-4'>
				<div className='mb-5 flex flex-wrap gap-1.5'>
					{topic.tags.map((tag) => (
						<span
							key={tag}
							className='rounded-full border border-primary/20 bg-accent px-2.5 py-1 text-[11px] font-medium text-primary'>
							{tag}
						</span>
					))}
					<span className='rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground'>
						{topic.difficulty}
					</span>
				</div>
				<div className='grid gap-5 md:grid-cols-2'>
					<InfoBlock title='Definition' text={topic.definition} />
					{topic.formula && <CodeBlock title='Formula' code={topic.formula} />}
					{topic.description && (
						<InfoBlock title='How it works' text={topic.description} />
					)}
					<InfoBlock title='Example' text={topic.example} />
					<div>
						<Label>Use cases</Label>
						<ul className='space-y-1.5 text-sm leading-relaxed text-muted-foreground'>
							{topic.useCases.map((useCase) => (
								<li key={useCase}>
									<MarkdownText text={useCase} />
								</li>
							))}
						</ul>
					</div>
					<InfoBlock title='Watch out' text={topic.watchOut} />
					{topic.code && <CodeBlock title='Python code' code={topic.code} />}
				</div>
			</div>
		</details>
	);
}
function InfoBlock({ title, text }: { title: string; text: string }) {
	return (
		<div>
			<Label>{title}</Label>
			<MarkdownText text={text} />
		</div>
	);
}

function MarkdownText({ text }: { text: string }) {
	return (
		<div className='text-sm leading-relaxed text-muted-foreground [&>p:not(:last-child)]:mb-3 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_li]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_p]:whitespace-pre-wrap [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border-b [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5'>
			<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
				{text}
			</ReactMarkdown>
		</div>
	);
}
function CodeBlock({ title, code }: { title: string; code: string }) {
	return (
		<div className='min-w-0'>
			<Label>{title}</Label>
			<pre className='max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-foreground'>
				<code>{code}</code>
			</pre>
		</div>
	);
}
function Label({ children }: { children: React.ReactNode }) {
	return (
		<div className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
			{children}
		</div>
	);
}
