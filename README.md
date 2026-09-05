# Iki's Modern Cheatsheets

A self-hosted, searchable index for a personal library of data-engineering cheatsheets — built with Next.js. It doesn't just link out to files; every sheet is tracked with a review status, a plain-language summary of what it covers, a list of concrete issues found while reading it, and a list of topics worth adding.

Think of it less as a wiki and more as a **working audit dashboard**: some sheets are written and vetted line-by-line (`solid`), some are written but have a known problem worth revisiting (`flagged`), and some are fully scoped but not written yet (`planned`).

## Features

- **Status-tracked catalog** — every entry carries a `solid` / `flagged` / `planned` status shown as a colored dot everywhere it appears (sidebar, overview, item page).
- **Two-mode item pages** — a written sheet renders its actual Markdown body; an unwritten one falls back to a structured "Planned scope" / "Should include" view generated straight from the catalog metadata, so the same page works whether or not the content exists yet.
- **Category & subcategory navigation** — most categories are a flat list of sheets; **Design Patterns** is nested (Creational / Structural / Behavioural), each with its own overview page before drilling into an individual pattern.
- **Live sidebar search** — filters sheets and subcategory groups by name, tagline, or source filename as you type, with collapsible category groups and a slide-out drawer on mobile.
- **15 built-in themes** (6 light, 9 dark) switchable from the sidebar, persisted to `localStorage`, applied via a pre-hydration script so there's no flash of the wrong theme on load, and falling back to the OS `prefers-color-scheme` on first visit.
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

Every leaf is a `Sheet`:

| Field     | Meaning                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | Stable identifier. Also the filename `getSheetBody` looks for: `content/sheets/<id>.md`.                                                                        |
| `name`    | Display name.                                                                                                                                                   |
| `file`    | The original source filename being reviewed (e.g. `Snowflake_Cheatsheet.md`) — shown as a reference path, not read from disk.                                   |
| `slug`    | URL segment, only needed for items inside a nested category (flat categories derive it from `id`).                                                              |
| `status`  | `'solid' \| 'flagged' \| 'planned'`.                                                                                                                            |
| `tagline` | One-line summary shown in lists and at the top of the item page.                                                                                                |
| `covers`  | A short paragraph describing what the sheet actually contains.                                                                                                  |
| `fixes`   | Concrete problems found in the sheet (wrong/deprecated API, a bug in a sample query, etc.) — rendered as a "Worth fixing" list. Empty array if nothing's wrong. |
| `extend`  | Topics the sheet is missing and could grow to cover — rendered as "Could extend" (or "Should include" for planned sheets).                                      |
| `body`    | Not set in the data file — populated at request time from disk (see below).                                                                                     |

Flat-category item ids sometimes carry a redundant category prefix so they read well in the data file (e.g. `dsa-graphs`, `dp-singleton`); [`lib/content.ts`](lib/content.ts) strips it for the URL so routes stay clean (`/dsa/graphs`, not `/dsa/dsa-graphs`).

## How a sheet gets its content

[`lib/get-sheet-body.ts`](lib/get-sheet-body.ts) is the only place in the app that touches the filesystem. For an item with id `foo`, it looks for `content/sheets/foo.md`:

- **Found** → the raw Markdown is passed through the [rendering pipeline](lib/markdown.tsx) and shown as the page body.
- **Not found** → returns `null`, and the page falls back to the "Planned scope" view built entirely from `covers` / `fixes` / `extend` in `content/data.ts`.

This repo currently ships one sample body, `content/sheets/snowflake.md`, so you can see the two page modes side by side — drop a Markdown file in next to it, named after any other `id` in `content/data.ts`, to bring that sheet online.

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
└── sheets/
    └── snowflake.md          # Written sheet bodies live here, one file per id

lib/
├── types.ts                  # Category/Sheet/Subcategory types, status helpers
├── content.ts                 # Flattens DATA for search/sidebar, resolves URL segments
├── get-sheet-body.ts          # Reads content/sheets/<id>.md
├── markdown.tsx                # unified/remark/rehype → React pipeline
├── themes.ts                   # All 15 theme definitions + DARK_THEMES set
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

1. Open `content/data.ts` and add a `Sheet` object to the right category's `items` array (or a subcategory's `items`, for Design Patterns). Fill in `id`, `name`, `file`, `status`, `tagline`, `covers`, `fixes`, and `extend`.
2. If a nested category, also set `slug` on the item.
3. Once the sheet is actually written, add `content/sheets/<id>.md` — the filename must match `id` exactly, not `file` or `slug`.
4. Flip `status` to `'solid'` once it's been reviewed, or leave it `'flagged'` if `fixes` still has open items.

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
