# 100+ Data Visualization Chart Types — Complete Reference

> 109 distinct, commonly-used chart types, organized by visualization category (trend, density, relationship, composition, geospatial, ranking, flow, part-to-whole, time series, correlation, network, multivariate, structural, qualitative, gauge, anomaly detection, behavioral, text analysis, text-based, deviation, financial, concept, proportional, hierarchical, distribution, comparison, and statistical). Each entry includes a description, its purpose, 3-5 real-world examples of when it's used, a concrete sample dataset, and a polished, presentation-ready code example — built with whichever of matplotlib, seaborn, or plotly is genuinely the best fit.

**How this file was put together:** the chart content, code, and sample datasets are carried over unchanged from the verified 100+ Chart Types cheat sheet (executed end-to-end against matplotlib 3.10, seaborn 0.13.2, plotly 6.9, pandas 3.0, and numpy 2.4 with zero errors and zero deprecation warnings). The category structure — 27 categories instead of the original 12 — is carried over from the Data Visualization cheat sheet, since it groups chart types more precisely by what they're used for. Two categories (Qualitative Charts, Concept Charts) had no equivalent among the 103 verified charts, so 6 additional diagram-style charts were added there, adapted from the Data Visualization cheat sheet's own examples and verified to run cleanly.

**How the library was picked per chart:** matplotlib for full control, vector fields, and anything the other two don't support; seaborn for statistical/distribution/categorical plots where it does more with less code; plotly for anything interactive, hierarchical, geospatial, 3D, or animated.

## 📑 Table of Contents

- [⚡ Setup](#setup)
- [📊 Full Chart Index](#full-chart-index)
- [📈 Trend Visualizations](#trend-visualizations)
- [🎯 Density Charts](#density-charts)
- [🔗 Relationship Charts](#relationship-charts)
- [🥧 Composition Charts](#composition-charts)
- [🗺️ Geospatial Charts](#geospatial-charts)
- [🏆 Ranking Charts](#ranking-charts)
- [🌊 Flow Charts](#flow-charts)
- [📊 Part-to-Whole Charts](#part-to-whole-charts)
- [⏰ Time Series Charts](#time-series-charts)
- [🔗 Correlation Charts](#correlation-charts)
- [🕸️ Network Charts](#network-charts)
- [📊 Multivariate Charts](#multivariate-charts)
- [🏗️ Structural Charts](#structural-charts)
- [🎨 Qualitative Charts](#qualitative-charts)
- [📏 Gauge Indicators](#gauge-indicators)
- [🚨 Anomaly Detection Charts](#anomaly-detection-charts)
- [🎯 Behavioral Charts](#behavioral-charts)
- [📝 Text Analysis Charts](#text-analysis-charts)
- [📋 Text-Based Charts](#text-based-charts)
- [↔️ Deviation Charts](#deviation-charts)
- [💹 Financial Charts](#financial-charts)
- [🔷 Concept Charts](#concept-charts)
- [🥧 Proportional Charts](#proportional-charts)
- [🌳 Hierarchical Charts](#hierarchical-charts)
- [📊 Distribution Charts](#distribution-charts)
- [📊 Comparison Charts](#comparison-charts)
- [📈 Statistical Charts](#statistical-charts)

## ⚡ Setup

```python
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
import numpy as np

rng = np.random.default_rng(42)  # used by a few sample datasets below
```

Each chart below is self-contained: run its **Sample Dataset** block first to create `df` (and any other variables it needs), then its **Chart Code** block. Swap in your real data by matching the same column names. Snippets marked 🔧 Matplotlib or 📊 Seaborn end with `plt.show()`; snippets marked 🌐 Plotly end with `fig.show()`.

## 📊 Full Chart Index

| # | Chart | Category | Library |
|---|---|---|---|
| 1 | Line chart | Trend Visualizations | 🔧 Matplotlib |
| 2 | Multi-series line chart | Trend Visualizations | 📊 Seaborn |
| 3 | Area chart | Trend Visualizations | 🌐 Plotly |
| 4 | Animated scatter over time | Trend Visualizations | 🌐 Plotly |
| 5 | KDE plot | Density Charts | 📊 Seaborn |
| 6 | 2D histogram (density heatmap) | Density Charts | 🌐 Plotly |
| 7 | 2D KDE / density contour | Density Charts | 📊 Seaborn |
| 8 | Hexbin plot | Density Charts | 🔧 Matplotlib |
| 9 | Contour plot | Density Charts | 🔧 Matplotlib |
| 10 | Filled contour plot | Density Charts | 🔧 Matplotlib |
| 11 | Scatter plot | Relationship Charts | 📊 Seaborn |
| 12 | Bubble chart | Relationship Charts | 🌐 Plotly |
| 13 | Pair plot | Relationship Charts | 📊 Seaborn |
| 14 | Joint plot | Relationship Charts | 📊 Seaborn |
| 15 | Regression plot | Relationship Charts | 📊 Seaborn |
| 16 | Scatter with marginal distributions | Relationship Charts | 📊 Seaborn |
| 17 | Stacked area chart | Composition Charts | 🌐 Plotly |
| 18 | Pie chart | Composition Charts | 🌐 Plotly |
| 19 | Donut chart | Composition Charts | 🌐 Plotly |
| 20 | Waffle chart | Composition Charts | 🔧 Matplotlib |
| 21 | Voronoi diagram | Composition Charts | 🔧 Matplotlib |
| 22 | Choropleth map | Geospatial Charts | 🌐 Plotly |
| 23 | Scatter / bubble map | Geospatial Charts | 🌐 Plotly |
| 24 | Density map (heatmap over tiles) | Geospatial Charts | 🌐 Plotly |
| 25 | Flow / line map | Geospatial Charts | 🌐 Plotly |
| 26 | Animated choropleth over time | Geospatial Charts | 🌐 Plotly |
| 27 | Step chart | Ranking Charts | 🔧 Matplotlib |
| 28 | Bar chart (horizontal) | Ranking Charts | 🌐 Plotly |
| 29 | Pareto chart | Ranking Charts | 🌐 Plotly |
| 30 | Animated bar chart race | Ranking Charts | 🌐 Plotly |
| 31 | Sankey diagram | Flow Charts | 🌐 Plotly |
| 32 | Quiver plot (vector field) | Flow Charts | 🔧 Matplotlib |
| 33 | Streamplot (flow lines) | Flow Charts | 🔧 Matplotlib |
| 34 | Stacked bar chart | Part-to-Whole Charts | 🌐 Plotly |
| 35 | Waterfall chart | Part-to-Whole Charts | 🌐 Plotly |
| 36 | Simple time series | Time Series Charts | 🌐 Plotly |
| 37 | Multi-line time series | Time Series Charts | 🌐 Plotly |
| 38 | Area-under-line time series | Time Series Charts | 🌐 Plotly |
| 39 | Calendar heatmap | Time Series Charts | 📊 Seaborn |
| 40 | Rolling average overlay | Time Series Charts | 🌐 Plotly |
| 41 | Time series with event annotations | Time Series Charts | 🌐 Plotly |
| 42 | Range slider + selector buttons | Time Series Charts | 🌐 Plotly |
| 43 | Seasonal decomposition plot | Time Series Charts | 🔧 Matplotlib |
| 44 | Cumulative sum chart | Time Series Charts | 🌐 Plotly |
| 45 | Range selector buttons | Time Series Charts | 🌐 Plotly |
| 46 | Gantt chart | Time Series Charts | 🌐 Plotly |
| 47 | Correlation heatmap | Correlation Charts | 📊 Seaborn |
| 48 | Correlogram (annotated pair grid) | Correlation Charts | 📊 Seaborn |
| 49 | Network / graph diagram | Network Charts | 🔧 Matplotlib |
| 50 | Bubble scatter (3 numeric dims) | Multivariate Charts | 🌐 Plotly |
| 51 | Parallel coordinates plot | Multivariate Charts | 🌐 Plotly |
| 52 | Andrews curves | Multivariate Charts | 🔧 Matplotlib |
| 53 | RadViz | Multivariate Charts | 🔧 Matplotlib |
| 54 | 3D scatter plot | Multivariate Charts | 🌐 Plotly |
| 55 | Annotated heatmap | Multivariate Charts | 📊 Seaborn |
| 56 | Radar / spider chart | Multivariate Charts | 🌐 Plotly |
| 57 | 3D surface plot | Structural Charts | 🌐 Plotly |
| 58 | Mind Map | Qualitative Charts | 🔧 Matplotlib |
| 59 | SWOT Analysis | Qualitative Charts | 🔧 Matplotlib |
| 60 | Journey Map | Qualitative Charts | 🔧 Matplotlib |
| 61 | Gauge / indicator chart | Gauge Indicators | 🌐 Plotly |
| 62 | Control chart / run chart | Anomaly Detection Charts | 🔧 Matplotlib |
| 63 | Funnel chart | Behavioral Charts | 🌐 Plotly |
| 64 | Word cloud | Text Analysis Charts | 🔧 Matplotlib |
| 65 | Interactive data table | Text-Based Charts | 🌐 Plotly |
| 66 | Custom hover tooltips | Text-Based Charts | 🌐 Plotly |
| 67 | Diverging bar chart | Deviation Charts | 🌐 Plotly |
| 68 | Candlestick / OHLC chart | Financial Charts | 🌐 Plotly |
| 69 | Fishbone Diagram (Ishikawa) | Concept Charts | 🔧 Matplotlib |
| 70 | Pyramid Diagram | Concept Charts | 🔧 Matplotlib |
| 71 | Step-by-Step Diagram | Concept Charts | 🔧 Matplotlib |
| 72 | Nested (concentric) pie | Proportional Charts | 🔧 Matplotlib |
| 73 | Marimekko chart | Proportional Charts | 🌐 Plotly |
| 74 | Treemap | Hierarchical Charts | 🌐 Plotly |
| 75 | Sunburst chart | Hierarchical Charts | 🌐 Plotly |
| 76 | Icicle chart | Hierarchical Charts | 🌐 Plotly |
| 77 | Dendrogram | Hierarchical Charts | 🔧 Matplotlib |
| 78 | Radial / circular tree | Hierarchical Charts | 🌐 Plotly |
| 79 | Clustermap | Hierarchical Charts | 📊 Seaborn |
| 80 | Dot plot (Cleveland) | Distribution Charts | 🔧 Matplotlib |
| 81 | Histogram | Distribution Charts | 📊 Seaborn |
| 82 | Histogram + KDE overlay | Distribution Charts | 📊 Seaborn |
| 83 | Rug plot | Distribution Charts | 📊 Seaborn |
| 84 | Violin plot | Distribution Charts | 📊 Seaborn |
| 85 | Strip plot | Distribution Charts | 📊 Seaborn |
| 86 | Swarm plot | Distribution Charts | 📊 Seaborn |
| 87 | Boxen plot (letter-value) | Distribution Charts | 📊 Seaborn |
| 88 | ECDF plot | Distribution Charts | 🌐 Plotly |
| 89 | Ridge plot (joyplot) | Distribution Charts | 📊 Seaborn |
| 90 | Count plot | Distribution Charts | 📊 Seaborn |
| 91 | Overlaid ECDFs | Distribution Charts | 📊 Seaborn |
| 92 | Wind rose / polar bar chart | Distribution Charts | 🔧 Matplotlib |
| 93 | Bar chart (vertical) | Comparison Charts | 🌐 Plotly |
| 94 | Grouped bar chart | Comparison Charts | 🌐 Plotly |
| 95 | Point plot | Comparison Charts | 📊 Seaborn |
| 96 | Lollipop chart | Comparison Charts | 🔧 Matplotlib |
| 97 | 100% stacked bar chart | Comparison Charts | 🌐 Plotly |
| 98 | Faceted subplots (small multiples) | Comparison Charts | 🌐 Plotly |
| 99 | Dropdown-filtered chart | Comparison Charts | 🌐 Plotly |
| 100 | Dual-axis combo chart (bar + line) | Comparison Charts | 🌐 Plotly |
| 101 | Box plot | Statistical Charts | 📊 Seaborn |
| 102 | Bar plot with error bars | Statistical Charts | 🌐 Plotly |
| 103 | Dot plot with confidence interval | Statistical Charts | 🌐 Plotly |
| 104 | Residual plot | Statistical Charts | 📊 Seaborn |
| 105 | Q-Q plot | Statistical Charts | 🔧 Matplotlib |
| 106 | Error bar plot | Statistical Charts | 🔧 Matplotlib |
| 107 | Forest plot | Statistical Charts | 🔧 Matplotlib |
| 108 | Missing-data matrix | Statistical Charts | 📊 Seaborn |
| 109 | Bland-Altman plot | Statistical Charts | 🔧 Matplotlib |

## 📈 Trend Visualizations

Trend charts help you understand changes over time and identify patterns in sequential data.

### 1. Line chart — 🔧 Matplotlib

**Description:** A continuous line connecting ordered data points, typically plotted against a sequential or time-based x-axis.

**Purpose:** Use it to show how a single metric trends, rises, or falls across an ordered sequence — the default choice for 'how has X changed'.

**Common Examples:**
- Tracking monthly website traffic over a year
- Plotting a stock's closing price day by day
- Showing a patient's body temperature readings over a hospital stay
- Visualizing a factory's daily output volume

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': list(range(1, 13)),
    'y': [102, 115, 108, 130, 142, 138, 155, 149, 160, 171, 168, 185]
})  # e.g. monthly active users (thousands), Jan-Dec
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(df['x'], df['y'], color='#2E86AB', linewidth=2.5)
ax.fill_between(df['x'], df['y'], alpha=0.15, color='#2E86AB')
peak = df.loc[df['y'].idxmax()]
ax.annotate(f"Peak: {peak['y']:.0f}", xy=(peak['x'], peak['y']),
            xytext=(10, 15), textcoords='offset points',
            arrowprops=dict(arrowstyle='->', color='gray'))
ax.set_title('Metric Over Time', fontsize=14, fontweight='bold')
ax.set_xlabel('x'); ax.set_ylabel('y')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.show()
```

### 2. Multi-series line chart — 📊 Seaborn

**Description:** Several line charts sharing the same axes, each representing a different group, so trends can be compared directly.

**Purpose:** Use it when you need to compare how 2+ groups trend over the same period — e.g. product lines, regions, or cohorts.

**Common Examples:**
- Comparing revenue trends across three product lines
- Tracking daily active users across web, iOS, and Android
- Comparing exam scores over time for two teaching methods
- Visualizing temperature trends across five cities

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': list(range(1, 7)) * 2,
    'y': [20, 28, 25, 35, 40, 38, 15, 18, 22, 20, 26, 30],
    'category': ['Product A'] * 6 + ['Product B'] * 6
})  # monthly revenue ($k) for two product lines, Jan-Jun
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.lineplot(data=df, x='x', y='y', hue='category', linewidth=2.5, palette='viridis')
for name, grp in df.groupby('category'):
    last = grp.iloc[-1]
    ax.text(last['x'], last['y'], f'  {name}', va='center', fontsize=9)
ax.legend_.remove()  # labels already shown at line-ends
ax.set_title('Comparing Series Over Time', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 3. Area chart — 🌐 Plotly

**Description:** A line chart with the region beneath the line filled in, emphasizing magnitude/volume over the axis.

**Purpose:** Use it like a line chart, but when you want to emphasize accumulated volume or make the trend feel more 'substantial' visually.

**Common Examples:**
- Total energy consumption over a day
- Cumulative rainfall over a storm event
- Server memory usage over 24 hours
- Daily calorie intake over a month

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': list(range(0, 24, 2)),
    'y': [12, 10, 9, 15, 28, 45, 60, 58, 40, 30, 20, 14]
})  # hourly energy usage (kWh) over a day
```

**Chart Code:**
```python
fig = px.area(df, x='x', y='y', template='plotly_white', title='Cumulative Volume')
fig.update_traces(line_color='#457B9D', fillcolor='rgba(69,123,157,0.3)')
fig.show()
```

### 4. Animated scatter over time — 🌐 Plotly

**Description:** A scatter plot that steps through sequential frames (e.g. one per year) via a play button, showing points move as the underlying data changes.

**Purpose:** Use it to make a trend across many entities and time periods viscerally obvious — famous for showing country development trajectories over decades.

**Common Examples:**
- Country GDP vs. life expectancy over decades (Gapminder-style)
- Player stats evolving across a sports season
- Company valuation vs. revenue evolving across funding rounds
- City population vs. pollution evolving over years

**Sample Dataset:**
```python
df = pd.DataFrame({
    'entity': ['CountryA','CountryA','CountryB','CountryB'],
    'x': [5, 8, 3, 6],
    'y': [65, 75, 55, 68],
    'size': [50, 80, 30, 45],
    'category': ['Asia','Asia','Africa','Africa'],
    'year': [2020, 2023, 2020, 2023]
})  # x/y trajectory for two countries across two years
```

**Chart Code:**
```python
fig = px.scatter(df, x='x', y='y', animation_frame='year', animation_group='entity',
                  size='size', color='category', hover_name='entity',
                  size_max=45, range_x=[df['x'].min(), df['x'].max()],
                  range_y=[df['y'].min(), df['y'].max()], template='plotly_white',
                  title='Change Over Time')
fig.show()
```

---

## 🎯 Density Charts

Density charts reveal concentration patterns and data distribution in space.

### 5. KDE plot — 📊 Seaborn

**Description:** A smoothed curve estimating the underlying probability density of a variable, without the blockiness of bin edges.

**Purpose:** Use it instead of (or alongside) a histogram when you want a smooth, bin-independent view of distribution shape, especially comparing groups.

**Common Examples:**
- Comparing income distribution between two cities
- Comparing reaction time distribution between two experiment conditions
- Comparing test score distribution between two schools
- Comparing delivery time distribution between two couriers

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [45, 50, 48, 55, 60, 58, 65, 70, 68, 52, 47, 62, 66, 72, 44, 57, 61, 49, 63, 54],
    'category': ['A']*10 + ['B']*10
})  # response time (ms) by system version
```

**Chart Code:**
```python
sns.set_theme(style='white')
ax = sns.kdeplot(data=df, x='x', hue='category', fill=True, alpha=0.4, linewidth=2, palette='mako')
ax.set_title('Density by Category', fontsize=14, fontweight='bold')
sns.despine()
plt.tight_layout(); plt.show()
```

### 6. 2D histogram (density heatmap) — 🌐 Plotly

**Description:** A grid of colored cells showing how many observations fall into each 2D bin across two numeric variables.

**Purpose:** Use it instead of a scatter plot when you have SO many points that individual markers overplot into a solid blob — this shows density cleanly.

**Common Examples:**
- Density of ride pickup locations by hour of day
- Density of transaction amount vs. time of day
- Density of sensor readings across two dimensions
- Density of website clicks by x/y pixel position (heatmap)

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1,2,2,3,3,3,4,4,5,5,5,5,6,6,7,2,3,4,4,5],
    'y': [10,12,11,15,14,16,20,19,22,21,23,24,25,26,28,13,15,18,19,22]
})  # hour of day vs. order value, many overlapping points
```

**Chart Code:**
```python
fig = px.density_heatmap(df, x='x', y='y', nbinsx=30, nbinsy=30,
                          color_continuous_scale='Viridis', template='plotly_white',
                          title='2D Density Heatmap')
fig.show()
```

### 7. 2D KDE / density contour — 📊 Seaborn

**Description:** Smoothed contour lines (or filled bands) showing where the joint density of two continuous variables concentrates.

**Purpose:** Use it like a 2D histogram, but smoother — good for showing 'hotspots' where two variables co-occur most often.

**Common Examples:**
- Where income and spending co-occur most among customers
- Where temperature and humidity co-occur in a weather dataset
- Where age and account balance concentrate among bank customers
- Where latitude/longitude concentrate for a delivery service's orders

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [20,22,25,23,21,45,47,46,44,48,30,32,31,29,33],
    'y': [200,220,250,230,210,500,520,510,490,530,350,370,360,340,380]
})  # customer age vs. monthly spend ($)
```

**Chart Code:**
```python
sns.set_theme(style='white')
ax = sns.kdeplot(data=df, x='x', y='y', fill=True, cmap='mako', thresh=0.05, levels=8)
ax.set_title('2D Density Contour', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 8. Hexbin plot — 🔧 Matplotlib

**Description:** A scatter plot alternative where points are binned into hexagonal cells, colored by how many points fall in each — avoids overplotting.

**Purpose:** Use it instead of a scatter plot when you have tens of thousands of points and markers would just blur into a solid mass.

**Common Examples:**
- Density of taxi pickup locations across a city grid
- Density of sensor readings across two channels
- Density of trade price vs. volume in high-frequency data
- Density of pixel intensity values in an image dataset

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': np.concatenate([rng.normal(5, 1, 300), rng.normal(8, 1.5, 300)]),
    'y': np.concatenate([rng.normal(20, 3, 300), rng.normal(30, 2, 300)])
})  # two overlapping dense clusters (600 points)
```

**Chart Code:**
```python
from matplotlib.colors import LogNorm
fig, ax = plt.subplots(figsize=(8, 6))
hb = ax.hexbin(df['x'], df['y'], gridsize=30, cmap='inferno', norm=LogNorm())
fig.colorbar(hb, ax=ax, label='count (log scale)')
ax.set_title('Density (Hexbin)', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 9. Contour plot — 🔧 Matplotlib

**Description:** Lines connecting points of equal value across a 2D grid, like elevation lines on a topographic map.

**Purpose:** Use it as a 2D, print-friendly alternative to a 3D surface plot when you mainly care about WHERE values are equal, not the 3D shape.

**Common Examples:**
- Topographic elevation lines on a geographic map
- Equal-pressure lines on a weather map (isobars)
- Equal-cost lines on an optimization landscape
- Equal-concentration lines in a diffusion simulation

**Sample Dataset:**
```python
x = np.linspace(-3, 3, 40)
y = np.linspace(-3, 3, 40)
X, Y = np.meshgrid(x, y)
Z = np.sin(np.sqrt(X**2 + Y**2))  # same ripple function, viewed as contours
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(7, 6))
cs = ax.contour(X, Y, Z, levels=12, cmap='viridis')
ax.clabel(cs, inline=True, fontsize=8)
ax.set_title('Contour Plot', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 10. Filled contour plot — 🔧 Matplotlib

**Description:** A contour plot with the bands between elevation lines filled with color, making the overall pattern easier to read at a glance.

**Purpose:** Use it instead of a line-only contour plot when you want the regions between levels to be immediately readable by color, not just outlined.

**Common Examples:**
- Rainfall intensity map filled by color bands
- Heat distribution across a circuit board
- Population density bands across a region
- Air quality index bands across a city

**Sample Dataset:**
```python
x = np.linspace(-3, 3, 40)
y = np.linspace(-3, 3, 40)
X, Y = np.meshgrid(x, y)
Z = np.sin(np.sqrt(X**2 + Y**2))  # same ripple function, filled
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(7, 6))
cf = ax.contourf(X, Y, Z, levels=15, cmap='inferno')
fig.colorbar(cf, ax=ax, label='z value')
ax.set_title('Filled Contour Plot', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

---

## 🔗 Relationship Charts

Relationship charts help identify correlations and connections between variables.

### 11. Scatter plot — 📊 Seaborn

**Description:** Individual points plotted on two numeric axes, revealing the relationship (or lack of one) between two variables.

**Purpose:** Use it to inspect correlation, clusters, or outliers between two continuous variables — the first chart for 'is X related to Y'.

**Common Examples:**
- Advertising spend vs. units sold, colored by region
- Study hours vs. exam score for a class of students
- House square footage vs. sale price
- Employee tenure vs. annual performance rating

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [2, 4, 5, 7, 8, 10, 12, 13, 15, 16],
    'y': [15, 22, 24, 33, 30, 41, 47, 44, 55, 58],
    'category': ['North', 'North', 'South', 'South', 'North', 'South', 'North', 'South', 'North', 'South']
})  # ad spend ($k) vs. units sold, by sales region
```

**Chart Code:**
```python
sns.set_theme(style='ticks')
ax = sns.scatterplot(data=df, x='x', y='y', hue='category', size='category',
                      sizes=(60, 200), alpha=0.75, edgecolor='white', linewidth=0.5)
ax.set_title('x vs. y by Category', fontsize=14, fontweight='bold')
sns.despine()
plt.tight_layout(); plt.show()
```

### 12. Bubble chart — 🌐 Plotly

**Description:** A scatter plot where marker size (and often color) encodes one or two additional variables beyond x and y.

**Purpose:** Use it when a plain scatter plot needs to show a 3rd or 4th dimension — e.g. how big a country/product/deal actually is, not just where it sits.

**Common Examples:**
- GDP per capita vs. life expectancy, bubble size = population (classic Gapminder chart)
- Marketing spend vs. leads generated, bubble size = deal value
- Risk vs. return across a stock portfolio, bubble size = position size
- Player speed vs. accuracy, bubble size = games played

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1.2, 3.5, 5.1, 7.8, 9.0, 11.4],
    'y': [65, 71, 74, 79, 81, 83],
    'size': [1300, 210, 33, 5, 65, 328],           # population (millions)
    'category': ['Asia', 'S.America', 'Africa', 'Oceania', 'Europe', 'N.America'],
    'label': ['CountryA', 'CountryB', 'CountryC', 'CountryD', 'CountryE', 'CountryF']
})  # GDP per capita ($k) vs. life expectancy, sized by population
```

**Chart Code:**
```python
fig = px.scatter(
    df, x='x', y='y', size='size', color='category',
    hover_name='label', hover_data={'x': ':.1f', 'y': ':.1f', 'size': True},
    size_max=45, template='plotly_white', title='Multi-Variable Bubble Chart'
)
fig.update_traces(marker=dict(line=dict(width=1, color='white')))
fig.show()
```

### 13. Pair plot — 📊 Seaborn

**Description:** A grid of scatter plots for every pair of numeric columns in a dataset, with distributions on the diagonal.

**Purpose:** Use it as a first-pass exploratory tool to spot every pairwise relationship and distribution shape in a dataset at once, before deeper analysis.

**Common Examples:**
- Exploring relationships across the Iris flower measurements
- Exploring relationships across financial ratios in a stock screener
- Exploring relationships across patient vitals in a clinical dataset
- Exploring relationships across product specs before building a pricing model

**Sample Dataset:**
```python
df = pd.DataFrame({
    'a': [1.2, 2.3, 1.8, 3.1, 2.9, 1.5, 3.4, 2.1],
    'b': [5.1, 6.2, 5.8, 7.0, 6.8, 5.4, 7.3, 6.0],
    'c': [10, 14, 12, 18, 16, 11, 19, 13],
    'category': ['X','X','X','X','Y','Y','Y','Y']
})  # three numeric measurements across two groups
```

**Chart Code:**
```python
sns.set_theme(style='ticks')
g = sns.pairplot(df, hue='category', diag_kind='kde', palette='husl',
                  plot_kws=dict(alpha=0.6, edgecolor='white', s=40))
g.figure.suptitle('Pairwise Relationships', y=1.02, fontsize=14, fontweight='bold')
plt.show()
```

### 14. Joint plot — 📊 Seaborn

**Description:** A central scatter plot (often with a regression line) paired with marginal histograms for both variables in one figure.

**Purpose:** Use it when you want the relationship AND each variable's individual distribution in a single, compact view.

**Common Examples:**
- Relationship between hours studied and exam score, with distributions
- Relationship between ad spend and revenue, with distributions
- Relationship between height and weight, with distributions
- Relationship between temperature and ice cream sales, with distributions

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [2, 3, 4, 5, 6, 7, 3, 5, 6, 4],
    'y': [65, 70, 74, 80, 85, 90, 68, 78, 88, 75]
})  # study hours vs. exam score
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
g = sns.jointplot(data=df, x='x', y='y', kind='reg', color='#2E86AB',
                   joint_kws={'scatter_kws': {'alpha': 0.5}})
g.figure.suptitle('Relationship with Marginal Distributions', y=1.02, fontsize=13, fontweight='bold')
plt.show()
```

### 15. Regression plot — 📊 Seaborn

**Description:** A scatter plot with a fitted linear trend line and a shaded confidence band drawn through the points.

**Purpose:** Use it to visually communicate the strength and direction of a linear relationship, including how confident that fit is.

**Common Examples:**
- Advertising spend predicting sales revenue
- Years of experience predicting salary
- Square footage predicting home price
- Temperature predicting energy consumption

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5, 6, 7, 8],
    'y': [32000, 38000, 41000, 47000, 52000, 58000, 61000, 67000]
})  # years of experience vs. salary ($)
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.regplot(data=df, x='x', y='y', scatter_kws={'alpha': 0.5, 'color': '#457B9D'},
                  line_kws={'color': '#E63946', 'linewidth': 2.5})
ax.set_title('Linear Fit with 95% Confidence Band', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 16. Scatter with marginal distributions — 📊 Seaborn

**Description:** A central density or scatter plot flanked by marginal distribution panels for both axes.

**Purpose:** Use it as a richer version of a joint plot when the DENSITY (not just individual points) of each variable matters as much as their relationship.

**Common Examples:**
- Density of income vs. spending with marginal distributions
- Density of test scores vs. study time with marginals
- Density of latitude vs. longitude for event locations
- Density of two correlated sensor channels

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': rng.normal(50, 10, 100),
    'y': rng.normal(30, 8, 100)
})  # 100 points for a density-focused joint view
```

**Chart Code:**
```python
sns.set_theme(style='white')
g = sns.jointplot(data=df, x='x', y='y', kind='kde', fill=True, cmap='mako')
g.plot_joint(sns.scatterplot, color='white', s=15, alpha=0.5)
g.figure.suptitle('Density with Overlaid Points', y=1.02, fontsize=13, fontweight='bold')
plt.show()
```

---

## 🥧 Composition Charts

Composition charts show how parts make up a whole.

### 17. Stacked area chart — 🌐 Plotly

**Description:** Multiple area series stacked, showing how the composition of a total changes over an axis (usually time).

**Purpose:** Use it to show how the MIX of contributing categories evolves over time, while still showing the overall total.

**Common Examples:**
- Market share by competitor over the last 5 years
- Energy generation mix (coal/gas/solar/wind) over time
- App traffic by platform (iOS/Android/Web) over months
- Budget allocation by department over fiscal years

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [2020, 2020, 2021, 2021, 2022, 2022, 2023, 2023],
    'y': [30, 15, 28, 22, 24, 30, 18, 38],
    'category': ['Coal', 'Solar', 'Coal', 'Solar', 'Coal', 'Solar', 'Coal', 'Solar']
})  # energy generation (%) by source, 2020-2023
```

**Chart Code:**
```python
fig = px.area(df, x='x', y='y', color='category', template='plotly_white',
              title='Composition Over Time', color_discrete_sequence=px.colors.qualitative.Pastel)
fig.update_layout(hovermode='x unified')
fig.show()
```

### 18. Pie chart — 🌐 Plotly

**Description:** A circle divided into wedges, each wedge's angle proportional to its category's share of the whole.

**Purpose:** Use it ONLY for a small number of categories (ideally 5 or fewer) where showing 'share of total' at a glance matters more than precise comparison.

**Common Examples:**
- Market share by competitor
- Budget allocation by department
- Traffic source breakdown (organic/paid/referral/direct)
- Vote share by candidate

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Organic', 'Paid Search', 'Social', 'Referral', 'Direct'],
    'value': [4200, 2800, 1500, 900, 1600]
})  # website sessions by traffic source
```

**Chart Code:**
```python
pull = [0.1 if v == df['value'].min() else 0 for v in df['value']]
fig = px.pie(df, names='category', values='value', template='plotly_white', title='Share of Total',
             color_discrete_sequence=px.colors.qualitative.Set2)
fig.update_traces(pull=pull, textinfo='percent+label')
fig.show()
```

### 19. Donut chart — 🌐 Plotly

**Description:** A pie chart with the center removed, functionally identical but visually lighter and able to display a summary number in the middle.

**Purpose:** Use it exactly like a pie chart, but when you also want to show the grand total (or a key label) in the empty center space.

**Common Examples:**
- Total revenue in the center, broken down by product line
- Total headcount in the center, broken down by department
- Total storage used in the center, broken down by file type
- Total budget in the center, broken down by category

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Cloud Storage', 'Compute', 'Networking', 'Support'],
    'value': [12000, 25000, 8000, 5000]
})  # monthly cloud spend ($) by service category
```

**Chart Code:**
```python
fig = px.pie(df, names='category', values='value', hole=0.5, template='plotly_white',
             title='Share of Total', color_discrete_sequence=px.colors.qualitative.Pastel)
fig.update_traces(textinfo='percent+label')
fig.add_annotation(text=f"Total<br>{df['value'].sum():.0f}", x=0.5, y=0.5,
                    font_size=16, showarrow=False)
fig.show()
```

### 20. Waffle chart — 🔧 Matplotlib

**Description:** A grid of small squares (usually 10x10), each square representing a fixed share of the total — an intuitive, countable pie-chart alternative.

**Purpose:** Use it as a more literal, easy-to-eyeball alternative to a pie chart, especially for percentages the audience should be able to 'count'.

**Common Examples:**
- Percentage of customers who are repeat buyers
- Percentage of survey respondents satisfied vs. not
- Percentage of budget spent vs. remaining
- Percentage of tests passing vs. failing in a QA suite

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Satisfied', 'Neutral', 'Unsatisfied'],
    'value': [68, 22, 10]
})  # survey response percentages (sums to 100)
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(6, 6))
pct = (df.set_index('category')['value'] / df['value'].sum() * 100).round().astype(int)
grid = np.zeros((10, 10), dtype=int)
flat_idx = 0
labels = []
for i, (cat, n) in enumerate(pct.items()):
    for _ in range(n):
        if flat_idx < 100:
            grid[flat_idx // 10, flat_idx % 10] = i
            flat_idx += 1
    labels.append(cat)
cmap = plt.colormaps['Set2'].resampled(len(labels))
ax.imshow(grid, cmap=cmap)
ax.set_xticks([]); ax.set_yticks([])
handles = [plt.Rectangle((0, 0), 1, 1, color=cmap(i)) for i in range(len(labels))]
ax.legend(handles, labels, bbox_to_anchor=(1.05, 1), loc='upper left')
ax.set_title('Waffle Chart (1 square = 1%)', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 21. Voronoi diagram — 🔧 Matplotlib

**Description:** Space divided into regions, each region containing all points closest to one particular seed point, forming natural cell-like boundaries.

**Purpose:** Use it to visualize zones of influence or 'nearest neighbor' territory around a set of points — coverage areas, market territories.

**Common Examples:**
- Delivery zone assignment for warehouse locations
- Coverage area for cell towers
- Market territory for retail store locations
- Nearest-hospital catchment areas

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [2, 5, 8, 3, 7, 5.5],
    'y': [2, 3, 2, 7, 7, 5]
})  # 6 warehouse locations to derive delivery zones from
```

**Chart Code:**
```python
from scipy.spatial import Voronoi, voronoi_plot_2d
points = df[['x', 'y']].values
vor = Voronoi(points)
fig, ax = plt.subplots(figsize=(7, 7))
voronoi_plot_2d(vor, ax=ax, show_vertices=False, line_colors='gray', line_width=1.5, point_size=0)
ax.scatter(points[:, 0], points[:, 1], color='#E63946', s=40, zorder=3)
ax.set_title('Voronoi Diagram', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

---

## 🗺️ Geospatial Charts

Geospatial charts visualize data on maps and geographic regions.

### 22. Choropleth map — 🌐 Plotly

**Description:** A map where each region (country, state, county) is shaded by a metric's value — darker/lighter indicating higher/lower.

**Purpose:** Use it whenever a metric is naturally tied to geographic regions and you want the map itself to carry the comparison.

**Common Examples:**
- Unemployment rate by U.S. state
- Population density by country
- Election results by county
- Average income by province

**Sample Dataset:**
```python
df = pd.DataFrame({
    'iso_code': ['USA', 'CAN', 'MEX', 'BRA', 'GBR', 'FRA'],
    'country': ['United States', 'Canada', 'Mexico', 'Brazil', 'United Kingdom', 'France'],
    'value': [63500, 52000, 21000, 15600, 46000, 43500]
})  # GDP per capita ($) by country
```

**Chart Code:**
```python
fig = px.choropleth(df, locations='iso_code', color='value', scope='world',
                     color_continuous_scale='Plasma', hover_name='country',
                     template='plotly_white', title='Value by Country')
fig.show()
```

### 23. Scatter / bubble map — 🌐 Plotly

**Description:** Individual points plotted at real latitude/longitude coordinates on top of a map background, optionally sized/colored.

**Purpose:** Use it when your data represents actual physical LOCATIONS (stores, events, sensors) rather than aggregate regions.

**Common Examples:**
- Store locations sized by monthly revenue
- Earthquake events sized by magnitude
- Delivery addresses colored by delivery status
- Weather stations colored by current temperature

**Sample Dataset:**
```python
df = pd.DataFrame({
    'lat': [14.60, 10.31, 7.19, 16.41, 6.11],
    'lon': [120.98, 123.89, 125.46, 120.59, 125.17],
    'value': [85, 42, 30, 20, 15],
    'category': ['Flagship', 'Standard', 'Standard', 'Kiosk', 'Kiosk'],
    'label': ['Manila', 'Cebu', 'Davao', 'Baguio', 'Digos']
})  # store locations sized by monthly revenue ($k)
```

**Chart Code:**
```python
fig = px.scatter_geo(df, lat='lat', lon='lon', size='value', color='category',
                      hover_name='label', projection='natural earth',
                      template='plotly_white', title='Locations by Category')
fig.show()
```

### 24. Density map (heatmap over tiles) — 🌐 Plotly

**Description:** A smoothed heat overlay on a real map, showing where point-based activity concentrates most densely.

**Purpose:** Use it when you have MANY points and want to show hotspots of concentration, rather than plotting every individual marker.

**Common Examples:**
- Ride-hailing pickup density across a city
- Crime incident density by neighborhood
- Customer location density for a delivery service
- Wildlife sighting density in a conservation area

**Sample Dataset:**
```python
df = pd.DataFrame({
    'lat': rng.normal(14.6, 0.05, 200),
    'lon': rng.normal(121.0, 0.05, 200),
    'value': rng.uniform(1, 10, 200)
})  # 200 simulated ride-pickup locations clustered around a city center
```

**Chart Code:**
```python
fig = px.density_map(df, lat='lat', lon='lon', z='value', radius=12,
                      center=dict(lat=df['lat'].mean(), lon=df['lon'].mean()), zoom=8,
                      map_style='open-street-map', title='Density Hotspots')
fig.show()
```

### 25. Flow / line map — 🌐 Plotly

**Description:** Lines drawn between origin and destination coordinates over a map, showing movement or connections between places.

**Purpose:** Use it to visualize routes, migrations, trade, or any origin-destination relationship that a map's geography makes meaningful.

**Common Examples:**
- Shipping routes between ports
- Flight paths between airports
- Migration flows between regions
- Delivery routes from warehouse to customer

**Sample Dataset:**
```python
df = pd.DataFrame({
    'lat': [14.60, 10.72, 14.60, 7.07],
    'lon': [120.98, 122.56, 120.98, 125.61],
    'route_id': ['Manila-Iloilo', 'Manila-Iloilo', 'Manila-Davao', 'Manila-Davao']
})  # two shipping routes, each with origin+destination points
```

**Chart Code:**
```python
fig = px.line_map(df, lat='lat', lon='lon', color='route_id', hover_name='route_id')
fig.update_layout(map_style='open-street-map', title='Routes on Map',
                   map=dict(center=dict(lat=df['lat'].mean(), lon=df['lon'].mean()), zoom=4))
fig.show()
```

### 26. Animated choropleth over time — 🌐 Plotly

**Description:** A choropleth map that steps through a time dimension frame by frame via a play button and slider, showing regional values evolving.

**Purpose:** Use it to show how a geographically-distributed metric changes over multiple periods — much more intuitive than a series of static maps.

**Common Examples:**
- COVID case rates by country, animated month by month
- Unemployment rate by state, animated year by year
- Renewable energy adoption by country, animated over a decade
- Population growth by region, animated over time

**Sample Dataset:**
```python
df = pd.DataFrame({
    'iso_code': ['USA','USA','USA','MEX','MEX','MEX'],
    'value': [10, 12, 15, 8, 9, 11],
    'year': [2021, 2022, 2023, 2021, 2022, 2023]
})  # a metric by country, across 3 years, for animation
```

**Chart Code:**
```python
fig = px.choropleth(df, locations='iso_code', color='value', animation_frame='year',
                     scope='world', color_continuous_scale='Viridis',
                     range_color=[df['value'].min(), df['value'].max()],
                     title='Value by Country Over Time')
fig.show()
```

---

## 🏆 Ranking Charts

Ranking charts compare values and show order.

### 27. Step chart — 🔧 Matplotlib

**Description:** A line chart where values jump at right angles instead of interpolating smoothly — each step represents a discrete change.

**Purpose:** Use it for values that genuinely change at discrete moments rather than continuously — inventory counts, price tiers, on/off states.

**Common Examples:**
- Warehouse inventory level after each shipment/order event
- A subscription tier's price changing at specific renewal dates
- Server count as an autoscaler adds/removes instances
- Elevator floor position over time

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5, 6, 7],
    'y': [500, 500, 420, 420, 420, 610, 610]
})  # warehouse stock level after each event, units
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(8, 5))
ax.step(df['x'], df['y'], where='post', color='#E76F51', linewidth=2.5)
ax.fill_between(df['x'], df['y'], step='post', alpha=0.15, color='#E76F51')
ax.set_title('Step Change Over Time', fontsize=14, fontweight='bold')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.show()
```

### 28. Bar chart (horizontal) — 🌐 Plotly

**Description:** The same idea as a vertical bar chart, rotated 90° so bar length encodes value.

**Purpose:** Use it when category labels are long — horizontal bars keep text readable without rotating or truncating labels.

**Common Examples:**
- Revenue by product name (long product titles)
- Survey responses by full question text
- Page views by article headline
- Budget by department name

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Customer Relationship Management Suite', 'Enterprise Data Warehouse', 'Marketing Automation Platform', 'HR Onboarding System'],
    'value': [212000, 340000, 98000, 61000]
})  # annual software spend ($) by system
```

**Chart Code:**
```python
d = df.sort_values('value')
fig = px.bar(d, x='value', y='category', orientation='h', color='value',
             color_continuous_scale='Teal', text_auto='.2s', template='plotly_white',
             title='Value by Category')
fig.update_traces(textposition='outside')
fig.update_layout(coloraxis_showscale=False)
fig.show()
```

### 29. Pareto chart — 🌐 Plotly

**Description:** Bars sorted from largest to smallest, with a cumulative-percentage line overlaid — reveals which few categories drive most of the total.

**Purpose:** Use it to identify the 'vital few' — the classic 80/20 rule — for prioritizing fixes, features, or focus areas.

**Common Examples:**
- Which defect types cause most of the manufacturing issues
- Which customer complaint categories drive most tickets
- Which products generate most of total revenue
- Which bugs cause most crash reports

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Late Delivery', 'Wrong Item', 'Damaged', 'Billing Error', 'Other'],
    'value': [420, 180, 95, 60, 25]
})  # customer complaint counts by category, most-to-least
```

**Chart Code:**
```python
d = df.sort_values('value', ascending=False)
cum_pct = d['value'].cumsum() / d['value'].sum() * 100
fig = go.Figure()
fig.add_bar(x=d['category'], y=d['value'], name='Value', marker_color='#457B9D')
fig.add_scatter(x=d['category'], y=cum_pct, name='Cumulative %', yaxis='y2',
                mode='lines+markers', marker_color='#E76F51')
fig.add_hline(y=80, line_dash='dash', line_color='gray', yref='y2')
fig.update_layout(template='plotly_white', title='Pareto Analysis',
                   yaxis2=dict(overlaying='y', side='right', range=[0, 100], title='Cumulative %'))
fig.show()
```

### 30. Animated bar chart race — 🌐 Plotly

**Description:** Horizontal bars that reorder and resize themselves frame by frame over time, visually 'racing' as rankings change.

**Purpose:** Use it to dramatize a ranking that changes significantly over a long period — very effective for social-media-style storytelling, less so for precise analysis.

**Common Examples:**
- Top 10 companies by market cap, evolving over decades
- Top-selling music artists by year
- Country population rankings over a century
- Most-used programming languages by year

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['CompanyA','CompanyB','CompanyA','CompanyB'],
    'value': [100, 80, 150, 120],
    'year': [2020, 2020, 2021, 2021]
})  # two companies' rankings across two years
```

**Chart Code:**
```python
fig = px.bar(df, x='value', y='category', color='category', animation_frame='year',
             orientation='h', range_x=[0, df['value'].max() * 1.1],
             template='plotly_white', title='Ranking Over Time')
fig.update_layout(showlegend=False, yaxis={'categoryorder': 'total ascending'})
fig.show()
```

---

## 🌊 Flow Charts

Flow charts show movement and transitions between states or categories.

### 31. Sankey diagram — 🌐 Plotly

**Description:** A flow diagram where link width is proportional to volume, showing how a quantity splits and moves between stages.

**Purpose:** Use it to show how something FLOWS or gets ALLOCATED through a system — energy, budget, traffic, or user journeys with branching paths.

**Common Examples:**
- Energy flow from source to end-use sector
- Budget flow from total revenue to expense categories
- User journey flow from landing page to conversion/exit
- Hiring funnel flow across multiple pipeline stages

**Sample Dataset:**
```python
labels = ['Website Visits', 'Sign Up', 'Bounce', 'Trial', 'Churn', 'Paid']
src = [0, 0, 1, 3, 3]
tgt = [1, 2, 3, 4, 5]
val = [3000, 7000, 3000, 900, 2100]
# nodes: 0=Visits 1=SignUp 2=Bounce 3=Trial 4=Churn 5=Paid
```

**Chart Code:**
```python
fig = go.Figure(go.Sankey(
    node=dict(label=labels, pad=20, thickness=20,
              color=['#264653','#2A9D8F','#E9C46A','#F4A261','#E76F51']),
    link=dict(source=src, target=tgt, value=val, color='rgba(150,150,150,0.4)')
))
fig.update_layout(title='Flow Between Stages', font_size=11)
fig.show()
```

### 32. Quiver plot (vector field) — 🔧 Matplotlib

**Description:** Arrows placed on a grid, each showing the direction and magnitude of a vector at that point.

**Purpose:** Use it whenever your data has both a direction AND a magnitude at each location — forces, gradients, flows.

**Common Examples:**
- Wind direction and speed across a weather grid
- Ocean current direction and strength
- Gradient direction of a loss function during optimization
- Magnetic field direction around a magnet

**Sample Dataset:**
```python
x = np.linspace(-3, 3, 12)
y = np.linspace(-3, 3, 12)
X, Y = np.meshgrid(x, y)
U = -Y  # x-component of the vector field
V = X   # y-component of the vector field (this pair forms a rotational field)
```

**Chart Code:**
```python
magnitude = np.sqrt(U**2 + V**2)
fig, ax = plt.subplots(figsize=(7, 6))
q = ax.quiver(X, Y, U, V, magnitude, cmap='plasma')
fig.colorbar(q, ax=ax, label='magnitude')
ax.set_title('Vector Field', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 33. Streamplot (flow lines) — 🔧 Matplotlib

**Description:** Continuous curved lines tracing the path a particle would follow through a vector field, like a weather map's wind-flow visualization.

**Purpose:** Use it instead of a quiver plot when you want to see the overall FLOW pattern rather than individual arrow vectors — better for dense, continuous fields.

**Common Examples:**
- Wind flow patterns across a weather system
- Fluid flow around an object in a simulation
- Traffic flow direction across a road network grid
- Electric field lines around charged particles

**Sample Dataset:**
```python
x = np.linspace(-3, 3, 30)
y = np.linspace(-3, 3, 30)
X, Y = np.meshgrid(x, y)
U = -Y
V = X  # same rotational vector field, viewed as continuous streamlines
```

**Chart Code:**
```python
speed = np.sqrt(U**2 + V**2)
fig, ax = plt.subplots(figsize=(7, 6))
strm = ax.streamplot(X, Y, U, V, color=speed, linewidth=1.5 * speed / speed.max(), cmap='cool')
fig.colorbar(strm.lines, ax=ax, label='speed')
ax.set_title('Streamlines', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

---

## 📊 Part-to-Whole Charts

Part-to-whole charts emphasize how individual components contribute to a total.

### 34. Stacked bar chart — 🌐 Plotly

**Description:** Subgroup bars stacked on top of each other within each category, so the total bar height shows the grand total.

**Purpose:** Use it to show both the total per category AND how each subgroup contributes to it — best when the total matters as much as the parts.

**Common Examples:**
- Total revenue by quarter, stacked by product line
- Total headcount by department, stacked by seniority level
- Website traffic by day, stacked by acquisition channel
- Election results by district, stacked by party

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Q1', 'Q1', 'Q2', 'Q2', 'Q3', 'Q3'],
    'subgroup': ['Online', 'In-Store', 'Online', 'In-Store', 'Online', 'In-Store'],
    'value': [85, 62, 92, 58, 101, 55]
})  # revenue ($k) by quarter, split by sales channel
```

**Chart Code:**
```python
fig = px.bar(df, x='category', y='value', color='subgroup', barmode='stack',
             template='plotly_white', title='Composition by Category',
             color_discrete_sequence=px.colors.qualitative.Set2)
totals = df.groupby('category')['value'].sum()
for cat, total in totals.items():
    fig.add_annotation(x=cat, y=total, text=f'{total:.0f}', showarrow=False, yshift=12)
fig.show()
```

### 35. Waterfall chart — 🌐 Plotly

**Description:** A running total shown as a sequence of floating bars, each representing a positive or negative contribution to the total.

**Purpose:** Use it to explain HOW a starting value became an ending value through a series of additions and subtractions — the standard chart for financial bridges.

**Common Examples:**
- Revenue bridge: starting revenue → new customers → churn → upsells → ending revenue
- Profit walk: gross profit → costs → tax → net profit
- Headcount bridge: Jan headcount → hires → departures → Dec headcount
- Budget variance: planned budget → overruns → savings → actual spend

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Start', 'New Sales', 'Upsells', 'Churn', 'Refunds', 'End'],
    'value': [100000, 25000, 12000, -18000, -4000, 115000]
})  # revenue bridge ($) from start to end of quarter
```

**Chart Code:**
```python
fig = go.Figure(go.Waterfall(
    x=df['category'], y=df['value'],
    measure=['relative'] * (len(df) - 1) + ['total'],
    increasing=dict(marker_color='#2A9D8F'),
    decreasing=dict(marker_color='#E76F51'),
    totals=dict(marker_color='#264653'),
    connector=dict(line=dict(color='lightgray'))
))
fig.update_layout(template='plotly_white', title='Running Total Breakdown')
fig.show()
```

---

## ⏰ Time Series Charts

Time series charts are specialized for temporal data analysis.

### 36. Simple time series — 🌐 Plotly

**Description:** A single metric plotted against dates or timestamps, showing how it evolves chronologically.

**Purpose:** Use it as the default view for any single metric tracked over time — the most common chart in business reporting.

**Common Examples:**
- Daily active users over the last 90 days
- Monthly recurring revenue over 2 years
- Daily temperature readings for a weather station
- Stock closing price over a trading year

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=30, freq='D'),
    'value': [100,102,99,105,110,108,115,120,118,125,130,128,135,140,138,
              145,150,148,155,160,158,165,170,168,175,180,178,185,190,188]
})  # daily active users over 30 days
```

**Chart Code:**
```python
fig = px.line(df, x='date', y='value', template='plotly_white', title='Value Over Time')
fig.update_traces(line=dict(color='#2E86AB', width=2.5))
fig.update_xaxes(rangeslider_visible=True)
fig.show()
```

### 37. Multi-line time series — 🌐 Plotly

**Description:** Two or more time series plotted on the same axes, letting the viewer compare their trajectories directly.

**Purpose:** Use it whenever you need to compare how multiple related metrics or groups move relative to each other over time.

**Common Examples:**
- Revenue vs. costs over the last 8 quarters
- Website traffic across three marketing channels
- Temperature readings across three sensor locations
- Enrollment trends across three course sections

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': list(pd.date_range('2024-01-01', periods=6, freq='ME')) * 2,
    'value': [40, 45, 42, 50, 55, 53, 30, 33, 31, 38, 41, 40],
    'series': ['Organic'] * 6 + ['Paid'] * 6
})  # monthly traffic (k visits) by acquisition channel
```

**Chart Code:**
```python
fig = px.line(df, x='date', y='value', color='series', template='plotly_white',
              title='Series Comparison Over Time')
fig.update_layout(hovermode='x unified', legend_title_text='Series')
fig.show()
```

### 38. Area-under-line time series — 🌐 Plotly

**Description:** A time series line with the region beneath it filled in, visually emphasizing accumulated volume rather than just the trend.

**Purpose:** Use it when the MAGNITUDE beneath the line matters, not just the direction — e.g. total volume, stock, or accumulated resource.

**Common Examples:**
- Total disk space used over the past year
- Daily energy consumption over a month
- Cumulative rainfall during a storm season
- Server request volume over a week

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=14, freq='D'),
    'value': [200,220,210,250,280,300,290,310,330,320,350,370,360,390]
})  # daily server request volume (thousands) over two weeks
```

**Chart Code:**
```python
fig = px.area(df, x='date', y='value', template='plotly_white', title='Cumulative Volume Over Time')
fig.update_traces(line_color='#264653', fillcolor='rgba(38,70,83,0.3)')
fig.show()
```

### 39. Calendar heatmap — 📊 Seaborn

**Description:** One colored cell per day, laid out exactly like a wall calendar grid, colored by that day's value.

**Purpose:** Use it to spot day-of-week and seasonal patterns at a glance — the classic 'GitHub contributions graph' style view.

**Common Examples:**
- GitHub-style commit activity per day over a year
- Daily gym check-ins over a year
- Daily website traffic patterns by weekday
- Daily sales volume patterns across a quarter

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=90, freq='D'),
    'value': (np.sin(np.arange(90) / 7 * np.pi) * 20 + 30 + rng.normal(0, 3, 90)).round()
})  # 90 days of daily activity counts
```

**Chart Code:**
```python
df['weekday'] = df['date'].dt.weekday
df['week'] = df['date'].dt.isocalendar().week
grid = df.pivot(index='weekday', columns='week', values='value')
fig, ax = plt.subplots(figsize=(14, 3))
sns.heatmap(grid, cmap='YlGnBu', linewidths=1, linecolor='white', cbar_kws={'label': 'value'}, ax=ax)
ax.set_yticklabels(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], rotation=0)
ax.set_title('Calendar Heatmap', fontsize=14, fontweight='bold')
ax.set_xlabel('Week of Year')
plt.tight_layout(); plt.show()
```

### 40. Rolling average overlay — 🌐 Plotly

**Description:** A raw, noisy time series shown alongside a smoothed rolling-average line, making the underlying trend easier to see.

**Purpose:** Use it when the raw data is too noisy to read a trend from directly — the rolling average filters out day-to-day noise.

**Common Examples:**
- 7-day rolling average over daily COVID case counts
- 30-day rolling average over daily stock returns
- Weekly rolling average over daily website conversions
- Rolling average over noisy sensor telemetry

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=30, freq='D'),
    'value': (50 + np.sin(np.arange(30) / 3) * 10 + rng.normal(0, 5, 30)).round()
})  # noisy daily metric, 30 days
```

**Chart Code:**
```python
fig = px.line(df, x='date', y='value', template='plotly_white', title='Raw vs. 7-Day Rolling Average')
fig.update_traces(line=dict(color='lightgray', width=1), name='raw', showlegend=True)
fig.add_scatter(x=df['date'], y=df['value'].rolling(7).mean(),
                name='7-day avg', line=dict(color='#E63946', width=3))
fig.show()
```

### 41. Time series with event annotations — 🌐 Plotly

**Description:** A time series line with specific dates called out directly on the chart via vertical markers and labels.

**Purpose:** Use it to tie a metric's movement to specific known events — launches, outages, campaigns — so the 'why' is visible alongside the 'what'.

**Common Examples:**
- Traffic spike annotated with a product launch date
- Server error rate annotated with a deployment date
- Sales annotated with a marketing campaign start date
- Stock price annotated with an earnings call date

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-05-01', periods=20, freq='D'),
    'value': [50,52,49,53,55,54,90,95,92,88,85,83,80,78,76,75,74,73,72,71]
})  # daily signups around a product launch on day 7
```

**Chart Code:**
```python
fig = px.line(df, x='date', y='value', template='plotly_white', title='Value Over Time with Key Events')
fig.update_traces(line=dict(color='#457B9D', width=2))
fig.add_vline(x='2024-06-01', line_dash='dash', line_color='gray',
              annotation_text='Launch', annotation_position='top')
fig.show()
```

### 42. Range slider + selector buttons — 🌐 Plotly

**Description:** A full time series shown with an interactive slider and preset zoom buttons (1W/1M/1Y/All) to quickly change the visible window.

**Purpose:** Use it for long time series in a dashboard where users need to explore different time windows themselves without you pre-building separate charts.

**Common Examples:**
- Stock price chart where users pick 1D/1W/1M/1Y views
- Server metrics dashboard with adjustable time windows
- Multi-year sales trend explorer
- IoT sensor history with a scrubbable range

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2022-01-01', periods=730, freq='D'),
    'value': (100 + np.cumsum(rng.normal(0.1, 2, 730))).round(2)
})  # 2 years of daily data for interactive range exploration
```

**Chart Code:**
```python
fig = px.line(df, x='date', y='value', template='plotly_white', title='Value Over Time')
fig.update_xaxes(
    rangeslider_visible=True,
    rangeselector=dict(buttons=[
        dict(count=1, label='1m', step='month', stepmode='backward'),
        dict(count=6, label='6m', step='month', stepmode='backward'),
        dict(count=1, label='1y', step='year', stepmode='backward'),
        dict(step='all')
    ])
)
fig.show()
```

### 43. Seasonal decomposition plot — 🔧 Matplotlib

**Description:** A time series split into three stacked subplots: the long-term trend, the repeating seasonal pattern, and the leftover residual noise.

**Purpose:** Use it to understand WHAT is driving a time series' movement — pure trend, a recurring seasonal cycle, or unexplained noise — before forecasting.

**Common Examples:**
- Decomposing monthly retail sales into trend and holiday seasonality
- Decomposing electricity demand into trend and daily/seasonal cycles
- Decomposing airline passenger counts into trend and yearly seasonality
- Decomposing website traffic into trend and weekly seasonality

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2020-01-01', periods=48, freq='ME'),
    'value': (100 + np.arange(48) * 2 + np.tile([10,5,-5,-10,-5,5,10,15,5,-5,-10,-15], 4) + rng.normal(0, 3, 48))
})  # 4 years of monthly sales with trend + seasonality
```

**Chart Code:**
```python
from statsmodels.tsa.seasonal import seasonal_decompose
result = seasonal_decompose(df.set_index('date')['value'], period=12, model='additive')
fig = result.plot()
fig.set_size_inches(9, 7)
fig.suptitle('Seasonal Decomposition', fontsize=14, fontweight='bold', y=1.02)
plt.tight_layout(); plt.show()
```

### 44. Cumulative sum chart — 🌐 Plotly

**Description:** A time series showing the running total of a metric, always non-decreasing (if values are positive) — highlights accumulated progress.

**Purpose:** Use it to show progress toward a goal or accumulated total over time, rather than the period-by-period value itself.

**Common Examples:**
- Cumulative fundraising progress toward a campaign goal
- Cumulative new users acquired since launch
- Cumulative revenue booked toward an annual target
- Cumulative distance run toward a fitness goal

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=14, freq='D'),
    'value': [500, 620, 480, 700, 650, 800, 750, 900, 850, 950, 1000, 880, 1100, 1050]
})  # daily fundraising amount ($), to be cumulatively summed
```

**Chart Code:**
```python
cum = df['value'].cumsum()
fig = px.area(df, x='date', y=cum, template='plotly_white', title='Cumulative Progress')
fig.update_traces(line_color='#2A9D8F', fillcolor='rgba(42,157,143,0.25)')
fig.add_annotation(x=df['date'].iloc[-1], y=cum.iloc[-1], text=f'Total: {cum.iloc[-1]:.0f}',
                    showarrow=True, arrowhead=2)
fig.show()
```

### 45. Range selector buttons — 🌐 Plotly

**Description:** Preset zoom buttons (1W/1M/1Y/All) placed above a time series, letting the viewer instantly change the visible time window.

**Purpose:** Use it for financial or operational time series dashboards where users routinely want to compare 'the last week' vs. 'the last year' at a click.

**Common Examples:**
- Stock price chart with 1D/1W/1M/1Y buttons
- Website traffic dashboard with quick date-range buttons
- Server uptime chart with preset time windows
- Sales dashboard with quarter/year-to-date buttons

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2023-01-01', periods=60, freq='D'),
    'value': (100 + np.cumsum(rng.normal(0.2, 3, 60))).round(2)
})  # 60 days of data for quick-range button navigation
```

**Chart Code:**
```python
fig = px.line(df, x='date', y='value', template='plotly_white', title='Value Over Time')
fig.update_xaxes(rangeselector=dict(buttons=[
    dict(count=7, label='1w', step='day', stepmode='backward'),
    dict(count=1, label='1m', step='month', stepmode='backward'),
    dict(step='all')
]))
fig.show()
```

### 46. Gantt chart — 🌐 Plotly

**Description:** A horizontal bar per task, positioned and sized by its start and end dates, showing a project schedule at a glance.

**Purpose:** Use it for project planning and tracking — the standard chart for 'what's happening when' across multiple tasks or workstreams.

**Common Examples:**
- Software sprint plan with task start/end dates
- Construction project timeline by phase
- Marketing campaign schedule across channels
- Event planning timeline across vendors/tasks

**Sample Dataset:**
```python
df = pd.DataFrame({
    'task': ['Design', 'Development', 'Testing', 'Launch'],
    'start': pd.to_datetime(['2024-01-01', '2024-01-15', '2024-02-10', '2024-02-25']),
    'end':   pd.to_datetime(['2024-01-14', '2024-02-09', '2024-02-24', '2024-03-01']),
    'status': ['Done', 'Done', 'In Progress', 'Blocked']
})  # a 4-phase project schedule with status
```

**Chart Code:**
```python
fig = px.timeline(df, x_start='start', x_end='end', y='task', color='status',
                   template='plotly_white', title='Project Timeline',
                   color_discrete_map={'Done': '#2A9D8F', 'In Progress': '#E9C46A', 'Blocked': '#E76F51'})
fig.update_yaxes(autorange='reversed')
fig.show()
```

---

## 🔗 Correlation Charts

Correlation charts reveal relationships and dependencies between variables.

### 47. Correlation heatmap — 📊 Seaborn

**Description:** A color-coded grid of pairwise correlation coefficients between numeric columns, red/blue indicating positive/negative correlation.

**Purpose:** Use it to quickly scan for strong relationships (or multicollinearity) across many numeric variables at once — a staple before feature selection.

**Common Examples:**
- Checking multicollinearity between features before a regression model
- Reviewing which financial metrics move together in a portfolio
- Reviewing which survey questions correlate before factor analysis
- Checking which marketing channels' spend correlates with each other

**Sample Dataset:**
```python
df = pd.DataFrame({
    'revenue': [100, 120, 90, 140, 130, 110],
    'ad_spend': [10, 15, 8, 18, 16, 12],
    'temperature': [72, 68, 75, 70, 71, 74],
    'headcount': [5, 6, 5, 7, 6, 6]
})  # weekly business metrics to check for correlation
```

**Chart Code:**
```python
sns.set_theme(style='white')
corr = df.corr(numeric_only=True)
mask = np.triu(np.ones_like(corr, dtype=bool))
fig, ax = plt.subplots(figsize=(8, 7))
sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='coolwarm', center=0,
            square=True, linewidths=0.5, cbar_kws={'shrink': 0.8}, ax=ax)
ax.set_title('Correlation Matrix', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 48. Correlogram (annotated pair grid) — 📊 Seaborn

**Description:** A pair plot where the upper triangle shows the exact correlation coefficient as text instead of a duplicate scatter plot.

**Purpose:** Use it instead of a full pair plot when you want scatter/histograms on one side but the exact correlation numbers (not more plots) on the other.

**Common Examples:**
- Exploring feature correlations before feature selection in modeling
- Reviewing financial ratio correlations for a screener
- Checking survey question correlations before combining into an index
- Validating sensor channel correlations before dimensionality reduction

**Sample Dataset:**
```python
df = pd.DataFrame({
    'a': [1, 2, 3, 4, 5, 6, 7, 8],
    'b': [2, 3, 5, 4, 6, 8, 7, 9],
    'c': [8, 7, 6, 5, 4, 3, 2, 1]
})  # three numeric features with varying correlation strength
```

**Chart Code:**
```python
def corr_text(x, y, **kwargs):
    r = np.corrcoef(x, y)[0, 1]
    ax = plt.gca()
    ax.annotate(f'r = {r:.2f}', xy=(0.5, 0.5), xycoords='axes fraction',
                ha='center', fontsize=12, fontweight='bold')
    ax.set_axis_off()

g = sns.PairGrid(df, height=2)
g.map_lower(sns.scatterplot, alpha=0.6, color='#2E86AB')
g.map_diag(sns.histplot, color='#457B9D')
g.map_upper(corr_text)
g.figure.suptitle('Correlogram', y=1.02, fontsize=14, fontweight='bold')
plt.show()
```

---

## 🕸️ Network Charts

Network charts visualize connections and relationships between entities.

### 49. Network / graph diagram — 🔧 Matplotlib

**Description:** Circles (nodes) connected by lines (edges), representing entities and the relationships between them.

**Purpose:** Use it whenever the RELATIONSHIPS between entities are the point, not just their individual values — social graphs, dependencies, org structures.

**Common Examples:**
- Social network of who follows whom
- Microservice dependency graph in a software system
- Co-authorship network among researchers
- Organizational reporting structure

**Sample Dataset:**
```python
df = pd.DataFrame({
    'source': ['Alice','Alice','Bob','Bob','Carol','Dave'],
    'target': ['Bob','Carol','Carol','Dave','Dave','Alice']
})  # who-connects-to-whom edge list
```

**Chart Code:**
```python
import networkx as nx
G = nx.from_pandas_edgelist(df, 'source', 'target')
degrees = dict(G.degree())
fig, ax = plt.subplots(figsize=(8, 8))
pos = nx.spring_layout(G, seed=42)
nx.draw_networkx_nodes(G, pos, node_size=[v * 200 for v in degrees.values()],
                        node_color=list(degrees.values()), cmap='viridis', ax=ax)
nx.draw_networkx_edges(G, pos, alpha=0.3, ax=ax)
nx.draw_networkx_labels(G, pos, font_size=9, ax=ax)
ax.set_title('Network Graph (node size = connections)', fontsize=14, fontweight='bold')
ax.axis('off')
plt.tight_layout(); plt.show()
```

---

## 📊 Multivariate Charts

Multivariate charts handle multiple variables simultaneously.

### 50. Bubble scatter (3 numeric dims) — 🌐 Plotly

**Description:** A scatter plot where a 3rd numeric variable is encoded by marker size and a 4th by color, packing 4 dimensions into 2D.

**Purpose:** Use it when a plain scatter or even a size-only bubble chart still isn't enough — you need to compare 3-4 numeric variables at once.

**Common Examples:**
- Deal size vs. sales cycle length, sized by probability, colored by stage
- R&D spend vs. revenue, sized by headcount, colored by margin
- Risk vs. return, sized by position size, colored by sector
- Load time vs. bounce rate, sized by traffic, colored by page type

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [5, 10, 15, 20, 25, 30],
    'y': [2, 5, 4, 9, 7, 12],
    'size': [50, 120, 80, 200, 150, 300],
    'color_val': [1.2, 2.1, 1.8, 3.5, 2.9, 4.0]
})  # deal size ($k) vs. cycle length (days), sized/colored by extra metrics
```

**Chart Code:**
```python
fig = px.scatter(df, x='x', y='y', size='size', color='color_val',
                  color_continuous_scale='Plasma', size_max=40,
                  template='plotly_white', title='Four-Variable Scatter (x, y, size, color)')
fig.show()
```

### 51. Parallel coordinates plot — 🌐 Plotly

**Description:** Each row of data drawn as a connected line crossing several parallel vertical axes, one per numeric column.

**Purpose:** Use it to compare many rows across MANY numeric dimensions at once — good for spotting clusters or outlier profiles across features.

**Common Examples:**
- Comparing car models across mpg, horsepower, weight, and price
- Comparing job candidates across multiple interview scores
- Comparing wine samples across acidity, sugar, alcohol, and quality
- Comparing investment funds across return, risk, and fees

**Sample Dataset:**
```python
df = pd.DataFrame({
    'a': [3.1, 5.2, 2.8, 6.0],
    'b': [7.0, 4.5, 8.1, 3.2],
    'c': [12, 18, 10, 22],
    'd': [1.5, 2.8, 1.1, 3.4],
    'category_code': [0, 1, 0, 1]
})  # four numeric metrics per row, colored by class
```

**Chart Code:**
```python
fig = px.parallel_coordinates(
    df, dimensions=['a', 'b', 'c', 'd'], color='category_code',
    color_continuous_scale=px.colors.diverging.Tealrose, title='Parallel Coordinates'
)
fig.show()
```

### 52. Andrews curves — 🔧 Matplotlib

**Description:** Each row of data transformed into a smooth curve using a Fourier-like series — rows with similar values produce visually similar curves.

**Purpose:** Use it as an alternative way to spot clustering or class separation across many numeric features, when a pair plot has too many pairs to scan.

**Common Examples:**
- Checking if flower species separate cleanly on their measurements
- Checking if fraud vs. legitimate transactions form distinct curve bands
- Checking if customer segments separate on behavioral features
- Checking if quality-control samples cluster by pass/fail

**Sample Dataset:**
```python
df = pd.DataFrame({
    'a': [1.1, 1.3, 1.2, 5.5, 5.7, 5.6],
    'b': [2.1, 2.3, 2.0, 6.1, 6.3, 6.0],
    'c': [0.5, 0.6, 0.4, 3.1, 3.3, 3.0],
    'category': ['Pass','Pass','Pass','Fail','Fail','Fail']
})  # QC measurements for pass/fail samples
```

**Chart Code:**
```python
from pandas.plotting import andrews_curves
fig, ax = plt.subplots(figsize=(8, 6))
andrews_curves(df, 'category', ax=ax, colormap='viridis')
ax.set_title('Andrews Curves by Category', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 53. RadViz — 🔧 Matplotlib

**Description:** Points arranged inside a circle, pulled toward anchor points around the edge (one per numeric column) based on their values.

**Purpose:** Use it as another multi-dimensional clustering visualization — complementary to Andrews curves, useful for spotting which features drive separation.

**Common Examples:**
- Visualizing whether wine samples separate by quality rating
- Visualizing whether loan applicants separate by default risk
- Visualizing whether patients separate by diagnosis category
- Visualizing whether customer segments separate by spend pattern

**Sample Dataset:**
```python
df = pd.DataFrame({
    'a': [1.1, 1.3, 1.2, 5.5, 5.7, 5.6],
    'b': [2.1, 2.3, 2.0, 6.1, 6.3, 6.0],
    'c': [0.5, 0.6, 0.4, 3.1, 3.3, 3.0],
    'category': ['LowRisk','LowRisk','LowRisk','HighRisk','HighRisk','HighRisk']
})  # loan applicant features by risk category
```

**Chart Code:**
```python
from pandas.plotting import radviz
fig, ax = plt.subplots(figsize=(7, 7))
radviz(df, 'category', ax=ax, colormap='Set2')
ax.set_title('RadViz Projection', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 54. 3D scatter plot — 🌐 Plotly

**Description:** Individual points positioned in three-dimensional space (x, y, z), freely rotatable to inspect from any angle.

**Purpose:** Use it when a relationship genuinely needs a 3rd numeric axis rather than encoding it as size/color — true when the 3rd dimension IS spatial or when rotation adds real insight.

**Common Examples:**
- Physical position tracking (x, y, z coordinates) of a sensor or drone
- Three correlated chemical concentrations in a lab sample
- PCA-reduced customer segments across the top 3 components
- Molecular structure atom positions

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5, 6],
    'y': [2, 3, 1, 5, 4, 6],
    'z': [3, 1, 4, 2, 6, 5],
    'category': ['A','A','A','B','B','B']
})  # 6 points in 3D space, two classes
```

**Chart Code:**
```python
fig = px.scatter_3d(df, x='x', y='y', z='z', color='category', size_max=10,
                     template='plotly_white', title='3D Scatter')
fig.update_traces(marker=dict(size=4, opacity=0.8))
fig.show()
```

### 55. Annotated heatmap — 📊 Seaborn

**Description:** A color-coded grid with the exact numeric value printed inside each cell, combining visual pattern with precise readability.

**Purpose:** Use it whenever the audience needs BOTH the color pattern AND the exact number — plain color-only heatmaps force guessing at precise values.

**Common Examples:**
- Confusion matrix for a classification model, with counts shown
- Correlation matrix with coefficients printed
- Sales by month and region, with dollar values shown
- Test scores by student and subject, with grades shown

**Sample Dataset:**
```python
df = pd.DataFrame(
    [[45, 3], [5, 47]],
    index=['Actual: No', 'Actual: Yes'],
    columns=['Predicted: No', 'Predicted: Yes']
)  # a small confusion matrix (already a numeric matrix)
```

**Chart Code:**
```python
# df here is a numeric matrix (e.g. a pivot table or df.corr()), not raw records
fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(df, annot=True, fmt='.1f', cmap='YlGnBu', linewidths=0.5,
            cbar_kws={'label': 'value'}, ax=ax)
ax.set_title('Annotated Heatmap', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 56. Radar / spider chart — 🌐 Plotly

**Description:** Multiple metrics for one or more entities plotted around a circle, one axis per metric, connected into a shape.

**Purpose:** Use it to compare multi-attribute PROFILES between a few entities — instantly shows relative strengths/weaknesses across dimensions.

**Common Examples:**
- Comparing job candidates across multiple skill dimensions
- Comparing product models across spec categories
- Comparing sports players across performance attributes
- Comparing team capability across competency areas

**Sample Dataset:**
```python
df = pd.DataFrame({
    'entity': ['Candidate A', 'Candidate B'],
    'Speed': [8, 6], 'Reliability': [7, 9], 'Comfort': [6, 8],
    'Efficiency': [9, 7], 'Safety': [8, 8]
})  # two candidates scored across five attributes (1-10)
```

**Chart Code:**
```python
categories = ['Speed', 'Reliability', 'Comfort', 'Efficiency', 'Safety']
fig = go.Figure()
for _, row in df.iterrows():
    fig.add_scatterpolar(r=row[categories].values, theta=categories,
                          fill='toself', name=row['entity'], opacity=0.6)
fig.update_layout(template='plotly_white', title='Profile Comparison',
                   polar=dict(radialaxis=dict(visible=True, range=[0, 10])))
fig.show()
```

---

## 🏗️ Structural Charts

Structural charts show organizational and logical relationships.

### 57. 3D surface plot — 🌐 Plotly

**Description:** A continuous surface where height (z) is a function of two inputs (x, y), rendered as a shaded 3D landscape.

**Purpose:** Use it to visualize how an output varies across a 2D grid of inputs — e.g. a cost function, terrain, or any z = f(x, y) relationship.

**Common Examples:**
- Terrain elevation across a geographic grid
- Loss function landscape during model training
- Option pricing surface (strike price vs. time to expiry)
- Temperature distribution across a heated metal plate

**Sample Dataset:**
```python
x = np.linspace(-3, 3, 30)
y = np.linspace(-3, 3, 30)
X, Y = np.meshgrid(x, y)
Z = np.sin(np.sqrt(X**2 + Y**2))  # a simple 'ripple' surface for demonstration
```

**Chart Code:**
```python
fig = go.Figure(go.Surface(z=Z, x=X, y=Y, colorscale='Viridis'))
fig.update_layout(title='3D Surface', scene=dict(xaxis_title='x', yaxis_title='y', zaxis_title='z'))
fig.show()
```

---

## 🎨 Qualitative Charts

Qualitative charts visualize concepts and strategies.

### 58. Mind Map — 🔧 Matplotlib

**Description:** A central idea in the middle with related sub-ideas branching outward as connected nodes, radiating like a web.

**Purpose:** Use it to brainstorm and visually organize how ideas relate to a central concept before structuring them into something more formal.

**Common Examples:**
- Brainstorming session output for a new product idea
- Structuring the outline of a report or presentation
- Mapping out a project's key workstreams around one goal
- Visualizing how topics in a course relate to a core subject

**Sample Dataset:**
```python
df = pd.DataFrame({
    'branch': ['Branch 1', 'Branch 2', 'Branch 3', 'Branch 4'],
    'x': [0.3, 0.7, 0.3, 0.7],
    'y': [0.7, 0.7, 0.3, 0.3]
})  # four sub-ideas positioned around a central concept
```

**Chart Code:**
```python
import matplotlib.patches as mpatches

fig, ax = plt.subplots(figsize=(10, 8))
center = (0.5, 0.5)
ax.add_patch(mpatches.Circle(center, 0.08, color='#E63946'))
ax.text(center[0], center[1], 'Main\nIdea', ha='center', va='center',
        fontsize=12, fontweight='bold', color='white')

for _, row in df.iterrows():
    ax.plot([center[0], row['x']], [center[1], row['y']], 'k-', linewidth=3)
    ax.add_patch(mpatches.Circle((row['x'], row['y']), 0.06, color='#457B9D'))
    ax.text(row['x'], row['y'], row['branch'], ha='center', va='center',
            fontsize=10, fontweight='bold', color='white')

ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
plt.title('Mind Map: Idea Radiating from a Core Concept', fontsize=15, fontweight='bold', pad=20)
plt.tight_layout(); plt.show()
```

### 59. SWOT Analysis — 🔧 Matplotlib

**Description:** A four-quadrant grid — Strengths, Weaknesses, Opportunities, Threats — used as a strategic planning framework.

**Purpose:** Use it to structure a strategic review of internal factors (strengths/weaknesses) against external factors (opportunities/threats) in one glance.

**Common Examples:**
- Strategic planning session for a business unit
- Competitive positioning review before a product launch
- Startup pitch deck's market-position slide
- Personal or team career-planning exercise

**Sample Dataset:**
```python
df = pd.DataFrame({
    'quadrant': ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
    'x': [0.25, 0.75, 0.25, 0.75],
    'y': [0.75, 0.75, 0.25, 0.25],
    'color': ['#2A9D8F', '#E76F51', '#F4A261', '#E63946']
})  # the four SWOT quadrants and their grid positions
```

**Chart Code:**
```python
import matplotlib.patches as mpatches

fig, ax = plt.subplots(figsize=(9, 9))
for _, row in df.iterrows():
    rect = mpatches.Rectangle(
        (row['x']-0.23, row['y']-0.23), 0.46, 0.46,
        edgecolor='black', facecolor=row['color'], alpha=0.6, linewidth=3)
    ax.add_patch(rect)
    ax.text(row['x'], row['y']+0.18, row['quadrant'], ha='center', va='center',
            fontsize=15, fontweight='bold')

ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
plt.title('SWOT Analysis', fontsize=17, fontweight='bold', pad=20)
plt.tight_layout(); plt.show()
```

### 60. Journey Map — 🔧 Matplotlib

**Description:** A line tracking a satisfaction or effort score across sequential stages of a customer's (or user's) experience.

**Purpose:** Use it to spot exactly where in an experience satisfaction rises or drops, so effort can be targeted at the weakest stage.

**Common Examples:**
- Customer satisfaction across awareness-to-advocacy funnel stages
- Employee onboarding experience across their first 90 days
- Patient experience across a hospital visit's stages
- User experience across an app's signup-to-activation flow

**Sample Dataset:**
```python
df = pd.DataFrame({
    'stage': ['Awareness', 'Consideration', 'Purchase', 'Retention', 'Advocacy'],
    'satisfaction': [6, 5, 8, 7, 9]
})  # satisfaction score (1-10) at each customer journey stage
```

**Chart Code:**
```python
x = np.arange(len(df))
fig, ax = plt.subplots(figsize=(12, 5))
ax.plot(x, df['satisfaction'], marker='o', markersize=15, linewidth=3, color='#457B9D')

for i, sat in enumerate(df['satisfaction']):
    ax.annotate(f'{sat}/10', xy=(i, sat), xytext=(0, 10),
                textcoords='offset points', ha='center', fontweight='bold')

ax.set_xticks(x); ax.set_xticklabels(df['stage'], fontsize=11)
ax.set_ylabel('Satisfaction'); ax.set_ylim(0, 10)
ax.set_title('Customer Journey Map', fontsize=15, fontweight='bold')
ax.grid(axis='y', alpha=0.3)
plt.tight_layout(); plt.show()
```

---

## 📏 Gauge Indicators

Gauge indicators show progress or performance against targets.

### 61. Gauge / indicator chart — 🌐 Plotly

**Description:** A single KPI shown as a dial or number against target thresholds, often with a delta showing change from a prior period.

**Purpose:** Use it for a single, critical, at-a-glance metric on a dashboard — not for comparing multiple values, just for 'how are we doing right now'.

**Common Examples:**
- Current server CPU utilization vs. a warning threshold
- Current sales vs. this quarter's target
- Current customer satisfaction score vs. goal
- Current project completion percentage

**Sample Dataset:**
```python
df = pd.DataFrame({
    'value': [72, 68]
})  # current KPI value and the prior period's value (for delta)
```

**Chart Code:**
```python
fig = go.Figure(go.Indicator(
    mode='gauge+number+delta',
    value=df['value'].iloc[-1],
    delta={'reference': df['value'].iloc[-2]},
    gauge={'axis': {'range': [0, 100]},
           'bar': {'color': '#2A9D8F'},
           'steps': [{'range': [0, 50], 'color': '#F4A261'},
                     {'range': [50, 100], 'color': '#E9C46A'}],
           'threshold': {'line': {'color': 'red', 'width': 4}, 'value': 90}},
    title={'text': 'KPI Gauge'}
))
fig.show()
```

---

## 🚨 Anomaly Detection Charts

Anomaly detection charts identify outliers and unusual patterns.

### 62. Control chart / run chart — 🔧 Matplotlib

**Description:** Time-ordered values plotted with a center line (mean) and upper/lower control limits, flagging points outside expected variation.

**Purpose:** Use it in process monitoring to distinguish normal variation from a genuine process shift that needs investigation — a core Six Sigma/manufacturing QA tool.

**Common Examples:**
- Manufacturing process measurements over shifts
- Server error rate monitoring over time
- Daily call center wait times
- Lab test result consistency monitoring

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': list(range(1, 16)),
    'value': [50,51,49,52,50,48,51,50,49,52,65,50,51,49,50]
})  # process measurements with one out-of-control spike at x=11
```

**Chart Code:**
```python
mean, std = df['value'].mean(), df['value'].std()
ucl, lcl = mean + 3*std, mean - 3*std
fig, ax = plt.subplots(figsize=(9, 5))
ax.plot(df['x'], df['value'], marker='o', color='#264653', markersize=4)
ax.axhline(mean, color='green', label='Mean')
ax.axhline(ucl, color='red', linestyle='--', label='UCL (+3σ)')
ax.axhline(lcl, color='red', linestyle='--', label='LCL (-3σ)')
out = df[(df['value'] > ucl) | (df['value'] < lcl)]
ax.scatter(out['x'], out['value'], color='red', s=80, zorder=3, label='Out of control')
ax.legend()
ax.set_title('Control Chart', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

---

## 🎯 Behavioral Charts

Behavioral charts track user behavior and conversion funnels.

### 63. Funnel chart — 🌐 Plotly

**Description:** A sequence of shrinking bars showing how a population narrows down through sequential stages.

**Purpose:** Use it to visualize drop-off through a multi-stage process — the standard chart for conversion/sales funnels.

**Common Examples:**
- Website visitors → sign-ups → trial users → paying customers
- Job applicants → phone screens → interviews → offers → hires
- Leads → qualified leads → proposals sent → deals closed
- Ad impressions → clicks → add-to-cart → purchases

**Sample Dataset:**
```python
df = pd.DataFrame({
    'stage': ['Visitors', 'Sign-ups', 'Trial Users', 'Paying Customers'],
    'value': [10000, 2500, 900, 320]
})  # user counts through a SaaS conversion funnel
```

**Chart Code:**
```python
fig = px.funnel(df, x='value', y='stage', template='plotly_white',
                 title='Conversion Funnel', color_discrete_sequence=['#2E86AB'])
fig.update_traces(textinfo='value+percent previous')
fig.show()
```

---

## 📝 Text Analysis Charts

Text analysis charts visualize textual and language data.

### 64. Word cloud — 🔧 Matplotlib

**Description:** Words sized by how frequently they appear in a body of text, packed together into a visually dense cloud.

**Purpose:** Use it as a very quick, low-rigor first look at what topics/terms dominate a body of text — not for precise analysis, but great for a fast gut-check.

**Common Examples:**
- Most common words in customer feedback
- Most common terms in job postings for a role
- Most frequent words in a speech or article
- Most common tags/keywords across a content library

**Sample Dataset:**
```python
df = pd.DataFrame({
    'text': [
        'great product fast shipping excellent support',
        'shipping was slow but product quality is great',
        'excellent customer support very fast response',
        'product quality great value fast delivery'
    ]
})  # customer feedback snippets to extract word frequency from
```

**Chart Code:**
```python
from wordcloud import WordCloud
text = ' '.join(df['text'].dropna())
wc = WordCloud(width=900, height=500, background_color='white', colormap='viridis').generate(text)
fig, ax = plt.subplots(figsize=(10, 6))
ax.imshow(wc, interpolation='bilinear')
ax.axis('off')
ax.set_title('Word Frequency Cloud', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

---

## 📋 Text-Based Charts

Text-based charts present data in tabular or annotated formats.

### 65. Interactive data table — 🌐 Plotly

**Description:** A sortable, scrollable table rendered as a chart-like object, letting users browse exact values rather than a visual summary.

**Purpose:** Use it when the audience needs to inspect exact raw values, not a visual pattern — pairs well alongside a chart as a drill-down detail view.

**Common Examples:**
- Raw transaction list backing a summary sales chart
- Detailed leaderboard standings behind a bar chart
- Full survey response list behind an aggregate chart
- Order detail list behind a revenue dashboard

**Sample Dataset:**
```python
df = pd.DataFrame({
    'Order ID': ['A1001', 'A1002', 'A1003'],
    'Customer': ['J. Cruz', 'M. Santos', 'A. Reyes'],
    'Amount': [1250, 890, 2100]
})  # raw order records for a drill-down table
```

**Chart Code:**
```python
fig = go.Figure(go.Table(
    header=dict(values=list(df.columns), fill_color='#264653', font=dict(color='white'), align='left'),
    cells=dict(values=[df[c] for c in df.columns], fill_color='lavender', align='left')
))
fig.update_layout(title='Interactive Data Table')
fig.show()
```

### 66. Custom hover tooltips — 🌐 Plotly

**Description:** A chart where the hover tooltip's content and format are fully customized, rather than showing raw default x/y values.

**Purpose:** Use it whenever the default hover tooltip doesn't tell the reader enough — add context, formatting, or extra fields relevant to that specific point.

**Common Examples:**
- Showing a customer's full profile on hovering their data point
- Showing formatted currency and % change on a sales chart
- Showing a product's name and category on a scatter point
- Showing a date-formatted, human-readable label instead of raw ISO timestamps

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1, 2, 3, 4],
    'y': [10, 15, 12, 20],
    'category': ['Electronics', 'Apparel', 'Home', 'Toys'],
    'notes': ['Best seller', 'Seasonal item', 'Steady demand', 'New launch']
})  # points with extra context fields for a rich hover tooltip
```

**Chart Code:**
```python
fig = px.scatter(df, x='x', y='y', color='category', hover_data=['category', 'notes'])
fig.update_traces(
    hovertemplate='<b>%{customdata[0]}</b><br>x: %{x:.1f}<br>y: %{y:.1f}<br>%{customdata[1]}<extra></extra>'
)
fig.update_layout(template='plotly_white', title='Custom Hover Detail')
fig.show()
```

---

## ↔️ Deviation Charts

Deviation charts show variance from a reference point.

### 67. Diverging bar chart — 🌐 Plotly

**Description:** Bars extending left or right from a central zero line, colored by sign, showing positive vs. negative values at a glance.

**Purpose:** Use it whenever the sign of a change matters as much as its size — survey net scores, budget variances, profit/loss by segment.

**Common Examples:**
- Net Promoter Score components (promoters minus detractors) by segment
- Budget variance (over/under) by department
- Year-over-year growth/decline by product line
- Sentiment score (positive minus negative) by topic

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Product A', 'Product B', 'Product C', 'Product D'],
    'value': [12.5, -6.2, 8.0, -3.1]
})  # year-over-year growth (%) by product line
```

**Chart Code:**
```python
d = df.sort_values('value')
fig = px.bar(d, x='value', y='category', orientation='h',
             color=d['value'] > 0, color_discrete_map={True: '#2A9D8F', False: '#E76F51'},
             template='plotly_white', title='Change by Category')
fig.update_layout(showlegend=False)
fig.add_vline(x=0, line_color='black', line_width=1)
fig.show()
```

---

## 💹 Financial Charts

Financial charts are specialized for market and trading data.

### 68. Candlestick / OHLC chart — 🌐 Plotly

**Description:** Each period shown as a box-and-whisker of open/high/low/close prices, colored by whether the period closed up or down.

**Purpose:** Use it for financial price data where the range and direction of movement within each period matters, not just the closing value.

**Common Examples:**
- Daily stock price movement for a ticker
- Hourly cryptocurrency price action
- Weekly commodity futures pricing
- Daily forex exchange rate movement

**Sample Dataset:**
```python
df = pd.DataFrame({
    'date': pd.date_range('2024-01-01', periods=8, freq='D'),
    'open':  [100, 103, 101, 106, 108, 105, 110, 112],
    'high':  [104, 105, 107, 109, 111, 109, 114, 115],
    'low':   [99, 100, 100, 104, 104, 103, 108, 110],
    'close': [103, 101, 106, 108, 105, 110, 112, 113]
})  # daily OHLC stock price data
```

**Chart Code:**
```python
fig = go.Figure(go.Candlestick(
    x=df['date'], open=df['open'], high=df['high'], low=df['low'], close=df['close'],
    increasing_line_color='#2A9D8F', decreasing_line_color='#E76F51'
))
fig.update_layout(template='plotly_white', title='Price Action', xaxis_rangeslider_visible=True)
fig.show()
```

---

## 🔷 Concept Charts

Concept charts illustrate ideas and processes visually.

### 69. Fishbone Diagram (Ishikawa) — 🔧 Matplotlib

**Description:** A spine leading to an effect, with cause categories branching off it at angles like the bones of a fish.

**Purpose:** Use it for structured root-cause analysis — grouping every possible cause of a problem into categories before drilling into each.

**Common Examples:**
- Root-cause analysis of a manufacturing defect
- Investigating a recurring service-quality complaint
- Diagnosing why a software deployment failed
- Analyzing causes behind a drop in customer retention

**Sample Dataset:**
```python
df = pd.DataFrame({
    'cause': ['People', 'Process', 'Materials', 'Equipment'],
    'y_pos': [0.7, 0.8, 0.3, 0.2]
})  # cause categories and their branch position above/below the spine
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(13, 7))
ax.plot([0, 1], [0.5, 0.5], 'k-', linewidth=3)
ax.plot([1, 1.1], [0.5, 0.5], 'k-', linewidth=3)
ax.text(1.12, 0.5, 'Effect', fontsize=13, fontweight='bold', va='center')

for i, row in df.iterrows():
    xi = 0.2 + i * 0.2
    if row['y_pos'] > 0.5:
        ax.plot([xi, xi + 0.1], [0.5, row['y_pos']], 'k-', linewidth=2)
        ax.text(xi + 0.1, row['y_pos'] + 0.05, row['cause'], fontsize=11, fontweight='bold')
    else:
        ax.plot([xi, xi + 0.1], [0.5, row['y_pos']], 'k-', linewidth=2)
        ax.text(xi + 0.1, row['y_pos'] - 0.05, row['cause'], fontsize=11, fontweight='bold', va='top')

ax.set_xlim(0, 1.2); ax.set_ylim(0, 1); ax.axis('off')
plt.title('Fishbone Diagram: Root Cause Analysis', fontsize=15, fontweight='bold', pad=20)
plt.tight_layout(); plt.show()
```

### 70. Pyramid Diagram — 🔧 Matplotlib

**Description:** Stacked, progressively wider bands from top to bottom, showing a hierarchy where each level supports the one above it.

**Purpose:** Use it to communicate a hierarchy or priority order — foundational items at the base, the most exclusive/important at the top.

**Common Examples:**
- Maslow's hierarchy of needs style frameworks
- Organizational hierarchy from executive to frontline
- Marketing funnel stages from broad reach to conversion
- Skill-level progression from beginner to expert

**Sample Dataset:**
```python
df = pd.DataFrame({
    'level': ['Top Level', 'Second Level', 'Third Level', 'Base Level'],
    'width': [0.2, 0.4, 0.6, 0.8],
    'color': ['#E63946', '#F4A261', '#2A9D8F', '#457B9D']
})  # four hierarchy levels, widest at the base
```

**Chart Code:**
```python
import matplotlib.patches as mpatches

fig, ax = plt.subplots(figsize=(9, 7))
for i, row in df.iterrows():
    y = 0.2 * i
    box = mpatches.FancyBboxPatch(
        (0.5 - row['width']/2, y), row['width'], 0.15,
        boxstyle="round,pad=0.01", edgecolor='black', facecolor=row['color'], linewidth=2)
    ax.add_patch(box)
    ax.text(0.5, y + 0.075, row['level'], ha='center', va='center',
            fontsize=11, fontweight='bold', color='white')

ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
plt.title('Pyramid Diagram: Hierarchical Structure', fontsize=15, fontweight='bold', pad=20)
plt.tight_layout(); plt.show()
```

### 71. Step-by-Step Diagram — 🔧 Matplotlib

**Description:** A left-to-right sequence of connected boxes, each representing one stage of a process, joined by directional arrows.

**Purpose:** Use it to communicate a sequential process or workflow where the order of stages matters more than any underlying data.

**Common Examples:**
- Explaining a customer onboarding workflow
- Documenting an approval or sign-off process
- Illustrating a manufacturing or QA pipeline
- Walking through a troubleshooting procedure

**Sample Dataset:**
```python
df = pd.DataFrame({
    'step': ['Step 1:\nInitiate', 'Step 2:\nProcess', 'Step 3:\nVerify', 'Step 4:\nComplete'],
    'color': ['#E63946', '#F4A261', '#2A9D8F', '#457B9D']
})  # four sequential process steps
```

**Chart Code:**
```python
import matplotlib.patches as mpatches

fig, ax = plt.subplots(figsize=(12, 4))
n = len(df)
for i, row in df.iterrows():
    x = 0.15 + i * 0.2
    rect = mpatches.FancyBboxPatch(
        (x, 0.4), 0.15, 0.2, boxstyle="round,pad=0.01",
        edgecolor='black', facecolor=row['color'], linewidth=2)
    ax.add_patch(rect)
    ax.text(x + 0.075, 0.5, row['step'], ha='center', va='center',
            fontsize=10, fontweight='bold', color='white')
    if i < n - 1:
        ax.annotate('', xy=(x + 0.18, 0.5), xytext=(x + 0.15, 0.5),
                     arrowprops=dict(arrowstyle='->', lw=3, color='black'))

ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis('off')
plt.title('Step-by-Step Process Diagram', fontsize=15, fontweight='bold', pad=20)
plt.tight_layout(); plt.show()
```

---

## 🥧 Proportional Charts

Proportional charts emphasize relative sizes and relationships.

### 72. Nested (concentric) pie — 🔧 Matplotlib

**Description:** Two true concentric pie rings — an inner ring showing top-level categories, an outer ring breaking each one down further.

**Purpose:** Use it when you specifically want the classic 'pie within a pie' feel rather than a sunburst — good for exactly 2 hierarchy levels.

**Common Examples:**
- Total spend (inner) broken into categories (outer)
- Total students (inner) broken into majors (outer)
- Total energy use (inner) broken into sources (outer)
- Total traffic (inner) broken into device types (outer)

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Marketing','Marketing','Engineering','Engineering'],
    'subcategory': ['Ads','Content','Backend','Frontend'],
    'value': [15000, 8000, 30000, 20000]
})  # budget ($) by department (inner) and sub-team (outer)
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(7, 7))
inner = df.groupby('category')['value'].sum()
outer = df.groupby(['category', 'subcategory'])['value'].sum()
ax.pie(inner, radius=1, labels=inner.index, wedgeprops=dict(width=0.35, edgecolor='white'),
       colors=plt.cm.Set2.colors)
ax.pie(outer, radius=0.65, wedgeprops=dict(width=0.35, edgecolor='white'),
       colors=plt.cm.Pastel2.colors)
ax.set_title('Nested Category Breakdown', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 73. Marimekko chart — 🌐 Plotly

**Description:** Stacked bars where both the WIDTH and the HEIGHT of each segment encode a value — two dimensions packed into one chart.

**Purpose:** Use it when you need to compare composition (height) AND relative size (width) across categories simultaneously — e.g. market share within market size.

**Common Examples:**
- Market share (height) within each region's total market size (width)
- Product mix (height) within each store's total revenue (width)
- Browser share (height) within each country's total users (width)
- Channel mix (height) within each quarter's total ad spend (width)

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['NA', 'NA', 'EU', 'EU', 'APAC', 'APAC'],
    'subgroup': ['ProductA', 'ProductB', 'ProductA', 'ProductB', 'ProductA', 'ProductB'],
    'pct': [60, 40, 45, 55, 70, 30],
    'total': [500, 500, 300, 300, 200, 200]
})  # product mix (%) within each region's total market size
```

**Chart Code:**
```python
widths = df.groupby('category')['total'].first()
x_pos = widths.cumsum() - widths / 2
fig = go.Figure()
for sub in df['subgroup'].unique():
    d = df[df['subgroup'] == sub]
    fig.add_bar(name=sub, x=x_pos.loc[d['category']], y=d['pct'], width=widths.loc[d['category']].values)
fig.update_layout(barmode='stack', template='plotly_white', title='Marimekko (Width & Height Both Encode Value)',
                   xaxis=dict(tickvals=x_pos.values, ticktext=widths.index))
fig.show()
```

---

## 🌳 Hierarchical Charts

Hierarchical charts show nested and tree structures.

### 74. Treemap — 🌐 Plotly

**Description:** Nested rectangles sized by value and grouped by hierarchy, packing a lot of hierarchical proportion information into a compact space.

**Purpose:** Use it instead of a pie chart or bar chart when you have a HIERARCHY (category > subcategory) and many items — treemaps scale much better than pies.

**Common Examples:**
- Revenue by product category and subcategory
- Disk usage by folder and file type
- Portfolio allocation by sector and stock
- Population by country and city

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Electronics','Electronics','Electronics','Apparel','Apparel','Home'],
    'subcategory': ['Phones','Laptops','Audio','Shirts','Shoes','Furniture'],
    'value': [45000, 38000, 12000, 22000, 18000, 15000]
})  # revenue ($) by category and subcategory
```

**Chart Code:**
```python
fig = px.treemap(df, path=['category', 'subcategory'], values='value', color='value',
                  color_continuous_scale='Blues', template='plotly_white', title='Value by Hierarchy')
fig.update_traces(textinfo='label+value+percent parent')
fig.show()
```

### 75. Sunburst chart — 🌐 Plotly

**Description:** A treemap's radial cousin — nested rings, each ring a level of hierarchy, wedge angle proportional to value.

**Purpose:** Use it like a treemap when hierarchy matters, but you want a more intuitive 'drill from center outward' feel, especially for 3+ hierarchy levels.

**Common Examples:**
- Org chart headcount from company > division > team
- Website traffic from source > medium > campaign
- Product catalog from department > category > item
- Expense report from category > subcategory > vendor

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Engineering','Engineering','Sales','Sales'],
    'subcategory': ['Backend','Frontend','Enterprise','SMB'],
    'value': [40, 25, 30, 20]
})  # headcount by division and team
```

**Chart Code:**
```python
fig = px.sunburst(df, path=['category', 'subcategory'], values='value', color='value',
                   color_continuous_scale='Sunsetdark', template='plotly_white',
                   title='Hierarchical Breakdown')
fig.show()
```

### 76. Icicle chart — 🌐 Plotly

**Description:** A treemap laid out as stacked horizontal or vertical bars per hierarchy level, reading top-to-bottom or left-to-right.

**Purpose:** Use it as an alternative to a sunburst when a linear, left-to-right hierarchy reading feels more natural than a radial one — good for deep hierarchies.

**Common Examples:**
- File system directory structure and sizes
- Organizational reporting structure and team sizes
- Website navigation structure and page views
- Product taxonomy and SKU counts

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Docs','Docs','Images','Images'],
    'subcategory': ['PDFs','Word Files','PNGs','JPEGs'],
    'value': [1200, 800, 3000, 2200]
})  # file count by folder and file type
```

**Chart Code:**
```python
fig = px.icicle(df, path=['category', 'subcategory'], values='value', color='value',
                 color_continuous_scale='Tealgrn', template='plotly_white', title='Hierarchy Breakdown')
fig.update_traces(tiling_orientation='v')
fig.show()
```

### 77. Dendrogram — 🔧 Matplotlib

**Description:** A tree diagram showing the sequence and distance at which items get merged together during hierarchical clustering.

**Purpose:** Use it to decide how many clusters actually exist in your data, and to see which items are most similar to each other before you commit to a cluster count.

**Common Examples:**
- Grouping customers into segments by purchase behavior
- Grouping genes by expression similarity
- Grouping documents by topic similarity
- Grouping products by co-purchase pattern

**Sample Dataset:**
```python
df = pd.DataFrame({
    'a': [1, 1.2, 5, 5.3, 9, 9.1],
    'b': [1, 0.8, 5, 4.8, 9, 8.9],
    'c': [1, 1.1, 5, 5.1, 9, 9.2],
    'label': ['Cust1','Cust2','Cust3','Cust4','Cust5','Cust6']
})  # three roughly-formed clusters of customers
```

**Chart Code:**
```python
from scipy.cluster.hierarchy import dendrogram, linkage
Z = linkage(df[['a', 'b', 'c']], method='ward')
fig, ax = plt.subplots(figsize=(9, 5))
dendrogram(Z, labels=df['label'].values, color_threshold=0.7 * max(Z[:, 2]), ax=ax)
ax.set_title('Hierarchical Clustering Dendrogram', fontsize=14, fontweight='bold')
ax.set_ylabel('Distance')
plt.tight_layout(); plt.show()
```

### 78. Radial / circular tree — 🌐 Plotly

**Description:** A hierarchical tree laid out in concentric rings radiating from a center point, functionally the same drill-down as a sunburst.

**Purpose:** Use it interchangeably with a sunburst — the radial layout tends to feel more organic for taxonomies and org structures.

**Common Examples:**
- Taxonomic classification (kingdom > phylum > class)
- Company org structure from CEO down to individual contributors
- File directory structure
- Product category taxonomy

**Sample Dataset:**
```python
df = pd.DataFrame({
    'level1': ['Animalia','Animalia','Animalia','Animalia'],
    'level2': ['Chordata','Chordata','Arthropoda','Arthropoda'],
    'level3': ['Mammalia','Aves','Insecta','Arachnida'],
    'value': [120, 95, 340, 60]
})  # simplified taxonomic hierarchy with species counts
```

**Chart Code:**
```python
fig = px.sunburst(df, path=['level1', 'level2', 'level3'], values='value',
                   color='level1', template='plotly_white', title='Radial Hierarchy')
fig.show()
```

### 79. Clustermap — 📊 Seaborn

**Description:** A correlation or value heatmap with both rows and columns reordered by hierarchical clustering, with dendrograms shown alongside.

**Purpose:** Use it to discover which variables (or rows) naturally group together, not just their raw pairwise correlation values.

**Common Examples:**
- Grouping genes with similar expression patterns
- Grouping products with similar purchase co-occurrence
- Grouping survey questions that tend to be answered similarly
- Grouping stocks that move together for portfolio diversification

**Sample Dataset:**
```python
df = pd.DataFrame({
    'metric_a': [1, 2, 3, 8, 9, 7],
    'metric_b': [2, 3, 2, 9, 8, 9],
    'metric_c': [8, 9, 7, 1, 2, 3],
    'metric_d': [9, 8, 9, 2, 1, 2]
})  # 6 observations across 4 correlated/anti-correlated metrics
```

**Chart Code:**
```python
sns.set_theme(style='white')
g = sns.clustermap(df.corr(numeric_only=True), cmap='vlag', center=0, annot=True, fmt='.2f',
                    linewidths=0.5, figsize=(8, 8))
g.figure.suptitle('Clustered Correlation Matrix', y=1.02, fontsize=13, fontweight='bold')
plt.show()
```

---

## 📊 Distribution Charts

Distribution charts show how data is spread across values.

### 80. Dot plot (Cleveland) — 🔧 Matplotlib

**Description:** Category vs. value shown as a single dot instead of a full bar, connected to a baseline by a thin line.

**Purpose:** Use it instead of a bar chart when you have many categories and want a cleaner, less visually heavy comparison.

**Common Examples:**
- Average commute time by city
- Customer satisfaction score by product line
- Life expectancy by country
- Median salary by job title

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Manila', 'Cebu', 'Davao', 'Baguio', 'Iloilo'],
    'value': [46, 32, 28, 21, 24]
})  # average one-way commute time (minutes) by city
```

**Chart Code:**
```python
d = df.sort_values('value')
fig, ax = plt.subplots(figsize=(7, 6))
ax.hlines(d['category'], 0, d['value'], color='lightgray', linewidth=1.5)
ax.scatter(d['value'], d['category'], color='#2E86AB', s=100, zorder=3)
for v, c in zip(d['value'], d['category']):
    ax.text(v + d['value'].max()*0.02, c, f'{v:.0f}', va='center', fontsize=9)
ax.set_title('Value by Category', fontsize=14, fontweight='bold')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.show()
```

### 81. Histogram — 📊 Seaborn

**Description:** Bars showing how many observations fall into each of a series of equal-width bins across a numeric range.

**Purpose:** Use it to understand the shape of a single variable's distribution — is it normal, skewed, bimodal, has outliers?

**Common Examples:**
- Distribution of customer order values
- Distribution of exam scores in a class
- Distribution of employee ages in a company
- Distribution of page load times for a website

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [12, 15, 14, 18, 22, 25, 21, 30, 28, 35, 33, 40, 38, 45, 20, 24, 27, 31, 19, 26]
})  # order value ($) for 20 recent transactions
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.histplot(data=df, x='x', bins=30, color='#2E86AB', edgecolor='white')
ax.axvline(df['x'].mean(), color='red', linestyle='--', label=f"Mean: {df['x'].mean():.1f}")
ax.axvline(df['x'].median(), color='orange', linestyle=':', label=f"Median: {df['x'].median():.1f}")
ax.legend()
ax.set_title('Distribution of x', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 82. Histogram + KDE overlay — 📊 Seaborn

**Description:** A histogram with a smoothed density curve drawn on top of it in the same figure, combining exact counts with overall shape.

**Purpose:** Use it when you want both the precise bin counts AND a smooth trend line in one view — a good default for exploratory analysis.

**Common Examples:**
- Exploring the distribution of daily transaction amounts
- Checking whether sensor readings are roughly normal before modeling
- Reviewing the spread of survey response times
- Inspecting the distribution of product weights off a production line

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [101, 98, 105, 99, 102, 97, 103, 100, 96, 104, 108, 95, 106, 99, 101]
})  # product weight (g) sampled from a production line
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.histplot(data=df, x='x', kde=True, color='#6A4C93', edgecolor='white',
                   line_kws={'linewidth': 2.5, 'color': '#2E1E3F'})
ax.set_title('Histogram with Density Curve', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 83. Rug plot — 📊 Seaborn

**Description:** Small tick marks placed along an axis, one per observation, showing the raw data points beneath a smoothed curve.

**Purpose:** Use it layered under a KDE or histogram to show exactly where the real data points are, catching gaps or clumps a smoothed curve can hide.

**Common Examples:**
- Showing individual customer ages under an age-distribution KDE
- Showing individual test scores under a class score distribution
- Showing raw sensor readings under a smoothed trend
- Showing individual response times under a latency distribution

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [22, 25, 23, 40, 41, 42, 24, 26, 60, 23, 25, 27, 41, 43, 24]
})  # customer age at signup
```

**Chart Code:**
```python
sns.set_theme(style='white')
ax = sns.kdeplot(data=df, x='x', fill=True, color='#457B9D', alpha=0.3)
sns.rugplot(data=df, x='x', color='#1D3557', height=0.06, ax=ax)
ax.set_title('Distribution with Individual Observations', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 84. Violin plot — 📊 Seaborn

**Description:** A box plot merged with a mirrored KDE, showing the full shape of a distribution (not just quartiles) per group.

**Purpose:** Use it instead of a box plot when the SHAPE of the distribution matters — e.g. spotting bimodal groups a box plot would hide.

**Common Examples:**
- Comparing response time distribution between two server versions
- Comparing customer spend distribution between loyalty tiers
- Comparing reaction times between control and treatment groups
- Comparing commute time distribution by transport mode

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Tier1']*6 + ['Tier2']*6,
    'y': [20,22,21,60,62,61, 35,37,36,38,39,40],
    'group': ['A','A','A','B','B','B']*2
})  # customer spend ($) by loyalty tier, split by cohort
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.violinplot(data=df, x='category', y='y', hue='group', split=True, palette='muted', inner='quartile')
ax.set_title('Distribution Shape by Category, Split by Group', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 85. Strip plot — 📊 Seaborn

**Description:** Every individual observation plotted as a point per category, jittered horizontally so overlapping points remain visible.

**Purpose:** Use it on smaller datasets where you want to see every raw point, not just a statistical summary — pairs well as an overlay on a box/violin plot.

**Common Examples:**
- Individual employee performance scores by team
- Individual product ratings by category
- Individual race finish times by age group
- Individual survey ratings by respondent segment

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['TeamA']*6 + ['TeamB']*6,
    'y': [7.2, 8.1, 6.9, 7.8, 8.5, 7.1, 6.5, 7.0, 6.2, 7.4, 6.8, 7.6],
    'group': ['Junior','Junior','Junior','Senior','Senior','Senior']*2
})  # performance score (1-10) by team, split by seniority
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.stripplot(data=df, x='category', y='y', hue='group', jitter=0.25, alpha=0.7, palette='deep')
ax.set_title('Individual Observations by Category', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 86. Swarm plot — 📊 Seaborn

**Description:** Like a strip plot, but points are algorithmically nudged so none ever overlap — an exact, uncluttered view of every observation.

**Purpose:** Use it when a strip plot's jitter still causes overplotting and you need a precise, non-overlapping view of every data point.

**Common Examples:**
- Individual runner finish times by race category
- Individual product defect counts by factory line
- Individual customer NPS scores by segment
- Individual student grades by class section

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['LineA']*7 + ['LineB']*7,
    'y': [2,3,2,4,3,5,2, 1,2,1,3,2,1,2]
})  # defect count per batch, by production line
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.swarmplot(data=df, x='category', y='y', hue='category', palette='Set2', size=5, legend=False)
ax.set_title('Non-Overlapping Distribution by Category', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 87. Boxen plot (letter-value) — 📊 Seaborn

**Description:** A box plot variant that shows progressively narrower boxes for more extreme quantiles, scaling gracefully with large sample sizes.

**Purpose:** Use it instead of a regular box plot when you have a large dataset and want more nuance in the tails without a full violin plot.

**Common Examples:**
- Transaction amount distribution across thousands of daily orders
- Latency distribution across millions of API calls
- Session duration distribution across a large user base
- Claim amount distribution across a large insurance portfolio

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': (['Region1']*10 + ['Region2']*10),
    'y': [10,12,11,13,15,14,60,12,11,13, 20,22,21,23,25,24,19,80,22,21]
})  # claim amount ($k) by region
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.boxenplot(data=df, x='category', y='y', hue='category', palette='crest', legend=False)
ax.set_title('Letter-Value Plot (large-sample box plot)', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 88. ECDF plot — 🌐 Plotly

**Description:** A curve showing, for every value on the x-axis, what fraction of the data falls at or below it.

**Purpose:** Use it to answer 'what % of my data is below/above X' precisely — more exact than a histogram for percentile-style questions.

**Common Examples:**
- What % of API requests complete within 200ms
- What % of customers spend less than $50 per order
- What % of students score below a passing grade
- What % of delivery times are under 30 minutes

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [120, 150, 90, 200, 180, 210, 95, 300, 250, 110, 130, 400, 170, 220, 140],
    'category': ['v1']*8 + ['v2']*7
})  # API response time (ms), by version
```

**Chart Code:**
```python
fig = px.ecdf(df, x='x', color='category', template='plotly_white',
              title='Empirical Cumulative Distribution', markers=False)
fig.update_traces(line=dict(width=2.5))
fig.update_layout(yaxis_title='Cumulative Proportion')
fig.show()
```

### 89. Ridge plot (joyplot) — 📊 Seaborn

**Description:** Overlapping KDE curves stacked vertically, one per category, offset just enough to compare many distributions at once.

**Purpose:** Use it when comparing distribution shape across MANY groups (5+) — a grid of separate plots would take too much space, and a single overlay would be unreadable.

**Common Examples:**
- Temperature distribution by month across a year
- Review rating distribution by product category
- Commute time distribution by city
- Exam score distribution by school across a district

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [60,65,63,70,75,73, 55,58,56,60,62,61, 80,85,83,88,90,87],
    'category': ['Jan']*6 + ['Feb']*6 + ['Mar']*6
})  # daily high temperature (F) by month
```

**Chart Code:**
```python
sns.set_theme(style='white')
g = sns.FacetGrid(df, row='category', hue='category', aspect=6, height=0.8, palette='rocket')
g.map(sns.kdeplot, 'x', fill=True, alpha=0.8, linewidth=1.5)
g.map(sns.kdeplot, 'x', color='white', linewidth=1.5)
g.figure.subplots_adjust(hspace=-0.6)
g.set_titles('')
g.set(yticks=[], ylabel='', xlabel='x')
for ax, name in zip(g.axes.flat, df['category'].unique()):
    ax.text(-0.02, 0.05, name, transform=ax.transAxes, fontweight='bold')
plt.show()
```

### 90. Count plot — 📊 Seaborn

**Description:** A bar chart of raw frequency — how many rows fall into each category — computed automatically from the data itself.

**Purpose:** Use it when you want a quick frequency breakdown of a categorical column without manually computing value_counts() first.

**Common Examples:**
- Number of support tickets by issue category
- Number of survey respondents by age bracket
- Number of orders by payment method
- Number of job applicants by department applied to

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Credit Card']*45 + ['PayPal']*30 + ['Bank Transfer']*15 + ['Cash']*10
})  # payment method used across 100 orders
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
order = df['category'].value_counts().index
ax = sns.countplot(data=df, x='category', hue='category', order=order, palette='flare', legend=False)
for container in ax.containers:
    ax.bar_label(container)
ax.set_title('Frequency by Category', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 91. Overlaid ECDFs — 📊 Seaborn

**Description:** Multiple empirical cumulative distribution curves drawn on the same axes, letting distributions be compared directly at every percentile.

**Purpose:** Use it to compare distributions between groups with more precision than overlapping histograms — every crossing point tells you something concrete.

**Common Examples:**
- Comparing response time distributions between two API versions
- Comparing income distributions between two demographics
- Comparing test score distributions between two teaching methods
- Comparing session duration distributions between two app versions

**Sample Dataset:**
```python
df = pd.DataFrame({
    'value': [10,12,11,15,20,22,21,25,30,14,16,13,28,26,24],
    'group': ['Control']*8 + ['Treatment']*7
})  # a metric compared between control and treatment groups
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.ecdfplot(data=df, x='value', hue='group', palette='deep', linewidth=2)
ax.set_title('Distribution Comparison (ECDF)', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 92. Wind rose / polar bar chart — 🔧 Matplotlib

**Description:** Bars radiating from a center point around a compass, showing frequency/magnitude by direction — the standard wind-direction chart.

**Purpose:** Use it specifically for directional data — anything measured by compass bearing or cyclical angle, not just literal wind.

**Common Examples:**
- Wind speed and direction frequency at a weather station
- Golf shot direction dispersion
- Antenna signal strength by bearing
- Traffic flow direction at a busy intersection

**Sample Dataset:**
```python
df = pd.DataFrame({
    'direction_deg': [0, 45, 90, 135, 180, 225, 270, 315],
    'frequency': [12, 18, 25, 15, 8, 10, 20, 14]
})  # wind frequency (%) by compass direction
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(7, 7), subplot_kw={'projection': 'polar'})
theta = np.deg2rad(df['direction_deg'])
ax.bar(theta, df['frequency'], width=0.4, color=plt.cm.viridis(df['frequency'] / df['frequency'].max()))
ax.set_theta_zero_location('N')
ax.set_theta_direction(-1)
ax.set_title('Wind Rose', fontsize=14, fontweight='bold', pad=20)
plt.tight_layout(); plt.show()
```

---

## 📊 Comparison Charts

Comparison charts facilitate direct comparison between categories.

### 93. Bar chart (vertical) — 🌐 Plotly

**Description:** Rectangular bars whose height encodes a value, one per category.

**Purpose:** Use it to compare a metric across a moderate number of discrete categories — the most universally understood comparison chart.

**Common Examples:**
- Quarterly revenue by product category
- Number of support tickets by issue type
- Population by country
- Votes received by candidate

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Electronics', 'Apparel', 'Home Goods', 'Groceries', 'Toys'],
    'value': [48200, 31500, 27800, 52100, 15400]
})  # quarterly revenue ($) by category
```

**Chart Code:**
```python
d = df.sort_values('value', ascending=False)
fig = px.bar(d, x='category', y='value', color='value', color_continuous_scale='Blues',
             text_auto='.2s', template='plotly_white', title='Value by Category')
fig.update_traces(textposition='outside')
fig.update_layout(coloraxis_showscale=False)
fig.show()
```

### 94. Grouped bar chart — 🌐 Plotly

**Description:** Bars for multiple subgroups placed side-by-side within each category, instead of stacked.

**Purpose:** Use it to compare subgroups against each other WITHIN each category — better than stacking when you care about each subgroup's absolute size, not just the total.

**Common Examples:**
- Sales by region, split by product line
- Test scores by school, split by subject
- Headcount by department, split by year
- Customer satisfaction by store, split by survey wave

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['North', 'North', 'South', 'South', 'East', 'East'],
    'subgroup': ['2023', '2024', '2023', '2024', '2023', '2024'],
    'value': [120, 145, 98, 110, 133, 128]
})  # sales ($k) by region, split by year
```

**Chart Code:**
```python
fig = px.bar(df, x='category', y='value', color='subgroup', barmode='group',
             template='plotly_white', title='Value by Category and Subgroup',
             color_discrete_sequence=px.colors.qualitative.Set2)
fig.update_layout(legend_title_text='Subgroup')
fig.show()
```

### 95. Point plot — 📊 Seaborn

**Description:** The mean (or another estimator) per category, plotted as a point with a confidence interval, connected by a line.

**Purpose:** Use it as a cleaner alternative to a bar chart when you care more about the trend/comparison of averages than the raw scale of each bar.

**Common Examples:**
- Average satisfaction score by support tier, with confidence bands
- Average conversion rate by marketing channel
- Average test score by teaching method, with uncertainty shown
- Average wait time by clinic location

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Basic']*5 + ['Premium']*5 + ['VIP']*5,
    'y': [6.5,7.0,6.8,7.2,6.9, 8.0,8.2,7.9,8.1,8.3, 9.0,9.2,8.8,9.1,9.3]
})  # satisfaction score (1-10) by support tier
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.pointplot(data=df, x='category', y='y', errorbar='ci', capsize=0.15,
                    color='#E76F51', linestyle='-', markers='o')
ax.set_title('Mean with 95% Confidence Interval', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 96. Lollipop chart — 🔧 Matplotlib

**Description:** A bar chart replaced with a thin stem and a dot at the end — same information, much less visual weight.

**Purpose:** Use it as a cleaner alternative to a bar chart, especially with many categories, since thin stems reduce visual clutter compared to solid bars.

**Common Examples:**
- Ranking countries by renewable energy adoption
- Ranking employees by sales performance
- Ranking features by user request count
- Ranking articles by read time

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Feature A', 'Feature B', 'Feature C', 'Feature D', 'Feature E'],
    'value': [340, 210, 180, 95, 60]
})  # number of user requests per feature
```

**Chart Code:**
```python
d = df.sort_values('value')
fig, ax = plt.subplots(figsize=(7, 6))
colors = plt.cm.viridis((d['value'] - d['value'].min()) / (d['value'].max() - d['value'].min()))
ax.hlines(d['category'], 0, d['value'], color=colors, linewidth=2.5)
ax.scatter(d['value'], d['category'], color=colors, s=120, zorder=3, edgecolor='white')
ax.set_title('Value by Category', fontsize=14, fontweight='bold')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.show()
```

### 97. 100% stacked bar chart — 🌐 Plotly

**Description:** Stacked bars normalized so every bar totals exactly 100%, showing composition mix rather than absolute scale.

**Purpose:** Use it when comparing the MIX of subgroups across categories matters more than their absolute totals — e.g. comparing % breakdowns fairly across groups of very different sizes.

**Common Examples:**
- Market share mix by region, regardless of total market size
- Device type mix (mobile/desktop/tablet) by country
- Grade distribution mix by class section
- Payment method mix by store location

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Store A', 'Store A', 'Store B', 'Store B', 'Store C', 'Store C'],
    'subgroup': ['Card', 'Cash', 'Card', 'Cash', 'Card', 'Cash'],
    'value': [700, 300, 450, 550, 900, 100]
})  # payment method counts by store (different total volumes)
```

**Chart Code:**
```python
pct = df.pivot_table(index='category', columns='subgroup', values='value', aggfunc='sum')
pct = pct.div(pct.sum(axis=1), axis=0) * 100
pct_long = pct.reset_index().melt(id_vars='category', var_name='subgroup', value_name='pct')
fig = px.bar(pct_long, x='category', y='pct', color='subgroup', barmode='stack',
             template='plotly_white', title='Composition Mix (100% Stacked)',
             color_discrete_sequence=px.colors.qualitative.Set2)
fig.update_traces(texttemplate='%{y:.0f}%', textposition='inside')
fig.update_layout(yaxis_title='% of total')
fig.show()
```

### 98. Faceted subplots (small multiples) — 🌐 Plotly

**Description:** One chart automatically split into a grid of smaller panels, one per category, all sharing the same axes for easy comparison.

**Purpose:** Use it when comparing the SAME chart type across many groups — small multiples scale far better than cramming every group into one overloaded chart.

**Common Examples:**
- Sales trend, one panel per region
- Score distribution, one panel per class section
- Response time, one panel per server
- Revenue trend, one panel per product line

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': list(range(1, 6)) * 3,
    'y': [10,12,14,13,15, 8,9,11,10,12, 20,22,25,23,26],
    'category': ['RegionA']*5 + ['RegionB']*5 + ['RegionC']*5
})  # a trend, split into 3 panels by region
```

**Chart Code:**
```python
fig = px.scatter(df, x='x', y='y', facet_col='category', facet_col_wrap=3,
                  color='category', template='plotly_white', title='Small Multiples by Category')
fig.update_layout(showlegend=False)
fig.show()
```

### 99. Dropdown-filtered chart — 🌐 Plotly

**Description:** One chart with a dropdown menu that swaps which data series is shown, without needing separate static charts per option.

**Purpose:** Use it in a dashboard where the user should be able to switch context (e.g. by product/region) without navigating to a different page.

**Common Examples:**
- Revenue chart with a dropdown to pick which product line to view
- Traffic chart with a dropdown to pick which website page
- Sales chart with a dropdown to pick which sales region
- Metrics chart with a dropdown to pick which server

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': list(range(1, 6)) * 2,
    'y': [10,12,14,13,15, 20,22,21,25,24],
    'category': ['ProductA']*5 + ['ProductB']*5
})  # two series to switch between via dropdown
```

**Chart Code:**
```python
fig = go.Figure()
for cat in df['category'].unique():
    d = df[df['category'] == cat]
    fig.add_scatter(x=d['x'], y=d['y'], name=cat, visible=(cat == df['category'].unique()[0]))

buttons = [dict(label=cat, method='update',
                args=[{'visible': [c == cat for c in df['category'].unique()]}])
           for cat in df['category'].unique()]
fig.update_layout(updatemenus=[dict(buttons=buttons, direction='down', x=1.15, y=1)],
                   template='plotly_white', title='Filter by Category')
fig.show()
```

### 100. Dual-axis combo chart (bar + line) — 🌐 Plotly

**Description:** Two different chart types (typically bar + line) sharing an x-axis but using independent y-scales, layered in one figure.

**Purpose:** Use it when two related metrics have very different scales or units but you want to show them moving together over the same axis.

**Common Examples:**
- Sales volume (bars) vs. average price (line) over time
- Website traffic (bars) vs. conversion rate % (line) over time
- Headcount (bars) vs. revenue per employee (line) over time
- Rainfall (bars) vs. temperature (line) over a month

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': pd.date_range('2024-01-01', periods=6, freq='ME'),
    'volume': [1200, 1350, 1100, 1500, 1650, 1400],
    'price': [42, 41, 44, 43, 45, 47]
})  # sales volume and average price over 6 months
```

**Chart Code:**
```python
fig = go.Figure()
fig.add_bar(x=df['x'], y=df['volume'], name='Volume', marker_color='#A8DADC')
fig.add_scatter(x=df['x'], y=df['price'], name='Price', yaxis='y2',
                line=dict(color='#E63946', width=3))
fig.update_layout(template='plotly_white', title='Volume & Price',
                   yaxis=dict(title='Volume'),
                   yaxis2=dict(title='Price', overlaying='y', side='right'))
fig.show()
```

---

## 📈 Statistical Charts

Statistical charts visualize statistical distributions and relationships.

### 101. Box plot — 📊 Seaborn

**Description:** A summary of a distribution's median, quartiles, and outliers using a box and whiskers, per group.

**Purpose:** Use it to compare the spread and central tendency of a numeric variable across several categories at a glance, especially to spot outliers.

**Common Examples:**
- Salary distribution by department
- Delivery time distribution by courier
- Test score distribution by classroom
- House price distribution by neighborhood

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Sales']*5 + ['Engineering']*5 + ['Support']*5,
    'y': [55,58,60,62,90, 78,82,85,88,120, 45,48,50,52,75]
})  # salary ($k) by department, with a high outlier per group
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.boxplot(data=df, x='category', y='y', hue='category', palette='Set2',
                  legend=False, showfliers=False)
sns.stripplot(data=df, x='category', y='y', color='black', alpha=0.3, size=3, ax=ax)
ax.set_title('Distribution by Category (with raw points)', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 102. Bar plot with error bars — 🌐 Plotly

**Description:** A bar chart where each bar's height is a mean value, with a vertical error bar showing variability (e.g. std dev or CI).

**Purpose:** Use it when the audience needs to know not just the average but how confident/variable that average is — critical in scientific or A/B test reporting.

**Common Examples:**
- Average conversion rate per test variant, with standard error
- Average crop yield per fertilizer type, with std deviation
- Average response time per server config, with error bars
- Average score per treatment group in a clinical trial

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Control', 'Variant A', 'Variant B'],
    'mean': [4.2, 5.1, 4.8],
    'std': [0.4, 0.5, 0.3]
})  # conversion rate (%) per A/B test variant, with std dev
```

**Chart Code:**
```python
fig = px.bar(df, x='category', y='mean', error_y='std', color='category',
             template='plotly_white', title='Mean ± Std. Dev. by Category',
             color_discrete_sequence=px.colors.qualitative.Prism)
fig.update_layout(showlegend=False)
fig.show()
```

### 103. Dot plot with confidence interval — 🌐 Plotly

**Description:** A point estimate per category shown as a dot, with a horizontal whisker showing its confidence interval.

**Purpose:** Use it as a compact, low-clutter alternative to error-bar bar charts, especially useful with many categories stacked vertically.

**Common Examples:**
- Effect size estimates across multiple product experiments
- Average delivery time estimate by region, with CI
- Average rating estimate by product line, with CI
- Estimated vote share by candidate, with margin of error

**Sample Dataset:**
```python
df = pd.DataFrame({
    'category': ['Region A', 'Region B', 'Region C'],
    'mean': [3.2, 4.5, 2.8],
    'ci': [0.5, 0.3, 0.6]
})  # average delivery delay (days) by region, with confidence interval
```

**Chart Code:**
```python
d = df.sort_values('mean')
fig = px.scatter(d, x='mean', y='category', error_x='ci', template='plotly_white',
                  title='Estimate with Confidence Interval')
fig.update_traces(marker=dict(size=10, color='#1D3557'))
fig.show()
```

### 104. Residual plot — 📊 Seaborn

**Description:** Residuals (actual minus predicted) plotted against fitted values, used to check whether a regression's assumptions hold.

**Purpose:** Use it after fitting a regression to check for non-linearity, heteroscedasticity, or patterns the model missed — residuals should look like random noise.

**Common Examples:**
- Checking a sales-forecast regression for missed seasonality
- Checking a pricing model for systematic under/over-prediction
- Checking a growth model's residuals for a leftover trend
- Validating a linear model before trusting its coefficients

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5, 6, 7, 8],
    'y': [10, 13, 15, 21, 22, 28, 30, 35]
})  # residplot fits its own regression internally from x, y
```

**Chart Code:**
```python
sns.set_theme(style='whitegrid')
ax = sns.residplot(data=df, x='x', y='y', lowess=True,
                    scatter_kws={'alpha': 0.5, 'color': '#6A4C93'},
                    line_kws={'color': 'red', 'linewidth': 2})
ax.axhline(0, color='gray', linestyle='--', linewidth=1)
ax.set_title('Residuals vs. Fitted', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 105. Q-Q plot — 🔧 Matplotlib

**Description:** A scatter of a sample's quantiles against a theoretical distribution's quantiles — a straight line means the sample follows that distribution.

**Purpose:** Use it to check whether data is approximately normally distributed before applying a statistical test or model that assumes normality.

**Common Examples:**
- Checking if regression residuals are normally distributed
- Checking if measurement errors follow a normal distribution
- Checking if returns data follows a normal distribution before risk modeling
- Validating normality assumptions before a t-test

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [48, 52, 50, 55, 49, 51, 53, 47, 54, 50, 52, 49, 51, 53, 50]
})  # a roughly-normal sample of measurements
```

**Chart Code:**
```python
import scipy.stats as stats
fig, ax = plt.subplots(figsize=(6, 6))
stats.probplot(df['x'], dist='norm', plot=ax)
ax.get_lines()[0].set_markerfacecolor('#2E86AB')
ax.get_lines()[0].set_markeredgecolor('white')
ax.get_lines()[1].set_color('#E63946')
ax.set_title('Q-Q Plot vs. Normal Distribution', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 106. Error bar plot — 🔧 Matplotlib

**Description:** A point estimate for each x-value with a vertical bar showing the range of uncertainty around it.

**Purpose:** Use it whenever a single-value line/scatter would overstate precision — show the reader how much the estimate could vary.

**Common Examples:**
- Measurement readings with instrument uncertainty
- Average scores per test round with standard error
- Experimental results with confidence intervals
- Survey estimates with margin of error

**Sample Dataset:**
```python
df = pd.DataFrame({
    'x': [1, 2, 3, 4, 5],
    'y': [10, 14, 13, 18, 20],
    'err': [1.2, 0.8, 1.5, 1.0, 1.3]
})  # measurement per trial, with uncertainty
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(8, 5))
ax.errorbar(df['x'], df['y'], yerr=df['err'], fmt='o-', color='#457B9D',
            ecolor='gray', capsize=4, markersize=6)
ax.set_title('Estimate with Error Bars', fontsize=14, fontweight='bold')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.show()
```

### 107. Forest plot — 🔧 Matplotlib

**Description:** Effect sizes with confidence intervals plotted one per row, typically with a vertical reference line at zero (no effect).

**Purpose:** Use it in meta-analyses or multi-study comparisons to show which studies/groups found a significant effect (CI doesn't cross zero) and which didn't.

**Common Examples:**
- Meta-analysis of a drug's effect size across multiple clinical trials
- A/B test effect sizes across multiple product experiments
- Regression coefficient estimates with confidence intervals
- Treatment effect comparison across multiple study sites

**Sample Dataset:**
```python
df = pd.DataFrame({
    'study': ['Trial A', 'Trial B', 'Trial C', 'Trial D'],
    'effect': [0.3, -0.1, 0.5, 0.15],
    'ci': [0.15, 0.2, 0.1, 0.25]
})  # treatment effect size with CI, across 4 clinical trials
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(7, 5))
ax.errorbar(df['effect'], df['study'], xerr=df['ci'], fmt='s', color='#264653',
            ecolor='gray', capsize=3, markersize=7)
ax.axvline(0, color='#E63946', linestyle='--', linewidth=1.5)
ax.set_title('Forest Plot: Effect Sizes with 95% CI', fontsize=14, fontweight='bold')
ax.spines[['top', 'right']].set_visible(False)
plt.tight_layout(); plt.show()
```

### 108. Missing-data matrix — 📊 Seaborn

**Description:** A visual grid showing exactly which cells in a dataset are missing (colored) vs. present, across all rows and columns.

**Purpose:** Use it during data cleaning to spot patterns in missingness — e.g. entire columns missing, or missingness correlated across fields — before deciding how to handle it.

**Common Examples:**
- Auditing which survey questions have the most missing responses
- Checking sensor data for gaps in specific channels
- Reviewing which patient records are missing lab values
- Checking a merged dataset for join-related missing values

**Sample Dataset:**
```python
df = pd.DataFrame({
    'age': [25, np.nan, 34, 45, np.nan, 29],
    'income': [50000, 62000, np.nan, 71000, 55000, np.nan],
    'region': ['N', 'S', 'N', np.nan, 'S', 'N']
})  # a small dataset with scattered missing values
```

**Chart Code:**
```python
fig, ax = plt.subplots(figsize=(9, 5))
sns.heatmap(df.isnull(), cbar=False, cmap=['#2A9D8F', '#E76F51'], ax=ax)
pct_missing = df.isnull().mean() * 100
for i, pct in enumerate(pct_missing):
    ax.text(i + 0.5, -0.3, f'{pct:.0f}%', ha='center', fontsize=8)
ax.set_title('Missing Data Map (% missing shown above each column)', fontsize=13, fontweight='bold')
plt.tight_layout(); plt.show()
```

### 109. Bland-Altman plot — 🔧 Matplotlib

**Description:** A plot of the average of two measurement methods (x-axis) against their difference (y-axis), with limits of agreement shown.

**Purpose:** Use it specifically to assess whether two measurement methods (e.g. a new device vs. a gold-standard) agree closely enough to be used interchangeably.

**Common Examples:**
- Comparing a new blood pressure device against the clinical standard
- Comparing two lab assay methods for the same biomarker
- Comparing a cheap sensor against a calibrated reference sensor
- Comparing self-reported vs. measured height/weight

**Sample Dataset:**
```python
df = pd.DataFrame({
    'method_a': [120, 130, 125, 140, 135, 128, 122, 138],
    'method_b': [118, 133, 123, 142, 131, 130, 125, 136]
})  # blood pressure readings from two measurement devices
```

**Chart Code:**
```python
mean = (df['method_a'] + df['method_b']) / 2
diff = df['method_a'] - df['method_b']
fig, ax = plt.subplots(figsize=(7, 5))
ax.scatter(mean, diff, alpha=0.6, color='#2E86AB')
ax.axhline(diff.mean(), color='#264653', label='Mean diff')
ax.axhline(diff.mean() + 1.96*diff.std(), color='red', linestyle='--', label='+1.96 SD')
ax.axhline(diff.mean() - 1.96*diff.std(), color='red', linestyle='--', label='-1.96 SD')
ax.legend()
ax.set_title('Bland-Altman Agreement Plot', fontsize=14, fontweight='bold')
plt.tight_layout(); plt.show()
```
