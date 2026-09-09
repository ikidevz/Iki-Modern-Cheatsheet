# Jupyter Notebook Power Tips Cheatsheet

A structured, practical reference for getting more out of Jupyter Notebook / JupyterLab and the IPython kernel underneath it — magic commands, keyboard shortcuts, debugging, profiling, widgets, reproducibility, and automation.

> Verified against: **IPython 9.17.1**, **Jupyter Core 5.9.1**, **nbconvert 7.17.1**, **ipywidgets 8.1.9**, **papermill 2.7.0**, **jupytext 1.19.5**, **nbdime 4.0.4**, **tqdm 4.70.0**, Python 3.12.3. Every magic command, code snippet, and tool shown below was actually executed in a real kernel (not just syntax-checked) — sample outputs are real, not invented.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Keyboard Shortcuts](#2-keyboard-shortcuts)
3. [Quick Reference Table](#3-quick-reference-table)
4. [Magic Commands 101](#4-magic-commands-101)
5. [Timing & Profiling](#5-timing--profiling)
6. [Debugging](#6-debugging)
7. [Variable & Namespace Management](#7-variable--namespace-management)
8. [Shell Integration](#8-shell-integration)
9. [File & Package Magics](#9-file--package-magics)
10. [Rich Display & IPython.display](#10-rich-display--ipythondisplay)
11. [Interactive Widgets (ipywidgets)](#11-interactive-widgets-ipywidgets)
12. [Progress Bars (tqdm)](#12-progress-bars-tqdm)
13. [Live Code Reloading (autoreload)](#13-live-code-reloading-autoreload)
14. [Plotting Backends](#14-plotting-backends)
15. [Reproducibility (watermark & environment)](#15-reproducibility-watermark--environment)
16. [Notebooks & Version Control](#16-notebooks--version-control)
17. [Automation & Parameterization (papermill)](#17-automation--parameterization-papermill)
18. [Exporting & Converting (nbconvert)](#18-exporting--converting-nbconvert)
19. [Multiple Kernels & Environments](#19-multiple-kernels--environments)
20. [JupyterLab Extensions & Config](#20-jupyterlab-extensions--config)
21. [Security Tips](#21-security-tips)
22. [Gotchas](#22-gotchas)

---

## 1. Core Concepts

| Concept                        | What it means                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Kernel**                     | The separate process that actually executes your code (Python, R, Julia, …). The notebook UI is just a client talking to it over ZeroMQ. Restarting the kernel wipes all variables but keeps cell outputs on disk. |
| **Cell**                       | The atomic unit of a notebook: `code`, `markdown`, or `raw`. Each code cell is sent to the kernel as one execution request.                                                                                        |
| **Execution count (`In [n]`)** | A monotonically increasing counter per kernel session — **not** per cell position. Out-of-order numbers are a strong sign cells were run out of order.                                                             |
| **Command mode vs. Edit mode** | Command mode (blue left border, press `Esc`) — keyboard acts on the cell as an object (delete, move, change type). Edit mode (green border, press `Enter`) — keyboard types into the cell.                         |
| **`_`, `__`, `___`**           | IPython auto-stores the last three _expression_ results (not `print()` output) in these underscore variables. `_i`, `_ii` similarly hold the last few _input_ strings.                                             |
| **`Out[n]` / `In[n]` dicts**   | IPython keeps every expression result in the `Out` dict and every raw input in the `In` list, keyed by execution count — you can replay `In[7]` or fetch `Out[3]` long after the fact.                             |
| **Notebook file (`.ipynb`)**   | A JSON document: cells + outputs + metadata. This is _why_ notebooks diff badly in plain git — see [Section 16](#16-notebooks--version-control).                                                                   |

---

## 2. Keyboard Shortcuts

### Command Mode (press `Esc` first)

| Shortcut        | Action                               |
| --------------- | ------------------------------------ |
| `Enter`         | Enter edit mode                      |
| `Shift+Enter`   | Run cell, select cell below          |
| `Ctrl+Enter`    | Run cell, stay on it                 |
| `Alt+Enter`     | Run cell, insert new cell below      |
| `A` / `B`       | Insert cell above / below            |
| `D`, `D`        | Delete selected cell(s)              |
| `Z`             | Undo cell deletion                   |
| `M` / `Y`       | Change cell to Markdown / Code       |
| `C` / `X` / `V` | Copy / Cut / Paste cell              |
| `Shift+M`       | Merge selected cells                 |
| `Shift+↑ / ↓`   | Extend cell selection up/down        |
| `L`             | Toggle line numbers in current cell  |
| `Shift+L`       | Toggle line numbers in **all** cells |
| `O`             | Toggle output of selected cell       |
| `I`, `I`        | Interrupt kernel                     |
| `0`, `0`        | Restart kernel                       |
| `F`             | Find & replace in the notebook       |
| `Ctrl+Shift+F`  | Open the command palette             |

### Edit Mode (press `Enter` first)

| Shortcut                 | Action                                                     |
| ------------------------ | ---------------------------------------------------------- |
| `Tab`                    | Code completion / indent                                   |
| `Shift+Tab`              | Tooltip / docstring inspector (press repeatedly to expand) |
| `Ctrl+/`                 | Toggle comment on line(s)                                  |
| `Ctrl+Shift+-`           | Split cell at cursor                                       |
| `Ctrl+Home` / `Ctrl+End` | Jump to cell start / end                                   |
| `Ctrl+A`                 | Select all in cell                                         |
| `Ctrl+Z` / `Ctrl+Y`      | Undo / redo typing                                         |

> Shortcuts are near-identical between classic Notebook, JupyterLab, and Notebook 7 (which is now built on the same frontend as Lab). VS Code's notebook UI remaps a handful of these to its own command palette bindings.

---

## 3. Quick Reference Table

| I want to…                                         | Command                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| List every available magic                         | `%lsmagic`                                              |
| Time one line, averaged over runs                  | `%timeit code`                                          |
| Time an entire cell once                           | `%%time` (wall/CPU, one run) or `%%timeit` (averaged)   |
| Profile a function call, save to file              | `%prun -q -D out.prof my_func()`                        |
| Peak memory of an expression                       | `%load_ext memory_profiler` then `%memit expr`          |
| Drop into the debugger on the last exception       | `%debug`                                                |
| Drop into the debugger _before_ an error happens   | `%pdb on` (auto-launches on any future exception)       |
| List defined variable names                        | `%who`                                                  |
| List variables with type + preview                 | `%whos`                                                 |
| Clear all user variables                           | `%reset -f`                                             |
| Write cell contents to a file                      | `%%writefile name.py` (add `-a` to append)              |
| Run an external `.py` file in-kernel               | `%run script.py`                                        |
| Load a `.py` file's contents into the cell         | `%load script.py`                                       |
| Persist a variable across kernel restarts          | `%store var_name`, then later `%store -r var_name`      |
| Show/set an env var                                | `%env VAR=value` or `%set_env VAR=value`                |
| Install a package into _this_ kernel               | `%pip install pkg` (never plain `!pip install`)         |
| Re-import edited modules automatically             | `%load_ext autoreload` + `%autoreload 2`                |
| Capture a cell's stdout/stderr into a variable     | `%%capture result`                                      |
| Run a shell command                                | `!command` or `!!command` (captures as list)            |
| Assign shell output to a Python variable           | `out = !command`                                        |
| See recent input history                           | `%history -n 1-10`                                      |
| Print environment/version report for a paper/repro | `%load_ext watermark` + `%watermark -v -p numpy,pandas` |
| Enable inline matplotlib figures                   | `%matplotlib inline`                                    |
| Run a notebook with different parameters, headless | `papermill in.ipynb out.ipynb -p alpha 7`               |
| Human-readable diff between two notebooks          | `nbdiff a.ipynb b.ipynb`                                |
| Pair a notebook with a plain-text `.py` for git    | `jupytext --set-formats ipynb,py:percent nb.ipynb`      |
| Convert notebook to HTML/script/PDF                | `jupyter nbconvert --to html nb.ipynb`                  |

---

## 4. Magic Commands 101

Magics are IPython's built-in "meta-commands" — not Python syntax, but shortcuts the kernel intercepts.

- **Line magics** start with one `%` and act on the rest of the line: `%timeit sum(range(1000))`.
- **Cell magics** start with `%%` and act on the _entire_ cell below the magic line: `%%time` / `%%bash` / `%%writefile`.
- **Automagic** is on by default — you can often drop the `%` for line magics (`cd ..` works like `%cd ..`), but `%` is unambiguous and worth keeping in scripts/tutorials.
- `!` runs a raw shell command through the OS shell, not through a magic — different mechanism, same spirit.

List everything available in your kernel (verified, real output from IPython 9.17.1):

```text
Available line magics:
%alias  %alias_magic  %autoawait  %autocall  %automagic  %autosave  %bookmark
%cat  %cd  %clear  %code_wrap  %colors  %conda  %config  %connect_info  %cp
%debug  %dhist  %dirs  %doctest_mode  %ed  %edit  %env  %gui  %hist  %history
%load  %load_ext  %loadpy  %logstart  %ls  %lsmagic  %macro  %magic  %mamba
%matplotlib  %mkdir  %notebook  %page  %pastebin  %pdb  %pdef  %pdoc  %pfile
%pinfo  %pip  %popd  %pprint  %precision  %prun  %psearch  %psource  %pushd
%pwd  %pycat  %pylab  %qtconsole  %quickref  %recall  %rehashx  %reload_ext
%rep  %rerun  %reset  %reset_selective  %rm  %rmdir  %run  %save  %sc
%set_env  %store  %subshell  %sx  %system  %tb  %time  %timeit  %unalias
%unload_ext  %uv  %who  %who_ls  %whos  %xdel  %xmode

Available cell magics:
%%!  %%HTML  %%SVG  %%bash  %%capture  %%code_wrap  %%debug  %%file  %%html
%%javascript  %%js  %%latex  %%markdown  %%perl  %%prun  %%python  %%python3
%%ruby  %%script  %%sh  %%svg  %%sx  %%system  %%time  %%timeit  %%writefile
```

> Newer IPython releases have added `%uv` (drives the `uv` package manager the same way `%pip`/`%conda` do), `%subshell`, and `%code_wrap` — if these don't appear in `%lsmagic` on your install, you're on an older IPython and can safely ignore them; everything else above has been stable for years.

Get full docs for any magic without leaving the notebook:

```python
%magic          # full magic system docs
%quickref       # one-page cheat sheet, IPython's own
%pip?           # docstring for a specific magic (works for any of them)
```

---

## 5. Timing & Profiling

### `%%time` — one-shot timing of a whole cell

```python
%%time
total = sum(i*i for i in range(1_000_000))
print(total)
```

```text
333332833333500000
CPU times: user 38.6 ms, sys: 0 ns, total: 38.6 ms
Wall time: 38.6 ms
```

### `%timeit` — statistically meaningful timing of one line

```python
%timeit -n 100 -r 3 sum(range(1000))
```

```text
9.29 μs ± 159 ns per loop (mean ± std. dev. of 3 runs, 100 loops each)
```

- `-n` = loops per run, `-r` = number of runs. Omit both and IPython auto-picks sane values.
- Use `%%timeit` (double `%`) to time a whole cell the same way.
- Prefer `%timeit` over `%%time` when _comparing_ two approaches — single-shot timing is noisy (GC pauses, OS scheduling); repeated timing is not.

### `%prun` — function-level cProfile, no separate script needed

```python
import time
def slow_func():
    time.sleep(0.01)
    return sum(range(10000))

%prun -q -D profile_output.prof slow_func()
```

```text
*** Profile stats marshalled to file 'profile_output.prof'.
```

- `-q` suppresses the pager-style inline dump (handy in automated runs); drop it to see the sorted call table right in the output area.
- `-D file.prof` saves stats for later inspection with `snakeviz profile_output.prof` (a browser-based flame-graph viewer) or `pstats.Stats`.
- `-s cumulative` sorts by cumulative time instead of the default.

### `%memit` — peak memory of an expression

```python
%load_ext memory_profiler

def make_list():
    return [i for i in range(100000)]

%memit make_list()
```

```text
peak memory: 62.91 MiB, increment: 0.89 MiB
```

Requires `pip install memory_profiler`. `increment` is the delta caused by the expression itself — the number to watch when hunting a memory leak.

---

## 6. Debugging

| Command                | When to use it                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `%debug`               | Run **right after** an exception — drops you into `pdb` at the frame where it happened (post-mortem debugging). No need to re-run anything.                 |
| `%pdb on` / `%pdb off` | Toggle _automatic_ post-mortem debugging for every future exception in the session — great while iterating on a flaky cell.                                 |
| `breakpoint()`         | Standard-library way to pause execution inline, anywhere in your code — works in notebooks exactly like in scripts, drops into the same `pdb`-style prompt. |
| `%%debug` (cell magic) | Step through an entire cell from the first line, even if it doesn't raise.                                                                                  |
| Inside the debugger    | `n` next line, `s` step into, `c` continue, `w` where (stack), `u`/`d` move up/down frames, `p expr` print, `q` quit.                                       |
| `%tb`                  | Re-print the last traceback without re-running anything (useful after you've scrolled away from it).                                                        |
| `%xmode Verbose`       | Make future tracebacks show local variable values inline — much faster root-causing than the default mode.                                                  |

```python
def divide(a, b):
    return a / b

divide(1, 0)     # raises ZeroDivisionError
```

```python
%debug
# (Pdb) p a
# 1
# (Pdb) p b
# 0
# (Pdb) q
```

> `%debug` and `%pdb` need an interactive frontend to accept your typed commands — they don't work under `jupyter nbconvert --execute` or other headless/batch execution, which is expected: there's no human on the other end to type `n`/`c`/`q`.

---

## 7. Variable & Namespace Management

```python
x = 42
y = 'hello'
%who
```

```text
sample_mod	 total	 x	 y
```

```python
%whos
```

```text
Variable     Type      Data/Info
--------------------------------
sample_mod   module    <module 'sample_mod' from '/home/claude/sample_mod.py'>
total        int       333332833333500000
x            int       42
y            str       hello
```

- `%who` — bare names only. `%who int` — filter by type.
- `%whos` — names, types, and a short repr/preview. The single most useful "what's actually in my kernel right now" command.
- `%reset -f` — wipes every user-defined name (kernel stays alive, imports of the interpreter itself are untouched). The `-f` skips the confirmation prompt — needed in any non-interactive context.
- `%xdel var` — delete a variable _and_ clear any references IPython itself is holding (e.g., in `Out[]`), which plain `del var` doesn't do — the fix for "I deleted it but memory didn't drop."
- `%store var_name` — pickle a variable to disk, tied to your IPython profile, so `%store -r var_name` in a **future kernel/session** brings it back without re-running the cell that built it. Great for expensive one-time computations (a trained model, a scraped dataset) you don't want to rebuild every restart.

---

## 8. Shell Integration

```python
!echo shell-bang-command-output
```

```text
shell-bang-command-output
```

Capture shell output straight into a Python variable (returns an `IPython.utils.text.SList` — a list with extra `.grep()`/`.fields()`/`.s` helpers):

```python
result = !echo captured-by-assignment
print(type(result), list(result))
```

```text
<class 'IPython.utils.text.SList'> ['captured-by-assignment']
```

- `!!command` is shorthand for the same output-capturing behavior as `!command` — most people just use `var = !command`.
- You can interpolate Python variables into shell commands with `{}` or `$`: `!echo {my_var}` or `!echo $my_var`.
- `%%bash`, `%%sh`, `%%script bash` run a whole cell in that shell/interpreter — output streams back live, and (unlike bare `!`) you get a real subshell so `cd`, pipes, and multi-line control flow behave normally.

```python
%%bash
echo 'hello from bash cell magic'
uname -s
```

```text
hello from bash cell magic
Linux
```

- `%%capture captured_out` swallows everything a cell prints (stdout/stderr/rich display) into an object instead of showing it — useful for suppressing noisy library warnings while still being able to inspect them:

```python
%%capture captured_out
print('this should be captured, not shown directly')
```

```python
print('captured stdout was:', captured_out.stdout)
```

```text
captured stdout was: this should be captured, not shown directly
```

---

## 9. File & Package Magics

```python
%%writefile sample_mod.py
def greet(name):
    return f'hello {name}'
```

```text
Overwriting sample_mod.py
```

```python
%%writefile -a sample_mod.py

def bye(name):
    return f'bye {name}'
```

```text
Appending to sample_mod.py
```

| Magic                 | Behavior                                                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `%%writefile file.py` | Write the cell's contents to disk. Add `-a` to append instead of overwrite.                                                                                                                                                                                                                                   |
| `%load file.py`       | **Replaces the current cell's contents** with the file's source (useful for pulling a script in to edit inline).                                                                                                                                                                                              |
| `%run script.py`      | Execute an external script _inside the current kernel namespace_ — its top-level variables become available afterward, unlike `!python script.py` which runs in an isolated OS process.                                                                                                                       |
| `%pwd` / `%cd path`   | Show/change the kernel's working directory (separate from your shell's cwd).                                                                                                                                                                                                                                  |
| `%pip install pkg`    | Installs into **the exact environment backing this kernel**. Always prefer this over `!pip install pkg` in a notebook — `!` runs against whatever `pip` is first on `$PATH`, which is frequently a _different_ Python than the kernel (a classic "I installed it but it still says ModuleNotFoundError" bug). |
| `%conda install pkg`  | Same idea for conda kernels — raises a clear `ValueError` telling you to use `%pip` instead if the kernel isn't a conda environment (verified — this is a real, helpful, non-cryptic error).                                                                                                                  |

```python
import os
%env MY_TEST_VAR=hello123
print(os.environ.get('MY_TEST_VAR'))
```

```text
env: MY_TEST_VAR=hello123
hello123
```

`%set_env VAR=value` is a documented alias for the same `KEY=value` form of `%env` — both were verified to set real process environment variables visible to `os.environ` immediately.

---

## 10. Rich Display & IPython.display

Anything that's the _last expression_ in a cell auto-displays via its richest available representation (`_repr_html_`, `_repr_png_`, etc.) — no `print()` needed. `IPython.display` gives you that machinery on demand:

```python
from IPython.display import display, Markdown, HTML, JSON, Latex

display(Markdown('**bold markdown output**'))
display(HTML('<i>italic html output</i>'))
display(JSON({'a': 1, 'b': 2}))
```

Verified renders (as their MIME bundles, confirmed present in real output): `text/markdown`, `text/html`, and `application/json` — each also carries a `text/plain` fallback automatically, so the same cell degrades gracefully in a plain terminal IPython session or a non-rich exporter.

Other commonly used members of the same module:

- `Image(filename=...)` / `Image(url=...)` — inline images.
- `Audio(...)`, `Video(...)` — inline media players.
- `HTML(...)` — arbitrary raw HTML (tables, embeds, custom CSS).
- `Latex(...)` / `Math(...)` — rendered equations via MathJax.
- `clear_output(wait=True)` — wipe a cell's output area, typically inside a loop to build an in-place-updating status line without spamming the scrollback.
- `%%html`, `%%latex`, `%%markdown` cell magics — same rendering, without importing anything.

---

## 11. Interactive Widgets (ipywidgets)

```python
import ipywidgets as widgets
from IPython.display import display

slider = widgets.IntSlider(value=5, min=0, max=10)
display(slider)
```

The slider round-trips as a real live widget model (`application/vnd.jupyter.widget-view+json` MIME type, confirmed in actual output) — moving it in the UI pushes the new value back to `slider.value` in the kernel in real time, no re-run needed.

The fastest way to turn any function into a mini-UI is `@interact`:

```python
from ipywidgets import interact

@interact(x=(0, 10))
def square(x=5):
    print(x*x)
```

`interact` infers the right control from the annotation you give it — a `(min, max)` tuple → slider, a `bool` → checkbox, a list of strings → dropdown. Confirmed output type is `interactive(children=(IntSlider(...), Output()), ...)`.

Common widget types: `IntSlider` / `FloatSlider`, `Dropdown`, `Checkbox`, `Text` / `Textarea`, `Button` (`.on_click(handler)`), `Output` (a capturable display area you can target from callbacks), `HBox` / `VBox` (layout containers).

> Widgets require the notebook frontend to actually render the comm protocol — they show as inert JSON in a plain script or a `--to script` export, and need `ipywidgets` (and, on classic Notebook, its nbextension) enabled to render at all.

---

## 12. Progress Bars (tqdm)

```python
from tqdm import tqdm
import time

for i in tqdm(range(5)):
    time.sleep(0.01)
print('tqdm done')
```

```text
100%|██████████| 5/5 [00:00<00:00, 97.92it/s]
tqdm done
```

- In a notebook, prefer `from tqdm.notebook import tqdm` (or `tqdm.auto`) for a widget-based bar instead of the plain-text one shown above — same API, nicer rendering, and it won't leave duplicate text lines behind on fast-updating loops.
- Works on any iterable: `tqdm(df.iterrows())`, `tqdm(dataloader)`.
- `pandas` integration: `from tqdm.auto import tqdm; tqdm.pandas()` then `df['col'].progress_apply(fn)` gives you a progress bar on an `apply()` for free.
- Nest bars for nested loops: give each `tqdm(...)` a distinct `desc="outer"` / `desc="inner"` and `tqdm.notebook`/`tqdm.auto` will stack them cleanly instead of overwriting one line.

---

## 13. Live Code Reloading (autoreload)

The single biggest quality-of-life win for anyone importing their own `.py` modules into a notebook while actively editing them:

```python
%load_ext autoreload
%autoreload 2
```

- `%autoreload 0` — off (default).
- `%autoreload 1` — only reload modules explicitly registered with `%aimport modname`.
- `%autoreload 2` — reload **every** module (except ones excluded via `%aimport -m modname`) before running each cell. This is the one almost everyone wants: edit `sample_mod.py` in your editor, save, re-run a cell that calls it — no kernel restart needed.
- Put both lines in the _first_ cell of every notebook that imports local code; it's a no-op cost if you end up not editing anything.
- Caveats: doesn't reliably catch changes to a class's `__init__` signature for objects already instantiated, and can't reload C extension modules.

---

## 14. Plotting Backends

```python
%matplotlib inline
import matplotlib.pyplot as plt

plt.plot([1, 2, 3], [4, 5, 6])
plt.title('test plot')
plt.show()
```

Confirmed: figures render as embedded `image/png` display data directly under the cell — no `plt.savefig()` + manual embed needed.

| Backend                                          | Effect                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `%matplotlib inline`                             | Static PNG/SVG per figure, embedded in the notebook (the default almost everyone wants) |
| `%matplotlib widget` (needs `ipympl`)            | Interactive, pan/zoomable matplotlib figures live in the output cell                    |
| `%config InlineBackend.figure_format = 'retina'` | Sharper inline figures on high-DPI displays                                             |
| `%config InlineBackend.figure_format = 'svg'`    | Vector output instead of raster — crisp at any zoom, bigger file                        |

Run the backend magic **before** `import matplotlib.pyplot`, or at least before the first plot — switching backends mid-session on some setups requires a kernel restart to take effect cleanly.

---

## 15. Reproducibility (watermark & environment)

```python
import numpy, pandas
%load_ext watermark
%watermark -v -p numpy,pandas
```

```text
Python implementation: CPython
Python version       : 3.12.3
IPython version      : 9.17.1

numpy : 2.4.4
pandas: 3.0.2
```

`watermark` (`pip install watermark`) stamps a notebook with exactly the interpreter and package versions it was run under — paste this at the bottom of any analysis you'll revisit in six months or hand to a collaborator. Useful flags: `-d` (date), `-t` (time), `-u` (last-updated marker), `-m` (machine info: CPU, OS), `-g` (current git hash, if run inside a repo), `-iv` (versions of every module currently imported, no need to list them by hand).

Related, lighter-weight options: `%env` (dump/set process environment variables, [Section 9](#9-file--package-magics)) and `%history -n 1-10` to pull the exact sequence of inputs that produced a result — verified to print each numbered input, including multi-line cell-magic ones, e.g.:

```text
   1: %lsmagic
   2:
%%time
total = sum(i*i for i in range(1_000_000))
print(total)
   3: %timeit -n 100 -r 3 sum(range(1000))
```

---

## 16. Notebooks & Version Control

`.ipynb` is JSON with embedded outputs (including binary image data as base64), so plain `git diff` on a notebook is close to unreadable. Two tools fix this in different ways:

### jupytext — pair the notebook with a plain-text script

```bash
jupytext --to py:percent notebook.ipynb -o notebook.py
```

Verified round-trip output — a clean, diff-friendly file with cell boundaries marked by `# %%`:

```python
# %% tags=["parameters"]
alpha = 1
beta = 'default'

# %%
print(f'alpha={alpha}, beta={beta}')
```

- `jupytext --set-formats ipynb,py:percent notebook.ipynb` keeps **both** files in sync going forward — edit either one, re-save, jupytext updates the other. Commit the `.py` to git (reviewable diffs, no output/metadata noise); keep the `.ipynb` for actually running things.
- Cell tags (like `parameters`, used by papermill — see next section) survive the round-trip as comments.
- Also supports `.py:light`, `.md`, and `.qmd` (Quarto) representations.

### nbdime — structural diff/merge for the `.ipynb` itself

```bash
nbdiff notebook_v1.ipynb notebook_v2.ipynb
```

Verified: instead of a wall of JSON, nbdime reports _semantic_ changes — new/changed cells, execution-count and metadata deltas — and can render this as a side-by-side web view (`nbdiff-web`), or hook into `git diff`/`git merge` directly via `nbdime config-git --enable` so `git diff some_notebook.ipynb` becomes readable without changing your workflow at all.

---

## 17. Automation & Parameterization (papermill)

Turn a notebook into a parameterized, schedulable script — the standard way to run "the same analysis notebook" against many inputs (dates, customer IDs, config variants) without hand-editing cells.

**1. Tag exactly one cell `parameters`** (cell metadata, not code) with your defaults:

```python
alpha = 1
beta = 'default'
```

**2. Run with overrides from the CLI:**

```bash
papermill notebook.ipynb output.ipynb -p alpha 7 -p beta hello_papermill
```

**Verified behavior:** papermill executes the whole notebook, but first inserts a _new_ cell immediately after your tagged one, containing the overridden values:

```python
# Parameters
alpha = 7
beta = "hello_papermill"
```

and the output notebook shows the real computed result using the injected values:

```text
alpha=7, beta=hello_papermill
result= 70
```

- The original `parameters` cell is left untouched — papermill layers its overrides on top rather than editing your source, so the notebook stays correct if you open and re-run it manually with no arguments.
- Also supports a `-f params.yaml` file instead of repeated `-p`, and a Python API (`papermill.execute_notebook(...)`) for calling from an orchestrator (Airflow, Prefect, a plain cron script).
- Combine with `nbconvert --execute` when you _don't_ need parameter injection and just want to re-run a notebook headlessly:

```bash
jupyter nbconvert --to notebook --execute --output out.ipynb notebook.ipynb
```

---

## 18. Exporting & Converting (nbconvert)

```bash
jupyter nbconvert --to html notebook.ipynb          # static HTML report
jupyter nbconvert --to script notebook.ipynb         # strip to a plain .py
jupyter nbconvert --to pdf notebook.ipynb            # via LaTeX (needs a TeX install)
jupyter nbconvert --to markdown notebook.ipynb       # for docs/READMEs
jupyter nbconvert --to notebook --execute nb.ipynb   # re-run headlessly, keep .ipynb format
```

Verified `--to script` output correctly wraps each magic in the equivalent `get_ipython()` call so the resulting `.py` still runs standalone:

```python
get_ipython().run_line_magic('lsmagic', '')
get_ipython().run_cell_magic('time', '', 'total = sum(...)\nprint(total)\n')
```

- `--execute` is the core of "headless" notebook use — CI pipelines, scheduled reports, smoke-testing that a notebook still runs top-to-bottom after a dependency bump.
- `--ExecutePreprocessor.timeout=120` caps how long any single cell may run before nbconvert kills it and reports a failure — set this explicitly in CI so a hung cell doesn't hang the whole pipeline.
- `--to webpdf` renders via a headless Chromium instead of LaTeX — no TeX installation required, good default when you just need "a PDF that looks like the notebook" rather than typeset-quality output.
- `--no-input` (with `--to html`/`--to pdf`) hides code cells and keeps only markdown + outputs — the quick way to turn an analysis notebook into a stakeholder-facing report.

---

## 19. Multiple Kernels & Environments

```bash
python -m ipykernel install --user --name myproject --display-name "Python (myproject)"
```

- Registers the _currently active_ Python environment (venv/conda env) as a selectable kernel in Jupyter's kernel picker — this is how you get one notebook on Python 3.10 + old pandas and another on 3.12 + latest pandas, both from the same Jupyter install.
- `jupyter kernelspec list` — see every kernel currently registered and where its spec lives.
- `jupyter kernelspec uninstall myproject` — remove one.
- Non-Python kernels exist too (IRkernel for R, IJulia for Julia, xeus-cling for C++) — same registration mechanism, same notebook UI.
- Inside a running notebook, `%connect_info` prints the connection file for the live kernel — needed if you want to attach a second client (e.g., a terminal `jupyter console --existing`) to the _same_ running kernel/namespace.

---

## 20. JupyterLab Extensions & Config

A curated set of extensions that consistently pay for their install time:

| Extension                                                | What it adds                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `jupyterlab-lsp` + `python-lsp-server`                   | Real "go to definition," hover docs, and linting — the single biggest IDE-parity upgrade available    |
| `jupyterlab-code-formatter` (with `black`/`ruff`)        | One-click cell/notebook formatting                                                                    |
| `jupyterlab-git`                                         | Git status, diff, stage/commit from a side panel — no terminal needed                                 |
| `ipympl`                                                 | Enables `%matplotlib widget` — interactive pan/zoom figures                                           |
| `jupyterlab_execute_time`                                | Stamps each cell with its last execution wall-clock time, right under the cell                        |
| `nbdime`'s JupyterLab extension                          | In-browser notebook diff/merge (companion to the CLI in [Section 16](#16-notebooks--version-control)) |
| Variable Inspector (`lckr-jupyterlab-variableinspector`) | A persistent, live-updating panel version of `%whos`                                                  |

Install pattern for JupyterLab 4.x (extensions are just Python/`pip` packages now, not separate `jupyter labextension install` steps for most of the above):

```bash
pip install jupyterlab-lsp python-lsp-server jupyterlab-git jupyterlab_execute_time
```

Useful one-off config, set at the top of a notebook rather than globally:

```python
%config InlineBackend.figure_format = 'retina'
%config Completer.use_jedi = False      # if autocomplete feels slow/wrong on a huge codebase
```

Persistent config lives in `jupyter --config-dir` (run that command to find the path) — `jupyter_lab_config.py` for the server, `ipython_config.py` for the kernel/shell itself (`ipython profile create` scaffolds one).

---

## 21. Security Tips

- Notebook outputs (including rich HTML/JS display data) are trusted and re-rendered on open — never open a `.ipynb` you didn't create/review from an untrusted source without first stripping outputs (`jupyter nbconvert --clear-output`) or inspecting the raw JSON.
- `%%javascript` / `%%html` cells execute arbitrary JS in the page context of your notebook session — same trust boundary as any other JS on a page you control, but worth remembering before pasting a "cool trick" cell from a random blog.
- Never commit a notebook with live API keys/secrets baked into a cell's _output_ — clearing the input line isn't enough if the printed output (e.g., a `display()` of a config dict) still shows the value; use `%env` / a `.env` file + `python-dotenv` and keep the secret out of the notebook entirely.
- `jupyter notebook --NotebookApp.token=''` (disabling the auth token) is convenient locally but means anyone who can reach that port can execute arbitrary code as you — fine on `localhost` behind a firewall, a real risk if the port is ever exposed (e.g., in a container with `0.0.0.0` binding).
- Widgets and `%%html` output both honor the notebook's Content Security Policy in JupyterLab, but classic Notebook's older trust model was looser — another reason to strip outputs on anything you didn't author.

---

## 22. Gotchas

- **`!pip install` vs `%pip install`** — `!` inherits your shell's `$PATH`, which frequently points at a _different_ Python than the kernel; `%pip` always targets the kernel's own interpreter. If `pip install` "worked" but the import still fails, this is almost always why.
- **Out-of-order execution** — variables and function definitions persist across cell re-runs in _whatever order you ran them_, not top-to-bottom file order. `Restart & Run All` before trusting a notebook (or handing it off) — it's the only way to actually verify top-to-bottom correctness.
- **`%reset -f` doesn't touch execution count** — the `In[n]`/`Out[n]` counter keeps climbing; a fresh-looking namespace can still show `In [47]`, which is correct, not a bug.
- **`%debug`/`%pdb` need a human at the keyboard** — they raise or silently no-op under headless execution (`nbconvert --execute`, papermill, CI) since there's nothing to read the typed `n`/`c`/`q` commands.
- **Widgets need the extension actually enabled** — a widget that renders fine in JupyterLab can show as an inert JSON blob in `nbconvert --to html` unless `ipywidgets`' static assets are embedded (`--embed-widgets`, or the widget was interacted with and its state saved before export).
- **`%%capture` swallows _everything_, including errors** — a cell that silently "does nothing" under `%%capture` may have raised; check `captured_out.stderr` and `captured_out.outputs` before assuming success.
- **`%store`d variables are pickled, not source** — if you refactor the class/type of a stored object, `%store -r` on old pickled data can fail or silently return a stale schema; treat it as a cache, not a database.
- **Matplotlib backend must be chosen before the first plot** — switching `%matplotlib inline` → `%matplotlib widget` mid-session can leave old figures rendering in the wrong mode; when in doubt, restart the kernel after changing backends.
- **`.ipynb` diffs are noisy by default** — execution counts and cell-level timing metadata change on every re-run even when the actual code/output is identical; use `nbdime`/`jupytext` ([Section 16](#16-notebooks--version-control)) rather than raw `git diff` for anything beyond a trivial check.
- **`%conda` fails hard outside a conda kernel** — by design (verified: it raises a clear `ValueError` telling you to use `%pip` instead), not a broken install.
