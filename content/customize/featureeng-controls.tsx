"use client";

import { type ReactNode, useMemo, useState } from "react";

type FeatureRow = {
  category: string;
  name: string;
  code: string;
  content: ReactNode;
};

export function FeatureEngineeringControls({
  catalog,
  sectorNames,
  allFeatureCount,
}: {
  catalog: Record<string, FeatureRow[]>;
  sectorNames: string[];
  allFeatureCount: number;
}) {
  const [sector, setSector] = useState(sectorNames[0]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const features = catalog[sector];
  const categories = [...new Set(features.map((entry) => entry.category))];
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return features.filter(
      (entry) =>
        (category === "All" || entry.category === category) &&
        (!normalized ||
          `${entry.name} ${entry.code} ${entry.category}`
            .toLowerCase()
            .includes(normalized)),
    );
  }, [category, features, query]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs font-semibold text-muted-foreground">
          Sector
          <select
            value={sector}
            onChange={(event) => {
              setSector(event.target.value);
              setCategory("All");
            }}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground"
          >
            {sectorNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Feature, code, category..."
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-foreground"
          >
            <option>All</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["Sector total", features.length],
          ["Showing", filtered.length],
          ["Categories", categories.length],
          ["All sectors", allFeatureCount],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-border bg-card px-3 py-2"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No features found. Try another search or category.
        </div>
      ) : (
        <div className="space-y-5">
          {categories
            .filter((name) => filtered.some((entry) => entry.category === name))
            .map((name) => (
              <section key={name}>
                <h2 className="border-l-2 border-primary bg-accent/50 px-3 py-2 text-xs font-bold uppercase tracking-wider">
                  {name}
                </h2>
                <div className="divide-y divide-border">
                  {filtered
                    .filter((entry) => entry.category === name)
                    .map((entry) => (
                      <div
                        key={entry.name}
                        className="grid grid-cols-1 md:grid-cols-[minmax(150px,1fr)_3fr] gap-2 py-3"
                      >
                        <div className="text-sm font-semibold">
                          {entry.name}
                        </div>
                        <div className="min-w-0">{entry.content}</div>
                      </div>
                    ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
