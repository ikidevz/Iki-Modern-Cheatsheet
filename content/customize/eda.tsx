import { MarkdownContent } from "@/components/markdown-content";
import type { CustomizedComponentProps } from ".";

type Section = {
	step: string;
	title: string;
	intro: string;
	left: [string, ...string[]];
	right: [string, ...string[]];
	code?: string;
};

const SECTIONS: Section[] = [
	{
		step: "Step 1",
		title: "Data Overview",
		intro:
			"Understand the shape and structure of the dataset before making assumptions about it.",
		left: [
			"Key operations",
			"df.shape — rows × columns",
			"df.dtypes — data types",
			"df.head() / df.tail() — preview",
			"df.info() — column summary",
			"df.columns.tolist() — column names",
		],
		right: [
			"Common types",
			"int64 — age and counts",
			"float64 — prices and scores",
			"object — names and categories",
			"bool — flags",
			"datetime64 — timestamps",
		],
		code: `print(df.shape)\nprint(df.dtypes)\nprint(df.head())\ndf.info()`,
	},
	{
		step: "Step 2",
		title: "Missing Values Analysis",
		intro:
			"Quantify null counts and percentages. Understand whether missingness is MCAR, MAR, or MNAR before choosing a treatment.",
		left: [
			"Measure missingness",
			"df.isnull().sum() — null count",
			"df.isnull().mean() * 100 — percentage",
			"df.notnull().sum() — available count",
			"Visualize with a bar chart or heatmap",
		],
		right: [
			"Handling strategies",
			"Mean / median fill — numeric, low missingness",
			"Mode fill — categorical columns",
			"Forward / back fill — time series",
			"Indicator column — absence may carry signal",
			"Drop rows / columns — only with a reason",
		],
		code: `missing = df.isna().sum().rename("missing").to_frame()\nmissing["missing_pct"] = missing["missing"] / len(df) * 100\nmissing.sort_values("missing_pct", ascending=False)`,
	},
	{
		step: "Step 3",
		title: "Descriptive Statistics",
		intro:
			"Use central tendency, spread, and shape to get a numeric snapshot before visual analysis.",
		left: [
			"Central tendency",
			"Mean — sensitive to outliers",
			"Median — robust to outliers",
			"Mode — useful for categories",
		],
		right: [
			"Spread and shape",
			"Standard deviation and variance",
			"Range and interquartile range",
			"Skewness and kurtosis",
			"describe(include='object') for categories",
		],
		code: `df.describe().round(3)\ndf.describe(include="object")`,
	},
	{
		step: "Step 4",
		title: "Univariate Analysis",
		intro:
			"Examine one variable at a time. Histograms reveal shape; box plots expose spread, quartiles, and possible outliers.",
		left: [
			"Numeric features",
			"Histogram — frequency distribution",
			"KDE — smooth density estimate",
			"Box plot — IQR, median, whiskers",
			"Violin plot — KDE plus box summary",
		],
		right: [
			"Categorical features",
			"Count / bar plot — frequency",
			"value_counts() — quick table",
			"value_counts(normalize=True) — proportions",
			"Use pie charts sparingly",
		],
	},
	{
		step: "Step 5",
		title: "Bivariate Analysis",
		intro:
			"Study relationships between two variables to uncover associations, trends, outliers, and class separability.",
		left: [
			"Numeric vs numeric",
			"Scatter plot — direction and strength",
			"Line plot — ordered trends",
			"Regression line — visual linear fit",
			"df.corr() — numeric correlation",
		],
		right: [
			"Groups and categories",
			"Grouped box / violin plots",
			"Bar chart of means per group",
			"Strip / swarm plot",
			"pd.crosstab(A, B) for category pairs",
		],
		code: `import plotly.express as px\nfig = px.scatter(df, x="feature_a", y="feature_b", color="target", opacity=0.6)\nfig.show()`,
	},
	{
		step: "Step 6",
		title: "Correlation Analysis",
		intro:
			"Correlation shows the strength and direction of linear relationships. It does not establish causation.",
		left: [
			"Reading the heatmap",
			"+1 — perfect positive correlation",
			"0 — no linear relationship",
			"−1 — perfect negative correlation",
			"|r| > 0.8 often signals redundancy",
		],
		right: [
			"Correlation methods",
			"Pearson — continuous, linear",
			"Spearman — ordinal or monotonic",
			"Kendall — small samples or ties",
			"Point-biserial — binary vs continuous",
		],
		code: `corr = df.select_dtypes("number").corr()\nfig = px.imshow(corr, zmin=-1, zmax=1, text_auto=True, color_continuous_scale="RdBu_r")\nfig.show()`,
	},
	{
		step: "Step 7",
		title: "Outlier Detection",
		intro:
			"An outlier may be an entry error, a genuine rare event, or the target phenomenon. Its cause determines the treatment.",
		left: [
			"Detection methods",
			"IQR rule — outside Q1 − 1.5×IQR or Q3 + 1.5×IQR",
			"Z-score — often flag |z| > 3",
			"Box and scatter plots",
			"Isolation Forest for high dimensions",
		],
		right: [
			"Treatment choices",
			"Remove — confirmed error",
			"Cap / floor — retain but limit extremes",
			"Log / square-root transform",
			"Keep — genuine rare events",
		],
		code: `q1, q3 = df["col"].quantile([.25, .75])\niqr = q3 - q1\nlower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr\noutliers = df[(df["col"] < lower) | (df["col"] > upper)]`,
	},
	{
		step: "Step 8",
		title: "Feature Distribution",
		intro:
			"Distribution shape guides transformations and model choices. Many algorithms are sensitive to scale, skew, and extreme tails.",
		left: [
			"Skewness types",
			"Symmetric — mean close to median",
			"Positive skew — long right tail",
			"Negative skew — long left tail",
			"|skew| > 1 is often highly skewed",
		],
		right: [
			"Transformations",
			"Positive skew — log1p or square root",
			"Negative skew — reflect then log",
			"Wide spread — standardize or robust-scale",
			"Box-Cox or Yeo-Johnson",
		],
		code: `numeric = df.select_dtypes("number")\nskewed = numeric.skew().abs().sort_values(ascending=False)\nprint(skewed[skewed > 1])`,
	},
	{
		step: "Step 9",
		title: "Insights and Observations",
		intro:
			"Synthesize findings into decisions for feature engineering, model selection, and data quality.",
		left: [
			"Record",
			"Patterns — recurring structures and segments",
			"Trends — directional changes over time",
			"Anomalies — unexpected values and issues",
		],
		right: [
			"Validate",
			"Linearity and independence",
			"Normality where a method assumes it",
			"Class balance and target leakage",
			"Assumptions affecting model choice",
		],
	},
];

function List({ title, items }: { title: string; items: string[] }) {
	return (
		<div>
			<div className='text-xs font-semibold text-muted-foreground mb-2'>
				{title}
			</div>
			<ul className='space-y-1.5 text-sm leading-relaxed'>
				{items.slice(1).map((entry) => (
					<li key={entry} className='flex gap-2'>
						<span className='text-foreground-faint'>•</span>
						{entry}
					</li>
				))}
			</ul>
		</div>
	);
}

function SectionCard({ section }: { section: Section }) {
	return (
		<section className='border border-border rounded-lg p-5 bg-card/40'>
			<div className='text-xs font-semibold text-muted-foreground mb-2'>
				{section.step}
			</div>
			<h2 className='text-lg font-semibold tracking-tight mb-2'>
				{section.title}
			</h2>
			<p className='text-[15px] leading-relaxed text-muted-foreground mb-5'>
				{section.intro}
			</p>
			<div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
				<List title={section.left[0]} items={section.left} />
				<List title={section.right[0]} items={section.right} />
			</div>
			{section.code && (
				<MarkdownContent source={`\`\`\`python\n${section.code}\n\`\`\``} />
			)}
		</section>
	);
}

export function ExploratoryDataAnalysis({ item }: CustomizedComponentProps) {
	return (
		<div className='space-y-6'>
			<div>
				<div className='flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground'>
					<span className='rounded-full border border-input px-2.5 py-1'>
						9-step workflow
					</span>
					<span className='rounded-full border border-input px-2.5 py-1'>
						20 dataset examples
					</span>
					<span className='rounded-full border border-input px-2.5 py-1'>
						Pandas + Plotly
					</span>
				</div>
				<p className='text-muted-foreground leading-relaxed'>{item.covers}</p>
			</div>
			<div className='space-y-4'>
				{SECTIONS.map((section) => (
					<SectionCard key={section.step} section={section} />
				))}
			</div>
			<div className='border-t border-border pt-5'>
				<div className='text-xs font-semibold text-muted-foreground mb-2'>
					Pre-modeling checklist
				</div>
				<div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground'>
					{[
						"Shape, columns, and data types confirmed",
						"Missing values quantified and handled",
						"Descriptive statistics reviewed",
						"Distributions understood and transformed where needed",
						"Outliers identified and treatment chosen",
						"Correlations checked and redundancy flagged",
						"Patterns, anomalies, and assumptions documented",
					].map((entry) => (
						<div key={entry} className='flex gap-2'>
							<span className='text-status-solid'>✓</span>
							{entry}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
