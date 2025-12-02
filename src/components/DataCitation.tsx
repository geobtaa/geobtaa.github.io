import { useMemo, useState } from "react";

const FILE_FORMAT_OPTIONS = [
  "ArcGRID",
  "Geodatabase",
  "GeoJPEG",
  "GeoJSON",
  "GeoPackage",
  "GeoPDF",
  "GeoTIFF",
  "JPEG",
  "KML/KMZ",
  "LAS/LAZ",
  "MrSID",
  "PDF",
  "PNG",
  "Shapefile",
  "SQLite Database",
  "Spreadsheet",
  "TIFF",
  "Web Service",
  "Tile Package",
  "NetCDF",
  "OSM Data",
  "CAD Files",
];

// Types
type Author = {
  type: "person" | "org";
  first?: string;
  middle?: string;
  last?: string;
  org?: string;
};

// Helpers ---------------------------------------------------------------
function toInitials(given?: string) {
  if (!given) return "";
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + ".")
    .join(" ");
}
function normalizeDOIorURL(input?: string) {
  if (!input) return "";
  const s = input.trim();
  return s.startsWith("10.") ? `https://doi.org/${s}` : s;
}
function sentenceCase(str?: string) {
  if (!str) return "";
  const s = str.trim();
  if (s.toUpperCase() === s || s.toLowerCase() === s) {
    const [first, ...rest] = s.split(" ");
    return [
      first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
      ...rest.map((w) => w.toLowerCase()),
    ].join(" ");
  }
  return s;
}
function apaAuthor(a: Author) {
  if (a.type === "org") return (a.org || "").trim();
  const last = (a.last || "").trim();
  const first = (a.first || "").trim();
  const middle = (a.middle || "").trim();
  const initials = [first, middle].filter(Boolean).map(toInitials).join(" ");
  return last ? `${last}, ${initials}`.trim().replace(/,\s*$/, "") : "";
}
function mlaAuthor(a: Author) {
  if (a.type === "org") return (a.org || "").trim();
  const last = (a.last || "").trim();
  const first = (a.first || "").trim();
  const middle = (a.middle || "").trim();
  const given = [first, middle].filter(Boolean).join(" ");
  return last ? `${last}, ${given}`.trim().replace(/,\s*$/, "") : "";
}
function joinAuthors(list: string[], conjWord: string) {
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} ${conjWord} ${list[1]}`;
  return list.slice(0, -1).join(", ") + `, ${conjWord} ` + list[list.length - 1];
}

// Builders --------------------------------------------------------------
function buildAPA(payload: {
  authors: Author[];
  title?: string;
  year?: string;
  version?: string;
  publisher?: string;
  pid?: string;
  format?: string;
}) {
  const names = payload.authors.map(apaAuthor).filter(Boolean);
  const authorsStr = joinAuthors(names, "&"); // APA uses "&"
  const yr = payload.year ? `(${payload.year}). ` : "";
  const ver = payload.version ? ` (Version ${payload.version})` : "";
  const fmt = payload.format?.trim();
  const titlePart = payload.title
    ? `<i>${sentenceCase(payload.title)}</i>${ver} [Data set${fmt ? `: ${fmt}` : ""}]. `
    : "";
  const pub = payload.publisher ? `${payload.publisher}. ` : "";
  const link = payload.pid ? normalizeDOIorURL(payload.pid) : "";
  return `${authorsStr}${authorsStr ? ". " : ""}${yr}${titlePart}${pub}${link}`.trim();
}

function buildMLA(payload: {
  authors: Author[];
  title?: string;
  year?: string;
  version?: string;
  publisher?: string;
  pid?: string;
}) {
  let names = payload.authors.map(mlaAuthor).filter(Boolean);
  if (names.length > 2) {
    names = [names[0] + ", et al."];
  } else if (names.length === 2) {
    names = [joinAuthors(names, "and")];
  }
  const namesStr = names.join("");
  const ver = payload.version ? `, Version ${payload.version}` : "";
  const titlePart = payload.title ? `<i>${payload.title}</i>${ver}` : "";
  const pub = payload.publisher ? `, ${payload.publisher}` : "";
  const yr = payload.year ? `, ${payload.year}` : "";
  const link = payload.pid ? `, ${normalizeDOIorURL(payload.pid)}` : "";
  return `${namesStr}${namesStr ? ". " : ""}${titlePart}${pub}${yr}${link}.`.replace(/\.?\.$/, ".");
}

function appendFormat(citation: string, format?: string) {
  if (!format?.trim()) return citation;
  const stripped = citation.trim().replace(/\.*$/, "");
  return `${stripped} (${format.trim()})`;
}

export default function DataCitation() {
  // STATE ---------------------------------------------------------------
  const [authors, setAuthors] = useState<Author[]>([
    { type: "person", first: "", middle: "", last: "" },
  ]);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [version, setVersion] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pid, setPid] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [style, setStyle] = useState<"apa" | "mla">("apa");
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    const payload = { authors, title, year, version, publisher, pid };
    if (style === "mla") {
      const base = buildMLA(payload);
      return appendFormat(base, fileFormat);
    }
    return buildAPA({ ...payload, format: fileFormat });
  }, [authors, title, year, version, publisher, pid, fileFormat, style]);

  // ACTIONS -------------------------------------------------------------
  function updateAuthor(idx: number, key: keyof Author, value: string) {
    setAuthors((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }
  function changeType(idx: number, type: Author["type"]) {
    setAuthors((prev) => {
      const next = [...prev];
      const current = next[idx];
      next[idx] =
        type === "person"
          ? { type, first: current.first || "", middle: current.middle || "", last: current.last || "" }
          : { type, org: current.org || "" };
      return next;
    });
  }
  function addAuthor() {
    setAuthors((prev) => [...prev, { type: "person", first: "", middle: "", last: "" }]);
  }
  function removeAuthor(idx: number) {
    setAuthors((prev) => prev.filter((_, i) => i !== idx));
  }

  function copyPlainText() {
    const text = html.replace(/<[^>]+>/g, "");
    const doCopy = async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const el = document.createElement("textarea");
          el.value = text;
          document.body.appendChild(el);
          el.select();
          const legacyDoc = document as unknown as Record<string, unknown>;
          const exec = legacyDoc["execCommand"] as ((this: Document, commandId: string) => boolean) | undefined;
          if (typeof exec === "function") {
            exec.call(document, "copy");
          }
          el.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        /* noop */
      }
    };
    doCopy();
  }

  // RENDER --------------------------------------------------------------
  return (
    <div className="dcg-wrap not-content">
      <div className="dcg-grid">
        <section className="dcg-card">
          <h3>Input</h3>

          <div className="dcg-authors">
            <label>Author(s)</label>
            {authors.map((a, i) => (
              <div className={`dcg-author ${a.type === "org" ? "org" : "person"}`} key={i}>
                {/* Type switcher */}

                <div className="dcg-author-type">
                  <div className="dcg-type-toggle" role="group" aria-label={`Author ${i + 1} type`}>
                    <button
                      type="button"
                      className={"dcg-pill" + (a.type === "person" ? " active" : "")}
                      aria-pressed={a.type === "person"}
                      onClick={() => changeType(i, "person")}
                    >
                      Person
                    </button>
                    <button
                      type="button"
                      className={"dcg-pill" + (a.type === "org" ? " active" : "")}
                      aria-pressed={a.type === "org"}
                      onClick={() => changeType(i, "org")}
                    >
                      Organization
                    </button>
                  </div>
                </div>

                {a.type === "person" ? (
                  <>
                    <div className="dcg-author-col last">
                      <label>Last</label>
                      <input
                        value={a.last || ""}
                        onChange={(e) => updateAuthor(i, "last", e.target.value)}
                      />
                      {authors.length > 1 && (
                        <button
                          className="dcg-remove"
                          type="button"
                          onClick={() => removeAuthor(i)}
                          aria-label={`Remove author ${i + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="dcg-author-col first">
                      <label>First</label>
                      <input
                        value={a.first || ""}
                        onChange={(e) => updateAuthor(i, "first", e.target.value)}
                      />
                    </div>
                    <div className="dcg-author-col middle">
                      <label>Middle</label>
                      <input
                        value={a.middle || ""}
                        onChange={(e) => updateAuthor(i, "middle", e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="dcg-author-org">
                    <label>Organization</label>
                    <input
                      placeholder="Full name of organization"
                      value={a.org || ""}
                      onChange={(e) => updateAuthor(i, "org", e.target.value)}
                    />
                    {authors.length > 1 && (
                      <button
                        className="dcg-remove"
                        type="button"
                        onClick={() => removeAuthor(i)}
                        aria-label={`Remove author ${i + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="dcg-toolbar">
              <button className="dcg-btn secondary" type="button" onClick={addAuthor}>
                + Add author
              </button>
            </div>
          </div>

          <label>Dataset title</label>
          <input
            placeholder="e.g., Urban Tree Canopy, Minneapolis"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="dcg-row">
            <div>
              <label>Year of publication</label>
              <input
                // type="number"
                // inputMode="numeric"
                placeholder="YYYY (Only add the 4-digit year)"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div>
              <label>
                Version <span className="dcg-muted">(optional)</span>
              </label>
              <input
                placeholder="e.g., 2.1 or 2025-08"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
          </div>

          <div className="dcg-row">
            <div>
              <label>Data publisher</label>
              <input
                placeholder="Organization that made the dataset available"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
              />
            </div>
            <div>
              <label>Persistent identifier or URL</label>
              <input
                type="url"
                placeholder="https://doi.org/10.xxxx/xxxxx"
                value={pid}
                onChange={(e) => setPid(e.target.value)}
              />
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <label>File Type/Format</label>
              <input
                list="dcg-file-format"
                placeholder="Select from list or enter a format"
                value={fileFormat}
                onChange={(e) => setFileFormat(e.target.value)}
              />
              <datalist id="dcg-file-format">
                {FILE_FORMAT_OPTIONS.map((opt) => (
                  <option value={opt} key={opt} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <label>Citation style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as "apa" | "mla")}
              >
                <option value="apa">APA</option>
                <option value="mla">MLA</option>
              </select>
            </div>
          </div>
        </section>

        <section className="dcg-card">
          <h3>
            Output <span className="dcg-fmt">{style.toUpperCase()}</span>
          </h3>
          <div
            className="dcg-output"
            dangerouslySetInnerHTML={{
              __html: html || "Fill the form to see a preview.",
            }}
          />
          <div className="dcg-copybar">
            <button
              className={"dcg-btn secondary" + (copied ? " is-copied" : "")}
              type="button"
              onClick={copyPlainText}
              disabled={copied}
              aria-live="polite"
            >
              {copied ? "Copied!" : "Copy citation"}
            </button>
          </div>
        </section>
      </div>

      {/* Styles (scoped with .dcg-wrap to avoid clobbering Starlight UI) */}
      <style>{`
        .dcg-wrap { --card: var(--sl-color-bg); --ink: var(--sl-color-text); --border: var(--sl-color-hairline); --accent: var(--sl-color-primary); }
        .dcg-wrap * { box-sizing: border-box; }

        .dcg-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 1rem; }
        @media (max-width: 960px) { .dcg-grid { grid-template-columns: 1fr; } }

        .dcg-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
        .dcg-card h3 { margin: 0 0 .75rem; font-size: 1rem; }

        .dcg-wrap input,
        .dcg-wrap select {
          width: 100%;
          margin: 0;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: .55rem .65rem;
          font: inherit;
          color: var(--ink);
          background: var(--sl-color-bg);
          height: 2.5rem;
          line-height: 2.5rem;
        }
        .dcg-wrap select { height: 2.5rem; }
        .dcg-wrap input:focus,
        .dcg-wrap select:focus { outline: 2px solid color-mix(in oklab, var(--accent) 40%, transparent); outline-offset: 2px; }

        .dcg-row, .dcg-row-3 { display: grid; gap: .75rem; align-items: start; }
        .dcg-row   { grid-template-columns: 1fr 1fr; }
        .dcg-row-3 { grid-template-columns: 1fr 1fr 1fr; }
        .dcg-row.single { grid-template-columns: 1fr; }

        .dcg-row > div,
        .dcg-row-3 > div { display: grid; grid-template-rows: auto auto; row-gap: .35rem; align-items: start; align-self: start; }

        .dcg-wrap label { margin: 0 !important; font-weight: 600; font-size: .9rem; display: block; line-height: 1.2; }
        .dcg-row > div > label,
        .dcg-row-3 > div > label { min-height: 1.2em; }

        .dcg-muted { font-weight: 400; }

        .dcg-authors { display: flex; flex-direction: column; gap: .5rem; }

        /* Person vs Organization row layouts */
        .dcg-author.person {
          display: grid;
          grid-template-columns: 1.1fr 1fr 1fr;
          grid-template-rows: auto auto; /* type row + inputs row */
          grid-template-areas:
            "type type type"
            "last first middle";
          gap: .5rem;
          align-items: start;
        }
        .dcg-author.org {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-rows: auto auto; /* type row + org field */
          grid-template-areas:
            "type"
            "org";
          gap: .5rem;
          align-items: start;
        }
        .dcg-author-type { grid-area: type; justify-self: end; width: min(180px, 40%); }

        .dcg-author-col { display: grid; grid-template-rows: auto auto auto; row-gap: .3rem; align-items: start; }
        .dcg-author-col.last { grid-area: last; }
        .dcg-author-col.first { grid-area: first; }
        .dcg-author-col.middle { grid-area: middle; }

        .dcg-author-org { grid-area: org; display: grid; grid-template-rows: auto auto auto; row-gap: .3rem; }

/* --- Person/Organization toggle: robust, high-contrast --- */

/* Remove width clamp and align left */
.dcg-author-type {
  grid-area: type;
  justify-self: start;
  align-self: start;
  width: auto !important;
  max-width: none !important;
}

/* Slightly tinted track so both labels are always visible */
.dcg-type-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in oklab, var(--sl-color-bg) 92%, black 8%);
  color: var(--sl-color-text);
}

/* Base pill style (both labels visible) */
.dcg-pill {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 999px;
  padding: .35rem .7rem;
  font: inherit;
  font-size: .85rem;
  line-height: 1;
  color: var(--sl-color-text);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.dcg-pill + .dcg-pill { margin-left: 2px; }

/* Hover state for inactive pill */
.dcg-pill:not(.active):hover {
  background: color-mix(in oklab, var(--accent) 10%, var(--sl-color-bg));
}

/* ACTIVE: tint background with accent, but keep readable dark text */
.dcg-wrap .dcg-pill.active {
  background: #ffffff;
  color: var(--sl-color-text) !important;             /* dark text for contrast */
  font-weight: 600;
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

/* Focus ring for keyboard users */
.dcg-pill:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 40%, transparent);
  outline-offset: 2px;
}


        /* Tiny remove link under the field */
        .dcg-remove {
          appearance: none;
          border: none;
          background: transparent;
          color: var(--sl-color-text-accent);
          font-size: .8rem;
          padding: 0;
          width: fit-content;
          cursor: pointer;
          text-decoration: underline;
        }
        .dcg-remove:hover { text-decoration: none; }
        .dcg-remove:focus { outline: 2px solid color-mix(in oklab, var(--accent) 40%, transparent); outline-offset: 2px; }

        .dcg-toolbar { display: flex; gap: .5rem; flex-wrap: wrap; margin: .35rem 0 .5rem; }

        .dcg-btn { appearance: none; border: 1px solid var(--border); background: var(--accent); color: var(--sl-color-text-invert); border-radius: 999px; padding: .5rem .9rem; margin-bottom: 1rem; font-weight: 700; cursor: pointer; transition: background-color .15s ease, color .15s ease, border-color .15s ease, transform .02s ease; }
        .dcg-btn.secondary { background: transparent; color: var(--accent); border-color: var(--accent); }
        .dcg-btn:hover { border-color: var(--accent); }
        .dcg-btn:active { transform: translateY(1px); }
        .dcg-btn[disabled] { opacity: .75; cursor: default; }
        .dcg-btn.is-copied { background: color-mix(in oklab, var(--accent) 18%, white); color: var(--accent); border-color: var(--accent); }
        .dcg-btn.secondary:hover { background: color-mix(in oklab, var(--accent) 12%, transparent); }

        .dcg-output { min-height: 140px; padding: .75rem; border-radius: 8px; border: 1px dashed var(--border); background: color-mix(in oklab, var(--sl-color-bg) 90%, black 10%); color: var(--sl-color-text); }
        .dcg-output i { font-style: italic; }
        .dcg-copybar { display: flex; gap: .5rem; margin-top: .75rem; }
        .dcg-fmt { float: right; font-size: .8rem; opacity: .7; }

        /* Spacing tweaks for dense fields */
        .dcg-row, .dcg-row-3 { margin-top: 1rem; }

        /* Neutralize any CardGrid stagger transforms within this tool */
        .dcg-grid > * { transform: none !important; }
        .dcg-row  > * { transform: none !important; }

        /* Screen-reader only utility */
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
     

     `} 
      </style>
    </div>
  );
}
