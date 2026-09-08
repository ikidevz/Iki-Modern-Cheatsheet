# Iki's Modern Cheatsheets

A self-hosted, searchable index for a personal library of data-engineering cheatsheets — built with Next.js. It doesn't just link out to files; every sheet is tracked with a review status, a plain-language summary of what it covers, a list of concrete issues found while reading it, and a list of topics worth adding.

Think of it less as a wiki and more as a **working audit dashboard**: some sheets are written and vetted line-by-line (`solid`), some are written but have a known problem worth revisiting (`flagged`), and some are fully scoped but not written yet (`planned`).

## Features

- **Status-tracked catalog** — every entry carries a `solid` / `flagged` / `planned` status shown as a colored dot everywhere it appears (sidebar, overview, item page).
- **Two-mode item pages** — a written sheet renders its actual Markdown body; an unwritten one falls back to a structured "Planned scope" / "Should include" view generated straight from the catalog metadata, so the same page works whether or not the content exists yet.
- **Category & subcategory navigation** — the catalog contains 10 categories and 87 entries. Most categories are flat; **Design Patterns** is nested (Creational / Structural / Behavioural), each with its own overview page before drilling into an individual pattern.
- **Live sidebar search** — filters sheets and subcategory groups by name, tagline, or source filename as you type, with collapsible category groups and a slide-out drawer on mobile.
- **23 built-in themes** (10 light, 13 dark) switchable from the sidebar, persisted to `localStorage`, applied via a pre-hydration script so there's no flash of the wrong theme on load, and falling back to the OS `prefers-color-scheme` on first visit.
- **Markdown rendering pipeline** with GitHub-flavored Markdown (tables, task lists), auto-linked headings, and syntax-highlighted code blocks (light/dark aware) via `rehype-pretty-code`.
- **Live overview stats** — the homepage counts total pages and how many are solid / flagged / planned directly from the catalog, so the numbers can't drift out of sync with the data.

## Content model

All catalog metadata lives in one place: [`content/data.ts`](content/data.ts), typed by [`lib/types.ts`](lib/types.ts).

```
Category
├── FlatCategory        { key, label, items: Sheet[] }
└── NestedCategory       { key, label, slug, subcategories: Subcategory[] }
                                              └── Subcategory { key, label, slug, status, tagline, covers, items: Sheet[] }
```

Current catalog categories:

| Category                     | Contents                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Data warehouses & databases  | Snowflake, PostgreSQL, MySQL, SQLAlchemy                                                                    |
| Python data libraries        | Pandas, Polars, PySpark                                                                                     |
| Infrastructure               | dbt, Kafka, Redis, Terraform, Docker                                                                        |
| Data science & statistics    | A/B Testing, Clustering, Python One-Liners, Data Visualization, Math & Statistics, EDA, Feature Engineering |
| Data Structures & Algorithms | 11 algorithm and data-structure references                                                                  |
| Engineering fundamentals     | Data Engineering Patterns, FastAPI, Regex                                                                   |
| ETL / ELT                    | 13 reference topics plus Worked Examples                                                                    |
| Data Modeling                | 10 core modeling topics plus Examples                                                                       |
| Design Patterns              | 20 patterns across Creational, Structural, and Behavioural                                                  |
| AWS for data engineering     | 9 AWS services and supporting patterns                                                                      |

Every leaf is a `Sheet`:

| Field                 | Meaning                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | Stable catalog identifier used for routes, search, and customized component lookup.                                                                             |
| `name`                | Display name.                                                                                                                                                   |
| `file`                | Markdown body path relative to `content/sheets/`, when the entry is Markdown-backed (for example `AWS/S3.md` or `Data Modeling/01-fundamentals.md`).            |
| `slug`                | URL segment, only needed for items inside a nested category (flat categories derive it from `id`).                                                              |
| `status`              | `'solid' \| 'flagged' \| 'planned'`.                                                                                                                            |
| `tagline`             | One-line summary shown in lists and at the top of the item page.                                                                                                |
| `covers`              | A short paragraph describing what the sheet actually contains.                                                                                                  |
| `fixes`               | Concrete problems found in the sheet (wrong/deprecated API, a bug in a sample query, etc.) — rendered as a "Worth fixing" list. Empty array if nothing's wrong. |
| `extend`              | Topics the sheet is missing and could grow to cover — rendered as "Could extend" (or "Should include" for planned sheets).                                      |
| `customizedComponent` | Whether the entry is rendered by a React component in `content/customize/` instead of ordinary Markdown.                                                        |
| `body`                | Not set in the data file — populated at request time from disk for Markdown-backed entries (see below).                                                         |

Flat-category item ids sometimes carry a redundant category prefix so they read well in the data file (e.g. `dsa-graphs`); [`lib/content.ts`](lib/content.ts) strips it for the URL so routes stay clean (`/dsa/graphs`, not `/dsa/dsa-graphs`). Nested entries define their own `slug` and are addressed through the parent category and subcategory.

## How a sheet gets its content

[`lib/get-sheet-body.ts`](lib/get-sheet-body.ts) is the only place in the app that loads Markdown from the filesystem. For a Markdown-backed item, it reads the path in the catalog's `file` field relative to `content/sheets/`:

- **Found** → the raw Markdown is passed through the [rendering pipeline](lib/markdown.tsx) and shown as the page body.
- **Not found** → returns `null`, and the page falls back to the "Planned scope" view built entirely from `covers` / `fixes` / `extend` in `content/data.ts`.

The repository currently contains 114 Markdown files. They are organized into root sheets and nested collections for AWS, ETL/ELT, Data Modeling, Data Structures and Algorithms, Design Patterns, and Data Visualization. The ETL/ELT collection includes 13 reference sheets, an index, and 10 worked examples; Data Modeling includes 10 core sheets and 20 domain examples.

Entries with `customizedComponent: true` use a component registered in [`content/customize/index.ts`](content/customize/index.ts). The customized pages currently cover A/B Testing, Clustering, Data Engineering Patterns, EDA, Feature Engineering, Math & Statistics, and Data Modeling Examples.

## Project structure

```
app/
├── layout.tsx              # Shell: fonts, theme-init script, sidebar + main
└── [[...slug]]/page.tsx    # Single catch-all route; resolves to overview / category / subcategory / item

components/
├── overview.tsx            # Homepage: live stats + full catalog listing
├── category-view.tsx        # Flat category page (e.g. /py)
├── subcategory-view.tsx     # Nested subcategory page (e.g. /design-patterns/creational)
├── item-view.tsx            # Individual sheet page (written or planned)
├── sidebar.tsx               # Nav, search, theme switcher, mobile drawer
├── sheet-row.tsx             # Shared list row used on overview/category pages
├── markdown-content.tsx      # Wraps renderMarkdown() as a component
├── code-block-chrome.tsx     # Language label / chrome around fenced code
├── theme-switcher.tsx        # Theme picker dropdown
└── ui/                       # shadcn/ui primitives (button, select)

content/
├── data.ts                   # The entire catalog — the source of truth
├── customize/                # React-rendered pages and supporting data/controls
└── sheets/
    ├── AWS/                  # AWS service sheets
    ├── Data Modeling/        # Modeling fundamentals and 20 examples
    ├── Data Structure and Algo/
    ├── Design Patterns/
    ├── ETLxELT/              # ETL/ELT reference and worked examples
    ├── Data Visualization/
    └── *.md                  # Root-level sheets

lib/
├── types.ts                  # Category/Sheet/Subcategory types, status helpers
├── content.ts                 # Flattens DATA for search/sidebar, resolves URL segments
├── get-sheet-body.ts          # Reads content/sheets/<id>.md
├── markdown.tsx                # unified/remark/rehype → React pipeline
├── themes.ts                   # All 23 theme definitions + DARK_THEMES set
├── apply-theme.ts               # Applies/persists theme, pre-hydration init script
├── fonts.ts                     # next/font setup (IBM Plex Sans/Mono)
└── utils.ts                     # cn() classname helper
```

## Getting started

Requires Node.js and a package manager of your choice.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Script           | Does what                  |
| ---------------- | -------------------------- |
| `npm run dev`    | Start the dev server       |
| `npm run build`  | Production build           |
| `npm run start`  | Serve the production build |
| `npm run lint`   | `biome check`              |
| `npm run format` | `biome format --write`     |

## Adding a new sheet

1. Open `content/data.ts` and add a `Sheet` object to the right category's `items` array (or a subcategory's `items`, for Design Patterns). Fill in `id`, `name`, `status`, `tagline`, `covers`, `fixes`, and `extend`.
2. For a Markdown-backed entry, set `file` to the exact path relative to `content/sheets/`, including any directory (for example `ETLxELT/02-extract.md`). The file name does not need to match `id`.
3. If the entry belongs to a nested category, also set its `slug`.
4. For a custom React page, set `customizedComponent: true` and register the component in [`content/customize/index.ts`](content/customize/index.ts). Use the async registry for components that need asynchronous rendering.
5. Flip `status` to `'solid'` once it has been reviewed, or leave it `'flagged'` if `fixes` still has open items. Use `'planned'` when the scope is defined but the page is not complete.

## Adding a theme

Add an entry to the `THEMES` array in `lib/themes.ts` with a unique `key`, a display `label`, a `swatch` color for the picker, and a `vars` map of CSS custom properties (background, foreground, accents, category dot colors, status colors — see an existing theme for the full property list). If it's a dark theme, also add its `key` to the `DARK_THEMES` set in the same file so `.dark` gets toggled and the syntax-highlighting theme switches accordingly.

## Tech stack

- **Next.js 16** (App Router, single catch-all route, static params pre-generated for every catalog entry)
- **React 19** with the React Compiler enabled (`next.config.ts`)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** components on top of `@base-ui/react`
- **unified / remark / rehype** for Markdown → React, with `rehype-pretty-code` for syntax highlighting and `rehype-slug` + `rehype-autolink-headings` for anchor links
- **Biome** for linting and formatting
- **lucide-react** for icons

## Deploying

This is a stock Next.js app, so it deploys anywhere Next.js does — the least-friction option is [Vercel](https://vercel.com/new).
