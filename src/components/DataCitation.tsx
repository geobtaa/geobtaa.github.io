import { useEffect, useId, useMemo, useRef, useState } from "react";

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

const FIELD_HELP = {
  title:
    "Provide the complete title of the dataset.",
  creators:
    "Provide the name of the individual, group, or organization responsible for creating or making the data.",
  year:
    "Indicate the year the dataset was published, which may represent a one-time or infrequent release for the cited version of the data.",
  version:
    "Version or edition number of the data.",
  publisher:
    "Identify the organization or entity responsible for making the dataset available through archiving, publishing, or distribution.",
  pid:
    "Provide a static electronic location or persistent identifier (e.g., DOI or URL) used to access the dataset.",
  format:
    "Choose a format from the dropdown list or write in a custom value.",
  accessed:
    "Date the dataset was retrieved. If the Temporal Coverage or Year of Publication is unknown, use this field to provide some temporal context.",
  temporalCoverage: "“Time period of dataset” (free text).",
} as const;

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
function formatDateForCitation(iso?: string) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
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
function chicagoAuthor(a: Author) {
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
  temporalCoverage?: string;
  version?: string;
  publisher?: string;
  pid?: string;
  dateAccessed?: string;
  format?: string;
}) {
  const names = payload.authors.map(apaAuthor).filter(Boolean);
  const authorsStr = joinAuthors(names, "&"); // APA uses "&"
  const yearValue = payload.year?.trim() || "n.d.";
  const yr = `(${yearValue}). `;
  const coveragePart = payload.temporalCoverage
    ? `Temporal coverage: ${payload.temporalCoverage}`
    : "";
  const versionPart = payload.version ? `Version ${payload.version}` : "";
  const metaParts = [coveragePart, versionPart].filter(Boolean);
  const metaSuffix = metaParts.length ? ` (${metaParts.join("; ")})` : "";
  const fmt = payload.format?.trim();
  const titlePart = payload.title
    ? `<i>${sentenceCase(payload.title)}</i>${metaSuffix} [Data set${fmt ? `: ${fmt}` : ""}]. `
    : "";
  const pub = payload.publisher ? `${payload.publisher}. ` : "";
  const link = payload.pid ? normalizeDOIorURL(payload.pid) : "";
  const accessed = payload.dateAccessed?.trim();
  const retrieval = accessed
    ? link
      ? `Retrieved ${accessed}, from ${link}`
      : `Retrieved ${accessed}.`
    : link;
  return `${authorsStr}${authorsStr ? ". " : ""}${yr}${titlePart}${pub}${retrieval}`.trim();
}

function buildMLA(payload: {
  authors: Author[];
  title?: string;
  year?: string;
  temporalCoverage?: string;
  version?: string;
  publisher?: string;
  pid?: string;
  dateAccessed?: string;
}) {
  let names = payload.authors.map(mlaAuthor).filter(Boolean);
  if (names.length > 2) {
    names = [names[0] + ", et al."];
  } else if (names.length === 2) {
    names = [joinAuthors(names, "and")];
  }
  const namesStr = names.join("");
  const coveragePart = payload.temporalCoverage
    ? `Temporal coverage ${payload.temporalCoverage}`
    : "";
  const versionPart = payload.version ? `Version ${payload.version}` : "";
  const metaParts = [coveragePart, versionPart].filter(Boolean);
  const metaSuffix = metaParts.length ? `, (${metaParts.join("; ")})` : "";
  const titlePart = payload.title ? `<i>${payload.title}</i>${metaSuffix}` : "";
  const pub = payload.publisher ? `, ${payload.publisher}` : "";
  const yearValue = payload.year?.trim() || "n.d.";
  const yr = `, ${yearValue}`;
  const link = payload.pid ? `, ${normalizeDOIorURL(payload.pid)}` : "";
  const accessed = payload.dateAccessed?.trim();
  const accessPart = accessed ? `, Accessed ${accessed}` : "";
  return `${namesStr}${namesStr ? ". " : ""}${titlePart}${pub}${yr}${link}${accessPart}.`.replace(
    /\.?\.$/,
    ".",
  );
}

function appendFormat(citation: string, format?: string) {
  if (!format?.trim()) return citation;
  const stripped = citation.trim().replace(/\.*$/, "");
  return `${stripped} (${format.trim()})`;
}

function FieldHelp({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false);
  const srId = `${id}-sr`;
  const tipId = `${id}-tip`;
  return (
    <span className="dcg-help">
      <span className="sr-only" id={srId}>
        {text}
      </span>
      <button
        type="button"
        className="dcg-help-btn"
        aria-label="Field help"
        aria-describedby={srId}
        aria-expanded={open}
        aria-controls={tipId}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        i
      </button>
      {open && (
        <span role="tooltip" id={tipId} className="dcg-help-tip">
          {text}
        </span>
      )}
    </span>
  );
}

function buildChicago(payload: {
  authors: Author[];
  title?: string;
  year?: string;
  temporalCoverage?: string;
  version?: string;
  publisher?: string;
  pid?: string;
  dateAccessed?: string;
}) {
  const names = payload.authors.map(chicagoAuthor).filter(Boolean);
  const authorsStr = joinAuthors(names, "and");
  const yearValue = payload.year?.trim() || "n.d.";
  const coveragePart = payload.temporalCoverage
    ? `Temporal coverage: ${payload.temporalCoverage}`
    : "";
  const versionPart = payload.version ? `Version ${payload.version}` : "";
  const metaParts = [coveragePart, versionPart].filter(Boolean);
  const metaSuffix = metaParts.length ? ` (${metaParts.join("; ")})` : "";
  const titlePart = payload.title
    ? `<i>${payload.title}</i>${metaSuffix} [Data set]. `
    : "";
  const pub = payload.publisher ? `${payload.publisher}. ` : "";
  const link = payload.pid ? normalizeDOIorURL(payload.pid) : "";
  const accessed = payload.dateAccessed?.trim();
  const accessPart = accessed ? `Accessed ${accessed}. ` : "";
  const linkPart = link ? `${link}.` : "";
  return `${authorsStr}${authorsStr ? ". " : ""}${yearValue}. ${titlePart}${pub}${accessPart}${linkPart}`
    .replace(/\s+/g, " ")
    .trim();
}

export default function DataCitation() {
  // STATE ---------------------------------------------------------------
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const formatId = `${idPrefix}-format`;
  const versionId = `${idPrefix}-version`;
  const pidId = `${idPrefix}-pid`;
  const publisherId = `${idPrefix}-publisher`;
  const yearId = `${idPrefix}-year`;
  const temporalCoverageId = `${idPrefix}-temporal-coverage`;
  const dateAccessedId = `${idPrefix}-date-accessed`;
  const styleId = `${idPrefix}-style`;

  const [authors, setAuthors] = useState<Author[]>([
    { type: "org", org: "" },
  ]);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [temporalCoverage, setTemporalCoverage] = useState("");
  const [version, setVersion] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pid, setPid] = useState("");
  const [dateAccessed, setDateAccessed] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [style, setStyle] = useState<"apa" | "mla" | "chicago">("apa");
  const [copied, setCopied] = useState(false);
  const formatFieldRef = useRef<HTMLDivElement | null>(null);
  const formatInputRef = useRef<HTMLInputElement | null>(null);

  const filteredFormatOptions = useMemo(() => {
    const query = formatFilter.trim().toLowerCase();
    if (!query) return FILE_FORMAT_OPTIONS;
    return FILE_FORMAT_OPTIONS.filter((opt) => opt.toLowerCase().includes(query));
  }, [formatFilter]);

  const html = useMemo(() => {
    const displayTitle = title.trim() ? title : "Title";
    const payload = {
      authors,
      title: displayTitle,
      year,
      temporalCoverage,
      version,
      publisher,
      pid,
      dateAccessed: formatDateForCitation(dateAccessed),
    };
    if (style === "mla") {
      const base = buildMLA(payload);
      return appendFormat(base, fileFormat);
    }
    if (style === "chicago") {
      const base = buildChicago(payload);
      return appendFormat(base, fileFormat);
    }
    return buildAPA({ ...payload, format: fileFormat });
  }, [
    authors,
    title,
    year,
    temporalCoverage,
    version,
    publisher,
    pid,
    dateAccessed,
    fileFormat,
    style,
  ]);

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
    setAuthors((prev) => [...prev, { type: "org", org: "" }]);
  }
  function removeAuthor(idx: number) {
    setAuthors((prev) => prev.filter((_, i) => i !== idx));
  }
  function clearForm() {
    setAuthors([{ type: "org", org: "" }]);
    setTitle("");
    setYear("");
    setTemporalCoverage("");
    setVersion("");
    setPublisher("");
    setPid("");
    setDateAccessed("");
    setFileFormat("");
    setFormatFilter("");
    setFormatMenuOpen(false);
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!formatFieldRef.current?.contains(target)) {
        setFormatMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

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
          <div className="dcg-card-header">
            <h2>Input</h2>
            <button className="dcg-btn ghost" type="button" onClick={clearForm}>
              Clear
            </button>
          </div>

          <h3 className="dcg-section dcg-section-first">Dataset</h3>
          <div className="dcg-label-row">
            <label htmlFor={titleId}>Dataset title</label>
            <FieldHelp id="help-title" text={FIELD_HELP.title} />
          </div>
          <input
            id={titleId}
            placeholder="e.g., Urban Tree Canopy, Minneapolis"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={formatId}>File Type/Format</label>
                <FieldHelp id="help-format" text={FIELD_HELP.format} />
              </div>
              <div className="dcg-combobox" ref={formatFieldRef}>
                <input
                  id={formatId}
                  ref={formatInputRef}
                  placeholder="Select from list or enter a format"
                  value={fileFormat}
                  onChange={(e) => {
                    setFileFormat(e.target.value);
                    setFormatFilter(e.target.value);
                    setFormatMenuOpen(true);
                  }}
                  onFocus={() => {
                    setFormatFilter("");
                    setFormatMenuOpen(true);
                  }}
                  role="combobox"
                  aria-expanded={formatMenuOpen}
                  aria-controls="dcg-format-menu"
                />
                {fileFormat && (
                  <button
                    className="dcg-combo-clear"
                    type="button"
                    aria-label="Clear format"
                    onClick={() => {
                      setFileFormat("");
                      setFormatFilter("");
                      setFormatMenuOpen(true);
                      requestAnimationFrame(() => formatInputRef.current?.focus());
                    }}
                  >
                    ×
                  </button>
                )}
                <button
                  className="dcg-combo-caret"
                  type="button"
                  aria-label="Show format options"
                  onClick={() =>
                    setFormatMenuOpen((open) => {
                      const next = !open;
                      if (next) setFormatFilter("");
                      return next;
                    })
                  }
                />
                {formatMenuOpen && (
                  <div className="dcg-combo-menu" role="listbox" id="dcg-format-menu">
                    {filteredFormatOptions.length > 0 ? (
                      filteredFormatOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          role="option"
                          className="dcg-combo-option"
                          onClick={() => {
                            setFileFormat(opt);
                            setFormatFilter(opt);
                            setFormatMenuOpen(false);
                          }}
                        >
                          {opt}
                        </button>
                      ))
                    ) : (
                      <div className="dcg-combo-empty">No matches</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={versionId}>
                  Version <span className="dcg-muted">(optional)</span>
                </label>
                <FieldHelp id="help-version" text={FIELD_HELP.version} />
              </div>
              <input
                id={versionId}
                placeholder="e.g., 2.1 or 2025-08"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={pidId}>Persistent identifier or URL</label>
                <FieldHelp id="help-pid" text={FIELD_HELP.pid} />
              </div>
              <input
                id={pidId}
                type="url"
                placeholder="https://doi.org/10.xxxx/xxxxx"
                value={pid}
                onChange={(e) => setPid(e.target.value)}
              />
            </div>
          </div>

          <h3 className="dcg-section dcg-section-split">Credits</h3>
          <div className="dcg-authors">
            <div className="dcg-label-row">
              <div className="dcg-field-label">Author(s)/Creator(s)</div>
              <FieldHelp id="help-creators" text={FIELD_HELP.creators} />
            </div>
            {authors.map((a, i) => (
              <div className={`dcg-author ${a.type === "org" ? "org" : "person"}`} key={i}>
                {/* Type switcher */}

                <div className="dcg-author-type">
                  <div className="dcg-type-toggle" role="group" aria-label={`Author ${i + 1} type`}>
                    <button
                      type="button"
                      className={"dcg-pill" + (a.type === "org" ? " active" : "")}
                      aria-pressed={a.type === "org"}
                      onClick={() => changeType(i, "org")}
                    >
                      Organization
                    </button>
                    <button
                      type="button"
                      className={"dcg-pill" + (a.type === "person" ? " active" : "")}
                      aria-pressed={a.type === "person"}
                      onClick={() => changeType(i, "person")}
                    >
                      Person
                    </button>
                  </div>
                </div>

                {a.type === "person" ? (
                  <>
                    <div className="dcg-author-col last">
                      {(() => {
                        const lastId = `${idPrefix}-author-${i}-last`;
                        return (
                          <>
                            <label htmlFor={lastId}>Last</label>
                            <input
                              id={lastId}
                              value={a.last || ""}
                              onChange={(e) => updateAuthor(i, "last", e.target.value)}
                            />
                          </>
                        );
                      })()}
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
                      {(() => {
                        const firstId = `${idPrefix}-author-${i}-first`;
                        return (
                          <>
                            <label htmlFor={firstId}>First</label>
                            <input
                              id={firstId}
                              value={a.first || ""}
                              onChange={(e) => updateAuthor(i, "first", e.target.value)}
                            />
                          </>
                        );
                      })()}
                    </div>
                    <div className="dcg-author-col middle">
                      {(() => {
                        const middleId = `${idPrefix}-author-${i}-middle`;
                        return (
                          <>
                            <label htmlFor={middleId}>Middle</label>
                            <input
                              id={middleId}
                              value={a.middle || ""}
                              onChange={(e) => updateAuthor(i, "middle", e.target.value)}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="dcg-author-org">
                    {(() => {
                      const orgId = `${idPrefix}-author-${i}-org`;
                      return (
                        <>
                          <label htmlFor={orgId}>Organization</label>
                          <input
                            id={orgId}
                            placeholder="Full name of organization"
                            value={a.org || ""}
                            onChange={(e) => updateAuthor(i, "org", e.target.value)}
                          />
                        </>
                      );
                    })()}
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
              <button className="dcg-btn secondary dcg-add-author" type="button" onClick={addAuthor}>
                + Add author
              </button>
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={publisherId}>Publisher</label>
                <FieldHelp id="help-publisher" text={FIELD_HELP.publisher} />
              </div>
              <input
                id={publisherId}
                placeholder="Organization that made the dataset available"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
              />
            </div>
          </div>

          <h3 className="dcg-section dcg-section-split">Dates</h3>
          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={yearId}>Year of publication</label>
                <FieldHelp id="help-year" text={FIELD_HELP.year} />
              </div>
              <input
                id={yearId}
                inputMode="numeric"
                pattern="\\d{4}"
                maxLength={4}
                placeholder="YYYY"
                value={year}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setYear(next);
                }}
              />
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={temporalCoverageId}>
                  Temporal coverage <span className="dcg-muted">(optional)</span>
                </label>
                <FieldHelp
                  id="help-temporal-coverage"
                  text={FIELD_HELP.temporalCoverage}
                />
              </div>
              <input
                id={temporalCoverageId}
                placeholder="e.g., 2010–2020"
                value={temporalCoverage}
                onChange={(e) => setTemporalCoverage(e.target.value)}
              />
            </div>
          </div>

          <div className="dcg-row single">
            <div>
              <div className="dcg-label-row">
                <label htmlFor={dateAccessedId}>
                  Date accessed <span className="dcg-muted">(optional)</span>
                </label>
                <FieldHelp id="help-accessed" text={FIELD_HELP.accessed} />
              </div>
              <input
                id={dateAccessedId}
                type="date"
                value={dateAccessed}
                onChange={(e) => setDateAccessed(e.target.value)}
              />
            </div>
          </div>

        </section>

        <section className="dcg-card">
          <div className="dcg-row single dcg-style-toggle">
            <div>
              <label htmlFor={styleId}>Citation style</label>
              <select
                id={styleId}
                value={style}
                onChange={(e) => setStyle(e.target.value as "apa" | "mla" | "chicago")}
              >
                <option value="apa">APA</option>
                <option value="mla">MLA</option>
                <option value="chicago">Chicago</option>
              </select>
            </div>
          </div>
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
        .dcg-card h2,
        .dcg-card h3 { margin: 0 0 .75rem; font-size: 1rem; }
        .dcg-card-header { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin: 0 0 .75rem; }
        .dcg-card-header h2,
        .dcg-card-header h3 { margin: 0; }

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

        .dcg-combobox { position: relative; }
        .dcg-combobox input { padding-right: 4.9rem; }
        .dcg-combo-clear {
          position: absolute;
          top: 50%;
          right: 2.6rem;
          transform: translateY(-50%);
          height: 1.9rem;
          width: 1.9rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--sl-color-bg);
          color: var(--ink);
          cursor: pointer;
          padding: 0;
          display: grid;
          place-items: center;
          font-size: 1rem;
          line-height: 1;
        }
        .dcg-combo-clear:hover { border-color: var(--accent); }
        .dcg-combo-clear:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--accent) 40%, transparent);
          outline-offset: 2px;
        }
        .dcg-combo-caret {
          position: absolute;
          top: 50%;
          right: 0.35rem;
          transform: translateY(-50%);
          height: 1.9rem;
          width: 1.9rem;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--sl-color-bg);
          color: var(--ink);
          cursor: pointer;
          padding: 0;
          display: grid;
          place-items: center;
        }
        .dcg-combo-caret::before {
          content: "";
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid currentColor;
        }
        .dcg-combo-caret:hover { border-color: var(--accent); }
        .dcg-combo-caret:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--accent) 40%, transparent);
          outline-offset: 2px;
        }
        .dcg-combo-menu {
          position: absolute;
          z-index: 20;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 220px;
          overflow: auto;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--card);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
          padding: 0.25rem;
        }
        .dcg-combo-option {
          width: 100%;
          text-align: left;
          border: 1px solid transparent;
          background: transparent;
          color: var(--ink);
          border-radius: 6px;
          padding: 0.45rem 0.55rem;
          cursor: pointer;
          font: inherit;
        }
        .dcg-combo-option:hover {
          background: color-mix(in oklab, var(--accent) 10%, transparent);
          border-color: color-mix(in oklab, var(--accent) 35%, transparent);
        }
        .dcg-combo-empty {
          padding: 0.5rem 0.6rem;
          color: color-mix(in oklab, var(--ink) 70%, transparent);
          font-size: 0.9rem;
        }

        .dcg-help { position: relative; display: inline-flex; align-items: center; }
        .dcg-help-btn {
          height: 1.15rem;
          width: 1.15rem;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--sl-color-bg);
          color: var(--ink);
          font-size: 0.75rem;
          line-height: 1;
          padding: 0;
          display: grid;
          place-items: center;
          cursor: help;
        }
        .dcg-help-btn:hover { border-color: var(--accent); color: var(--accent); }
        .dcg-help-btn:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--accent) 40%, transparent);
          outline-offset: 2px;
        }
        .dcg-help-tip {
          position: absolute;
          z-index: 30;
          top: calc(100% + 6px);
          left: 0;
          width: min(320px, 70vw);
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--card);
          color: var(--ink);
          padding: 0.55rem 0.65rem;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
          font-size: 0.9rem;
          line-height: 1.35;
        }

        .dcg-row, .dcg-row-3 { display: grid; gap: .75rem; align-items: start; }
        .dcg-row   { grid-template-columns: 1fr 1fr; }
        .dcg-row-3 { grid-template-columns: 1fr 1fr 1fr; }
        .dcg-row.single { grid-template-columns: 1fr; }

        .dcg-row > div,
        .dcg-row-3 > div { display: grid; grid-template-rows: auto auto; row-gap: .35rem; align-items: start; align-self: start; }

        .dcg-wrap label,
        .dcg-field-label {
          margin: 0 !important;
          font-weight: 600;
          font-size: .9rem;
          display: block;
          line-height: 1.2;
        }
        .dcg-row > div > label,
        .dcg-row-3 > div > label,
        .dcg-row > div > .dcg-field-label,
        .dcg-row-3 > div > .dcg-field-label { min-height: 1.2em; }

        .dcg-muted { font-weight: 400; }
        .dcg-label-row { display: flex; align-items: center; gap: 0.4rem; min-height: 1.2em; }
        .dcg-section {
          margin: 1.25rem 0 0.5rem;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 0.2px;
          color: var(--accent);
        }
        .dcg-section-first { margin-top: 0.25rem; }
        .dcg-section-split {
          margin-top: 2.25rem;
          padding-top: 0.9rem;
          border-top: 1px solid var(--border);
        }

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
        .dcg-btn.ghost { background: transparent; color: var(--ink); border-color: var(--border); }
        .dcg-btn:hover { border-color: var(--accent); }
        .dcg-btn:active { transform: translateY(1px); }
        .dcg-btn[disabled] { opacity: .75; cursor: default; }
        .dcg-btn.is-copied { background: color-mix(in oklab, var(--accent) 18%, white); color: var(--accent); border-color: var(--accent); }
        .dcg-btn.secondary:hover { background: color-mix(in oklab, var(--accent) 12%, transparent); }
        .dcg-card-header .dcg-btn { margin-bottom: 0; padding: .4rem .75rem; font-weight: 600; }
        .dcg-add-author {
          font-size: 0.85rem;
          padding: 0.38rem 0.7rem;
          border-width: 1px;
          border-color: color-mix(in oklab, var(--accent) 55%, var(--border));
        }
        .dcg-add-author:hover {
          background: #e8efff;
          border-color: var(--accent);
          color: var(--accent);
        }

        .dcg-output { min-height: 140px; padding: .75rem; border-radius: 8px; border: 1px dashed var(--border); background: color-mix(in oklab, var(--sl-color-bg) 90%, black 10%); color: var(--sl-color-text); }
        .dcg-output i { font-style: italic; }
        .dcg-copybar { display: flex; gap: .5rem; margin-top: .75rem; }
        .dcg-fmt { float: right; font-size: .8rem; opacity: .7; }

        /* Spacing tweaks for dense fields */
        .dcg-row, .dcg-row-3 { margin-top: 1rem; }
        .dcg-style-toggle { margin-top: 0; margin-bottom: .75rem; }

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
