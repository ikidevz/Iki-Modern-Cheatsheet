# Streamlit Cheatsheet for Data & Analytics Engineers

> A structured reference for building data apps with Streamlit — widgets, layout, session state, caching, data/chart display, forms, database connections, multipage apps, and deployment.

## 📑 Table of Contents

1. [🚀 Setup and Basic App](#setup-and-basic-app)
2. [🧱 Text & Display Elements](#text-display-elements)
3. [🎛️ Widgets](#widgets)
4. [🧭 Layout: Columns, Sidebar, Tabs, Containers](#layout-columns-sidebar-tabs-containers)
5. [🧠 Session State](#session-state)
6. [⚡ Caching](#caching)
7. [📊 Displaying Data & Charts](#displaying-data-charts)
8. [📝 Forms](#forms)
9. [📁 File Upload & Download](#file-upload-download)
10. [🔌 Database & Data Connections](#database-data-connections)
11. [📄 Multipage Apps](#multipage-apps)
12. [🎨 Theming & Config](#theming-config)
13. [🚀 Deployment](#deployment)
14. [⚡ Performance Tips](#performance-tips)
15. [💬 Chat & LLM Apps](#chat-llm-apps)
16. [🔐 Authentication Patterns](#authentication-patterns)
17. [🧪 Testing Streamlit Apps](#testing-streamlit-apps)
18. [🧩 Custom Components](#custom-components)
19. [🖇️ Callbacks with Arguments & Advanced State](#callbacks-with-arguments-advanced-state)
20. [⚠️ Common Gotchas](#common-gotchas)
21. [🎯 Best Practices](#best-practices)
22. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

| Task                        | Syntax                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Run an app                  | `streamlit run app.py`                                              |
| Show text/markdown          | `st.write(x)`, `st.markdown("**bold**")`                            |
| Show a dataframe            | `st.dataframe(df)` / `st.table(df)`                                 |
| Basic widget                | `x = st.slider("Value", 0, 100, 50)`                                |
| Sidebar                     | `st.sidebar.selectbox(...)`                                         |
| Columns                     | `col1, col2 = st.columns(2)`                                        |
| Cache expensive computation | `@st.cache_data` (data) / `@st.cache_resource` (connections/models) |
| Persist state across reruns | `st.session_state['key'] = value`                                   |
| Stop execution early        | `st.stop()`                                                         |
| Rerun the script            | `st.rerun()`                                                        |

## 🚀 Setup and Basic App

```bash
pip install streamlit
streamlit run app.py                 # opens http://localhost:8501
streamlit run app.py --server.port 8502
streamlit hello                      # built-in demo app
```

```python
# app.py — Streamlit re-runs this whole script top-to-bottom on every interaction
import streamlit as st
import pandas as pd

st.set_page_config(page_title="Sales Dashboard", page_icon="📊", layout="wide")

st.title("📊 Sales Dashboard")
st.write("This script re-executes on every widget interaction — design around that.")

df = pd.read_csv("sales.csv")
region = st.selectbox("Region", df["region"].unique())
st.dataframe(df[df["region"] == region])
```

## 🧱 Text & Display Elements

```python
st.title("Page Title")
st.header("Section Header")
st.subheader("Subsection")
st.markdown("Supports **bold**, *italics*, and [links](https://example.com)")
st.write("st.write() is the Swiss-army-knife — auto-detects type: text, df, chart, dict")
st.caption("Small grey helper text")
st.code("df.groupby('col').sum()", language="python")
st.latex(r"\sum_{i=1}^n x_i")

st.success("Operation succeeded")
st.info("FYI message")
st.warning("Careful")
st.error("Something failed")
st.exception(e)   # nicely formatted traceback

with st.spinner("Loading data..."):
    df = load_big_dataframe()

st.divider()
st.json({"key": "value"})
st.metric(label="Revenue", value="$1.2M", delta="+4.5%")
```

## 🎛️ Widgets

```python
# Every widget's current value is its return value — capture it in a variable
name = st.text_input("Name", value="")
age = st.number_input("Age", min_value=0, max_value=120, value=25)
amount = st.slider("Amount", 0.0, 1000.0, 500.0, step=10.0)
date = st.date_input("Date")
option = st.selectbox("Choose one", ["A", "B", "C"])
options = st.multiselect("Choose several", ["A", "B", "C"], default=["A"])
choice = st.radio("Pick one", ["Yes", "No"])
agree = st.checkbox("I agree")
clicked = st.button("Run")
color = st.color_picker("Pick a color", "#00f900")
text = st.text_area("Notes", height=150)

# Every widget needs a `key` if you have duplicates on the same page,
# and can drive conditional logic directly:
if clicked:
    st.write(f"Running for {name}, age {age}")
```

| Widget             | Returns                                                     |
| ------------------ | ----------------------------------------------------------- |
| `st.button`        | `bool` — `True` only on the run immediately after the click |
| `st.checkbox`      | `bool`                                                      |
| `st.slider`        | number or `(low, high)` tuple if range mode                 |
| `st.selectbox`     | the selected option                                         |
| `st.multiselect`   | `list` of selected options                                  |
| `st.file_uploader` | `UploadedFile` object (or `None`)                           |
| `st.data_editor`   | edited `DataFrame`                                          |

## 🧭 Layout: Columns, Sidebar, Tabs, Containers

```python
# Columns
col1, col2, col3 = st.columns(3)
col1.metric("Revenue", "$1.2M")
col2.metric("Orders", "3,401")
col3.metric("AOV", "$352")

col_a, col_b = st.columns([2, 1])   # relative widths
with col_a:
    st.line_chart(df)

# Sidebar — persistent controls, separate from main flow
st.sidebar.header("Filters")
region = st.sidebar.selectbox("Region", ["All", "US", "EU"])
date_range = st.sidebar.date_input("Date range", [])

# Tabs
tab1, tab2 = st.tabs(["Overview", "Details"])
with tab1:
    st.write("Summary content")
with tab2:
    st.write("Detailed content")

# Expander (collapsible section)
with st.expander("Show raw data"):
    st.dataframe(df)

# Container (group elements, useful for placing content out of order)
placeholder = st.empty()
placeholder.write("Loading...")
# ... later ...
placeholder.write("Done!")
```

## 🧠 Session State

```python
# Session state persists values across reruns (the script re-runs top-to-bottom every interaction)
if "counter" not in st.session_state:
    st.session_state.counter = 0

if st.button("Increment"):
    st.session_state.counter += 1

st.write(f"Count: {st.session_state.counter}")

# Widgets can bind directly to session_state via `key`
st.text_input("Your name", key="username")
st.write(f"Hello, {st.session_state.username}")

# Callbacks fire BEFORE the script reruns — useful for validating/transforming input
def on_change():
    st.session_state.upper_name = st.session_state.username.upper()

st.text_input("Name", key="username", on_change=on_change)
```

- **Why it matters**: Streamlit reruns the entire script on every interaction, so any variable not stored in `st.session_state` resets to its initial value each time — `session_state` is the only thing that survives between reruns within a session.

## ⚡ Caching

```python
# st.cache_data — for data: DataFrames, arrays, JSON-serializable results (cached by value, hashed)
@st.cache_data
def load_data(path: str) -> pd.DataFrame:
    return pd.read_csv(path)

@st.cache_data(ttl=3600)              # expire after 1 hour
@st.cache_data(show_spinner="Loading dataset...")
def load_from_db(query: str) -> pd.DataFrame:
    return pd.read_sql(query, conn)

# st.cache_resource — for non-data objects: DB connections, ML models, anything unserializable
# (cached by reference — the SAME object instance is shared across sessions/reruns)
@st.cache_resource
def get_connection():
    return create_engine("postgresql://...")

# Manually clear a cache
load_data.clear()
st.cache_data.clear()   # clear everything
```

|                        | `st.cache_data`                                                           | `st.cache_resource`                                                         |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Use for                | DataFrames, lists, dicts, arrays                                          | DB connections, ML models, API clients                                      |
| Copy semantics         | Returns a fresh copy each call (safe to mutate)                           | Returns the same shared object every time                                   |
| Typical bug if misused | Mutating cached data leaks across calls if using `cache_resource` instead | Slow/serialization errors if using `cache_data` on an unserializable object |

## 📊 Displaying Data & Charts

```python
st.dataframe(df, use_container_width=True, hide_index=True)   # interactive, sortable
st.table(df)                                                   # static, all rows rendered
st.data_editor(df, num_rows="dynamic")                         # editable grid, returns edited df

# Built-in quick charts (thin wrappers over Altair/Vega-Lite)
st.line_chart(df, x="date", y="revenue")
st.bar_chart(df, x="category", y="amount")
st.area_chart(df)
st.scatter_chart(df, x="x", y="y", color="category")

# Full control via Plotly / Altair / Matplotlib
import plotly.express as px
fig = px.line(df, x="date", y="revenue", color="region")
st.plotly_chart(fig, use_container_width=True)

import altair as alt
chart = alt.Chart(df).mark_bar().encode(x="category", y="amount")
st.altair_chart(chart, use_container_width=True)

import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.plot(df["date"], df["revenue"])
st.pyplot(fig)

st.map(df)                       # needs lat/lon columns
st.image("chart.png")
```

## 📝 Forms

```python
# st.form batches inputs so the script only reruns once, on submit —
# without it, EVERY widget interaction triggers a full rerun individually.
with st.form("filter_form"):
    region = st.selectbox("Region", ["US", "EU", "APAC"])
    min_amount = st.number_input("Min amount", value=0)
    submitted = st.form_submit_button("Apply Filters")

if submitted:
    filtered = df[(df.region == region) & (df.amount >= min_amount)]
    st.dataframe(filtered)
```

## 📁 File Upload & Download

```python
uploaded = st.file_uploader("Upload a CSV", type=["csv"])
if uploaded is not None:
    df = pd.read_csv(uploaded)
    st.dataframe(df)

uploaded_files = st.file_uploader("Upload multiple", accept_multiple_files=True)

st.download_button(
    label="Download results as CSV",
    data=df.to_csv(index=False).encode("utf-8"),
    file_name="results.csv",
    mime="text/csv"
)
```

## 🔌 Database & Data Connections

```python
# st.connection — a unified, cached way to connect to SQL, Snowflake, etc.
conn = st.connection("sql", type="sql", url="postgresql://user:pass@host/db")
df = conn.query("SELECT * FROM orders WHERE amount > :min_amt", params={"min_amt": 100}, ttl=600)

# Snowflake connection (via secrets.toml)
# .streamlit/secrets.toml:
# [connections.snowflake]
# account = "..."
# user = "..."
# password = "..."
conn = st.connection("snowflake")
df = conn.query("SELECT * FROM sales.orders LIMIT 100")

# Generic pattern for any client (cache the resource, not the data)
@st.cache_resource
def get_engine():
    return create_engine(st.secrets["db_url"])

@st.cache_data(ttl=600)
def run_query(sql: str):
    with get_engine().connect() as c:
        return pd.read_sql(sql, c)
```

## 📄 Multipage Apps

```
my_app/
├── app.py                 # main/entry page
├── pages/
│   ├── 1_📈_Trends.py
│   ├── 2_🗺️_Regions.py
│   └── 3_⚙️_Settings.py
└── .streamlit/
    └── config.toml
```

```python
# Newer, more flexible approach: st.navigation + st.Page (Streamlit 1.36+)
import streamlit as st

pg = st.navigation([
    st.Page("views/overview.py", title="Overview", icon="📊"),
    st.Page("views/details.py", title="Details", icon="🔍"),
])
pg.run()
```

- The `pages/` directory convention auto-generates sidebar navigation from filenames — numeric prefixes control ordering, emoji become icons.

## 🎨 Theming & Config

```toml
# .streamlit/config.toml
[theme]
primaryColor = "#FF4B4B"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F0F2F6"
textColor = "#31333F"
font = "sans serif"

[server]
port = 8501
enableCORS = false
maxUploadSize = 200

[browser]
gatherUsageStats = false
```

```toml
# .streamlit/secrets.toml — never commit this; use platform secrets in prod
db_password = "..."
[connections.snowflake]
account = "..."
```

## 🚀 Deployment

```bash
# Streamlit Community Cloud: push to GitHub, connect repo at share.streamlit.io
# requirements.txt (or pyproject.toml) must list all dependencies

# Docker
```

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8501
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health
ENTRYPOINT ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

```bash
docker build -t my-streamlit-app .
docker run -p 8501:8501 my-streamlit-app
```

- Other common targets: **Kubernetes** (behind an ingress + the Docker image above), **AWS App Runner/ECS**, **Google Cloud Run**, **Azure Container Apps** — Streamlit itself is just a stateful Python web server, so any container platform works.

## ⚡ Performance Tips

```python
# Fragment reruns (Streamlit 1.33+) — rerun only part of the page, not the whole script
@st.fragment
def filter_section():
    region = st.selectbox("Region", df["region"].unique())
    st.dataframe(df[df.region == region])

filter_section()   # interactions inside only rerun this fragment

# Auto-refresh a fragment on an interval (e.g., a live dashboard)
@st.fragment(run_every="30s")
def live_metrics():
    st.metric("Active users", get_active_user_count())
```

- **Cache anything expensive** (`@st.cache_data` for query results/dataframes, `@st.cache_resource` for connections/models) — Streamlit's rerun-on-every-interaction model makes this the single highest-leverage optimization.
- **Fragments** avoid re-running unrelated parts of the page for a widget interaction confined to one section.
- **Lazy-load heavy sections** behind `st.expander`/tabs so they don't compute until the user actually opens them.

## 💬 Chat & LLM Apps

```python
import streamlit as st

st.title("💬 Chat with your data")

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ask a question..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        response = st.write_stream(call_llm_streaming(prompt))   # generator of text chunks

    st.session_state.messages.append({"role": "assistant", "content": response})
```

```python
# st.write_stream accepts any iterable/generator of strings (or an OpenAI/Anthropic streaming response)
def call_llm_streaming(prompt: str):
    stream = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=1024,
        messages=[{"role": "user", "content": prompt}], stream=True
    )
    for event in stream:
        if event.type == "content_block_delta":
            yield event.delta.text
```

- **`st.chat_message`** provides pre-styled containers (with role-based avatars) so a conversation renders like a real chat UI without hand-built CSS.
- **`st.write_stream`** handles token-by-token rendering from any generator, which is what makes LLM responses appear to "type out" instead of popping in all at once after the full response completes.

## 🔐 Authentication Patterns

```python
# st.login / st.user (Streamlit 1.42+) — built-in OpenID Connect (OIDC) support
if not st.user.is_logged_in:
    st.button("Log in with Google", on_click=st.login)
    st.stop()

st.write(f"Welcome, {st.user.name}!")
st.button("Log out", on_click=st.logout)
```

```toml
# .streamlit/secrets.toml
[auth]
redirect_uri = "http://localhost:8501/oauth2callback"
cookie_secret = "a-random-secret-string"

[auth.google]
client_id = "..."
client_secret = "..."
server_metadata_url = "https://accounts.google.com/.well-known/openid-configuration"
```

```python
# Simple username/password gate for internal tools without a full OIDC provider
import hmac

def check_password():
    def password_entered():
        if hmac.compare_digest(st.session_state["password"], st.secrets["app_password"]):
            st.session_state["authenticated"] = True
            del st.session_state["password"]
        else:
            st.session_state["authenticated"] = False

    if st.session_state.get("authenticated"):
        return True

    st.text_input("Password", type="password", on_change=password_entered, key="password")
    if "authenticated" in st.session_state and not st.session_state["authenticated"]:
        st.error("Incorrect password")
    return False

if not check_password():
    st.stop()
```

- Use **`st.login`/`st.user`** (native OIDC) whenever the deployment target can front an identity provider (Google, Okta, Azure AD) — it's the supported, maintained path as of recent Streamlit versions.
- The **`hmac.compare_digest`** password-gate pattern is a lightweight fallback for small internal tools where standing up a full OIDC provider isn't worth it — never compare secrets with `==`, which leaks timing information.

## 🧪 Testing Streamlit Apps

```python
# st.testing.v1.AppTest — run a Streamlit script headlessly and assert on its rendered output
from streamlit.testing.v1 import AppTest

def test_slider_updates_output():
    at = AppTest.from_file("app.py")
    at.run()
    assert at.slider[0].value == 50          # default value

    at.slider[0].set_value(80).run()          # simulate a user interaction, then rerun
    assert "80" in at.markdown[0].value

def test_button_triggers_computation():
    at = AppTest.from_file("app.py")
    at.run()
    at.button[0].click().run()
    assert not at.exception                   # no unhandled errors during the run
    assert at.success[0].value == "Operation succeeded"
```

```bash
pytest tests/test_app.py -v
```

- `AppTest` runs your actual script in a simulated session — no browser, no server — making it possible to **unit-test Streamlit apps in CI** the same way you'd test any other Python code.
- Check `at.exception` after every simulated interaction in a test — a silently swallowed exception in a callback is one of the easiest classes of Streamlit bug to miss without this.

## 🧩 Custom Components

```python
# Wrapping a custom HTML/JS/React frontend as a reusable, bidirectional Streamlit component
import streamlit.components.v1 as components

_component_func = components.declare_component(
    "my_slider", url="http://localhost:3001"   # points at a local dev server during development
)

def my_custom_slider(label, default=0, key=None):
    return _component_func(label=label, default=default, key=key, default=default)

value = my_custom_slider("Custom Widget", default=25)
st.write(f"Value: {value}")
```

```python
# Simpler, one-way embeds (no return value back to Python) via components.html/iframe
components.html("""
    <div id="viz"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
    <script>/* custom D3 visualization */</script>
""", height=400)

components.iframe("https://example.com/embedded-dashboard", height=600)
```

- Build a **full bidirectional custom component** (`declare_component`) only when no existing widget covers the need and the interaction must send data back to Python — most one-off visual embeds are better served by `components.html`.
- The Streamlit Components Gallery/community components (`streamlit-aggrid`, `streamlit-elements`, `streamlit-plotly-events`) cover the vast majority of common "I need a fancier widget" needs without writing a custom component from scratch.

## 🖇️ Callbacks with Arguments & Advanced State

```python
# Passing extra arguments into a callback via args/kwargs
def delete_row(row_id):
    st.session_state.rows = [r for r in st.session_state.rows if r["id"] != row_id]

for row in st.session_state.rows:
    col1, col2 = st.columns([4, 1])
    col1.write(row["name"])
    col2.button("Delete", key=f"del_{row['id']}", on_click=delete_row, args=(row["id"],))

# Nested/structured session state (dicts, dataclasses, custom objects all work)
if "filters" not in st.session_state:
    st.session_state.filters = {"region": "All", "min_amount": 0}

def update_filter(key, value):
    st.session_state.filters[key] = value

st.selectbox(
    "Region", ["All", "US", "EU"],
    index=0, key="region_select",
    on_change=lambda: update_filter("region", st.session_state.region_select)
)

# Programmatically triggering a rerun after modifying state outside a widget callback
if st.button("Reset all filters"):
    st.session_state.filters = {"region": "All", "min_amount": 0}
    st.rerun()
```

- **`args`/`kwargs` on `on_click`/`on_change`** let one callback function serve many dynamically-generated widgets (like a per-row delete button) instead of writing a separate callback per row.
- **`st.rerun()`** is the escape hatch for forcing a fresh top-to-bottom script execution after a state change that a widget callback alone wouldn't trigger — use it sparingly, since overuse can create confusing control flow.

## ⚠️ Common Gotchas

- **The whole script reruns on every widget interaction** — code with side effects (writing files, incrementing counters, API calls) outside of `session_state` guards or caching will re-execute unexpectedly.
- **Widget state resets on rerun unless bound via `key` to `session_state`** or captured through a `st.form`.
- **`st.button` returns `True` only for the single rerun right after the click** — storing "is it clicked" logic that needs to persist across further reruns requires `session_state`, not just the button's return value.
- **`@st.cache_data` requires hashable/serializable arguments** — passing an unhashable object (like an open DB connection) as an argument breaks caching; pass connection objects via `@st.cache_resource` instead, or exclude them from the cache key with a leading underscore (`_conn`).
- **Mutating a `@st.cache_data`-cached DataFrame in place can corrupt the cache** across reruns in older Streamlit versions — treat cached returns as read-only, or explicitly `.copy()`.
- **Without `st.form`, every keystroke in a text input triggers a full rerun** — for multi-field filters, wrap them in a form so the script only reruns on submit.
- **Secrets committed to `secrets.toml` in git** is a common accidental leak — always `.gitignore` it and use the platform's secret manager in production.

## 🎯 Best Practices

- Cache all expensive I/O (`@st.cache_data` for query/API results, `@st.cache_resource` for connections/models) as a default habit, not an afterthought.
- Use `st.form` for any group of inputs that should be applied together, to avoid a rerun per keystroke.
- Structure multipage apps with the `pages/` convention or `st.navigation`/`st.Page` rather than one giant script with manual `if` branching.
- Keep secrets in `.streamlit/secrets.toml` (gitignored) locally and in the platform's secret manager in production — never hardcode credentials.
- Use `st.session_state` deliberately for anything that must survive a rerun; don't rely on module-level globals, which behave inconsistently across sessions.

## 💡 Pro Tips

1. **`st.fragment` is the modern answer to "my whole page reruns for one small interaction"** — scope reruns down instead of restructuring your whole app around callbacks.
2. **`st.connection` handles caching and reconnection for you** — prefer it over hand-rolled `@st.cache_resource` DB clients for supported backends (SQL, Snowflake).
3. **`st.empty()` placeholders let you build progress indicators and "replace this content later" UX** without restructuring your script's control flow.
4. **`run_every` on a fragment turns Streamlit into a lightweight live dashboard** without external polling/websocket code.
5. **`st.data_editor` turns a DataFrame into a spreadsheet-like editable grid** — handy for quick internal tools (approve/reject rows, manual overrides) without building a separate CRUD UI.
6. **Test caching behavior explicitly** — a subtle bug where cached data goes stale (missing `ttl`) is one of the most common "why isn't my dashboard updating" support issues.
7. **`streamlit run app.py --server.runOnSave true`** (or the default hot-reload) speeds up the dev loop enormously — don't restart manually on every edit.
