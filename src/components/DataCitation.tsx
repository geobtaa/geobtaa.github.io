import { useEffect, useId, useMemo, useRef, useState } from "react";
import "../styles/data-citation.css";

const FILE_FORMAT_OPTIONS = [
  "ArcGRID",
  "CAD Files",
  "CSV",
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
  "NetCDF",
  "OSM Data",
  "PDF",
  "PNG",
  "Shapefile",
  "SQLite Database",
  "Spreadsheet",
  "TIFF",
  "Tile Package",
  "Web Service",
];

const FIELD_HELP = {
  title: "Provide the complete title of the dataset.",
  creators:
    "Provide the name of the individual, group, or organization responsible for creating or making the data. This field is equivalent to the term 'Author' and can include multiple creators.",
  year: "Indicate the year the dataset was published, which may represent a one-time or infrequent release for the cited version of the data.",
  version: "Version or edition number of the data.",
  publisher:
    "Identify the organization or entity responsible for making the dataset available through archiving, publishing, or distribution.",
  pid: "Provide a static electronic location or persistent identifier (e.g., DOI or URL) used to access the dataset.",
  format: "Choose a format from the dropdown list or type in a custom value.",
  accessed:
    "Date you retrieved the dataset. If the Temporal Coverage or Year of Publication is unknown, use this field to provide some temporal context. Change the date as needed or toggle off to omit.",
  temporalCoverage: "Time period of dataset (free text).",
} as const;

// Types
type Author = {
  type: "person" | "org";
  first?: string;
  middle?: string;
  last?: string;
  org?: string;
};

type AutofillMetadata = {
  source: "DataCite" | "Crossref" | "BTAA Geoportal";
  authors: Author[];
  title?: string;
  year?: string;
  version?: string;
  publisher?: string;
  pid: string;
  fileFormat?: string;
  temporalCoverage?: string;
};

type CitationPayload = {
  authors: Author[];
  title?: string;
  year?: string;
  temporalCoverage?: string;
  version?: string;
  publisher?: string;
  pid?: string;
  dateAccessed?: string;
  format?: string;
};

// Helpers ---------------------------------------------------------------
function parseDoi(input: string) {
  let value = input.trim();
  if (!value) return "";

  value = value.replace(/^doi:\s*/i, "");
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      if (hostname !== "doi.org" && hostname !== "dx.doi.org") return "";
      value = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } catch {
      return "";
    }
  }

  return /^10\.\d{4,9}\/\S+$/i.test(value) ? value : "";
}

function splitGivenName(givenName?: string) {
  const parts = (givenName || "").trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || "",
    middle: parts.slice(1).join(" "),
  };
}

function personAuthor(
  givenName?: string,
  familyName?: string,
  fullName?: string,
): Author {
  let given = (givenName || "").trim();
  let family = (familyName || "").trim();

  if ((!given || !family) && fullName?.includes(",")) {
    const [nameFamily, ...nameGiven] = fullName.split(",");
    family ||= nameFamily.trim();
    given ||= nameGiven.join(",").trim();
  }

  const { first, middle } = splitGivenName(given);
  return { type: "person", first, middle, last: family };
}

function publisherName(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  }
  return "";
}

function datePartsYear(value: unknown) {
  if (!value || typeof value !== "object" || !("date-parts" in value))
    return "";
  const dateParts = (value as { "date-parts"?: unknown })["date-parts"];
  if (!Array.isArray(dateParts) || !Array.isArray(dateParts[0])) return "";
  const year = dateParts[0][0];
  return typeof year === "number" || typeof year === "string"
    ? String(year)
    : "";
}

function mapDataCiteMetadata(
  payload: unknown,
  doi: string,
): AutofillMetadata | null {
  if (!payload || typeof payload !== "object" || !("data" in payload))
    return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("attributes" in data)) return null;
  const attributes = (data as { attributes?: unknown }).attributes;
  if (!attributes || typeof attributes !== "object") return null;

  const metadata = attributes as {
    creators?: Array<{
      name?: string;
      nameType?: string;
      givenName?: string;
      familyName?: string;
    }>;
    titles?: Array<{ title?: string }>;
    publicationYear?: number | string;
    publisher?: unknown;
    version?: string;
    formats?: string[];
    dates?: Array<{ date?: string; dateType?: string }>;
    doi?: string;
  };

  const authors = (metadata.creators || [])
    .map((creator): Author | null => {
      if (creator.nameType?.toLowerCase() === "organizational") {
        return creator.name ? { type: "org", org: creator.name } : null;
      }
      const author = personAuthor(
        creator.givenName,
        creator.familyName,
        creator.name,
      );
      return author.first || author.last ? author : null;
    })
    .filter((author): author is Author => author !== null);

  const coverage = (metadata.dates || []).find((date) =>
    ["collected", "valid"].includes(date.dateType?.toLowerCase() || ""),
  )?.date;

  return {
    source: "DataCite",
    authors,
    title: metadata.titles?.find((item) => item.title)?.title,
    year:
      metadata.publicationYear === undefined
        ? undefined
        : String(metadata.publicationYear),
    version: metadata.version || undefined,
    publisher: publisherName(metadata.publisher) || undefined,
    pid: `https://doi.org/${metadata.doi || doi}`,
    fileFormat: metadata.formats?.filter(Boolean).join(", ") || undefined,
    temporalCoverage: coverage?.replace("/", "–"),
  };
}

function mapCrossrefMetadata(
  payload: unknown,
  doi: string,
): AutofillMetadata | null {
  if (!payload || typeof payload !== "object" || !("message" in payload))
    return null;
  const message = (payload as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;

  const metadata = message as {
    author?: Array<{
      given?: string;
      family?: string;
      name?: string;
    }>;
    title?: string[];
    published?: unknown;
    "published-print"?: unknown;
    "published-online"?: unknown;
    issued?: unknown;
    publisher?: string;
    version?: string;
    DOI?: string;
  };

  const authors = (metadata.author || [])
    .map((creator): Author | null => {
      if (creator.name && !creator.given && !creator.family) {
        return { type: "org", org: creator.name };
      }
      const author = personAuthor(creator.given, creator.family, creator.name);
      return author.first || author.last ? author : null;
    })
    .filter((author): author is Author => author !== null);

  const year =
    datePartsYear(metadata.published) ||
    datePartsYear(metadata["published-print"]) ||
    datePartsYear(metadata["published-online"]) ||
    datePartsYear(metadata.issued);

  return {
    source: "Crossref",
    authors,
    title: metadata.title?.find(Boolean),
    year: year || undefined,
    version: metadata.version || undefined,
    publisher: metadata.publisher || undefined,
    pid: `https://doi.org/${metadata.DOI || doi}`,
  };
}

async function fetchDoiMetadata(doi: string, signal: AbortSignal) {
  const encodedDoi = encodeURIComponent(doi);
  // DataCite has the richest dataset metadata; Crossref is a useful fallback
  // for DOIs that are registered outside DataCite.
  const services = [
    {
      url: `https://api.datacite.org/dois/${encodedDoi}`,
      map: mapDataCiteMetadata,
    },
    {
      url: `https://api.crossref.org/works/${encodedDoi}`,
      map: mapCrossrefMetadata,
    },
  ];
  let serviceUnavailable = false;

  for (const service of services) {
    try {
      const response = await fetch(service.url, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (response.ok) {
        const metadata = service.map(await response.json(), doi);
        if (metadata) return metadata;
      } else if (response.status !== 404) {
        serviceUnavailable = true;
      }
    } catch (error) {
      if (signal.aborted) throw error;
      serviceUnavailable = true;
    }
  }

  throw new Error(
    serviceUnavailable
      ? "The DOI metadata services could not be reached. Please try again."
      : "No metadata was found for this DOI. Check the DOI and try again.",
  );
}

function parseGeoportalLandingPage(input: string) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || url.hostname !== "geo.btaa.org") return "";
    const match = url.pathname.match(/^\/resources\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

function stringsFromUnknown(value: unknown) {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstString(value: unknown) {
  return stringsFromUnknown(value)[0] || "";
}

function referenceUrl(metadata: Record<string, unknown>) {
  const directUrl = firstString(metadata["http://schema.org/url"]);
  if (directUrl) return directUrl;

  // Geoportal records commonly serialize schema.org references as JSON inside
  // dct_references_s, though some API responses expose the URL directly.
  const referencesValue = metadata.dct_references_s;
  let references: unknown = referencesValue;
  if (typeof referencesValue === "string") {
    try {
      references = JSON.parse(referencesValue);
    } catch {
      return "";
    }
  }

  if (
    references &&
    typeof references === "object" &&
    "http://schema.org/url" in references
  ) {
    return firstString(
      (references as Record<string, unknown>)["http://schema.org/url"],
    );
  }
  return "";
}

function mapGeoportalMetadata(
  payload: unknown,
  resourceId: string,
): AutofillMetadata | null {
  if (!payload || typeof payload !== "object" || !("data" in payload))
    return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("attributes" in data)) return null;
  const attributes = (data as { attributes?: unknown }).attributes;
  if (!attributes || typeof attributes !== "object" || !("ogm" in attributes))
    return null;
  const ogm = (attributes as { ogm?: unknown }).ogm;
  if (!ogm || typeof ogm !== "object") return null;
  const metadata = ogm as Record<string, unknown>;

  // Keep this mapping aligned with docs/data-citation-autofill-crosswalk.md.
  const authors = stringsFromUnknown(metadata.dct_creator_sm).map(
    (creator): Author =>
      creator.includes(",")
        ? personAuthor(undefined, undefined, creator)
        : { type: "org", org: creator },
  );
  const issued = firstString(metadata.dct_issued_s);
  const publicationYear = issued.match(/\b\d{4}\b/)?.[0];
  const format =
    stringsFromUnknown(metadata.dct_format_s).join(", ") ||
    stringsFromUnknown(metadata.gbl_resourceClass_sm).join(", ");
  const publisher =
    stringsFromUnknown(metadata.dct_publisher_sm).join("; ") ||
    firstString(metadata.schema_provider_s);
  const landingPage = `https://geo.btaa.org/resources/${encodeURIComponent(resourceId)}`;

  return {
    source: "BTAA Geoportal",
    authors,
    title: firstString(metadata.dct_title_s) || undefined,
    year: publicationYear,
    publisher: publisher || undefined,
    pid: referenceUrl(metadata) || landingPage,
    fileFormat: format || undefined,
    temporalCoverage:
      stringsFromUnknown(metadata.dct_temporal_sm).join("; ") || undefined,
  };
}

async function fetchGeoportalMetadata(resourceId: string, signal: AbortSignal) {
  const response = await fetch(
    `https://geo.btaa.org/api/v1/resources/${encodeURIComponent(resourceId)}?format=json`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (response.status === 404) {
    throw new Error(
      "No BTAA Geoportal record was found for this landing page.",
    );
  }
  if (!response.ok) {
    throw new Error(
      "The BTAA Geoportal API could not be reached. Please try again.",
    );
  }

  const metadata = mapGeoportalMetadata(await response.json(), resourceId);
  if (!metadata) {
    throw new Error(
      "The BTAA Geoportal record did not contain usable metadata.",
    );
  }
  return metadata;
}

function escapeHtml(value?: string) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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

function todayForDateInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  return (
    list.slice(0, -1).join(", ") + `, ${conjWord} ` + list[list.length - 1]
  );
}

// Builders --------------------------------------------------------------
function buildAPA(payload: CitationPayload) {
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

function buildMLA(payload: CitationPayload) {
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

function DownloadIcon() {
  return (
    <svg
      className="dcg-download-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v11" />
      <path d="m7 9 5 5 5-5" />
      <path d="M5 14v5h14v-5" />
    </svg>
  );
}

function RetrieveIcon() {
  return (
    <svg
      className="dcg-action-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="dcg-action-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="1" />
      <path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4" />
    </svg>
  );
}

function SectionIcon({ type }: { type: "what" | "who" | "when" }) {
  return (
    <svg
      className="dcg-section-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "what" && (
        <>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
        </>
      )}
      {type === "who" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20v-2.3c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2V20" />
          <circle cx="17" cy="9" r="2.2" />
          <path d="M15.5 14.3c.5-.2 1-.3 1.5-.3 2.2 0 4 1.7 4 4v2" />
        </>
      )}
      {type === "when" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M7 3v4M17 3v4M3 10h18" />
          <path d="M8 14h3M14 14h2M8 18h3M14 18h2" />
        </>
      )}
    </svg>
  );
}

function buildChicago(payload: CitationPayload) {
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

type CitationExportPayload = {
  authors: Author[];
  title: string;
  year: string;
  temporalCoverage: string;
  version: string;
  publisher: string;
  pid: string;
  dateAccessed: string;
  format: string;
};

function exportAuthor(author: Author) {
  if (author.type === "org") return (author.org || "").trim();
  const family = (author.last || "").trim();
  const given = [author.first, author.middle].filter(Boolean).join(" ").trim();
  return [family, given].filter(Boolean).join(", ");
}

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function bibtexEscape(value: string) {
  const replacements: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "&": "\\&",
    "%": "\\%",
    $: "\\$",
    "#": "\\#",
    _: "\\_",
    "^": "\\^{}",
    "~": "\\~{}",
  };
  return Array.from(singleLine(value), (character) =>
    replacements[character] === undefined ? character : replacements[character],
  ).join("");
}

function citationFileStem(title: string) {
  const stem = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return stem || "dataset-citation";
}

function bibtexCitationKey(payload: CitationExportPayload) {
  const firstAuthor = payload.authors[0];
  const creator =
    firstAuthor?.type === "person"
      ? firstAuthor.last || firstAuthor.first || ""
      : firstAuthor?.org || "";
  const firstTitleWord = payload.title.trim().split(/\s+/)[0] || "dataset";
  const rawKey = `${creator}${payload.year || "nd"}${firstTitleWord}`;
  const key = rawKey
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return key || "dataset";
}

function buildRIS(payload: CitationExportPayload) {
  const lines = ["TY  - DATA"];
  if (payload.title.trim()) lines.push(`TI  - ${singleLine(payload.title)}`);
  payload.authors
    .map(exportAuthor)
    .filter(Boolean)
    .forEach((author) => lines.push(`AU  - ${singleLine(author)}`));
  if (payload.year.trim()) lines.push(`PY  - ${singleLine(payload.year)}`);
  if (payload.publisher.trim()) {
    lines.push(`PB  - ${singleLine(payload.publisher)}`);
  }
  if (payload.version.trim()) {
    lines.push(`ET  - ${singleLine(payload.version)}`);
  }
  const doi = parseDoi(payload.pid);
  if (doi) lines.push(`DO  - ${doi}`);
  if (payload.pid.trim()) {
    lines.push(`UR  - ${singleLine(normalizeDOIorURL(payload.pid))}`);
  }
  if (payload.dateAccessed.trim()) {
    lines.push(`Y2  - ${payload.dateAccessed.replaceAll("-", "/")}`);
  }
  if (payload.format.trim()) {
    lines.push(`N1  - Data format: ${singleLine(payload.format)}`);
  }
  if (payload.temporalCoverage.trim()) {
    lines.push(
      `N1  - Temporal coverage: ${singleLine(payload.temporalCoverage)}`,
    );
  }
  lines.push("ER  -");
  return `${lines.join("\r\n")}\r\n`;
}

function buildBibtex(payload: CitationExportPayload) {
  const fields: Array<[string, string]> = [];
  const authors = payload.authors
    .map((author) => {
      const name = bibtexEscape(exportAuthor(author));
      return author.type === "org" && name ? `{${name}}` : name;
    })
    .filter(Boolean);
  if (authors.length) fields.push(["author", authors.join(" and ")]);
  if (payload.title.trim()) {
    fields.push(["title", bibtexEscape(payload.title)]);
  }
  if (payload.year.trim()) fields.push(["year", bibtexEscape(payload.year)]);
  if (payload.publisher.trim()) {
    fields.push(["publisher", bibtexEscape(payload.publisher)]);
  }
  if (payload.version.trim()) {
    fields.push(["version", bibtexEscape(payload.version)]);
  }
  const doi = parseDoi(payload.pid);
  if (doi) fields.push(["doi", bibtexEscape(doi)]);
  if (payload.pid.trim()) {
    fields.push(["url", bibtexEscape(normalizeDOIorURL(payload.pid))]);
  }
  if (payload.dateAccessed.trim()) {
    fields.push(["urldate", bibtexEscape(payload.dateAccessed)]);
  }
  fields.push(["howpublished", "Dataset"]);

  const notes = [
    payload.format.trim() ? `Data format: ${singleLine(payload.format)}` : "",
    payload.temporalCoverage.trim()
      ? `Temporal coverage: ${singleLine(payload.temporalCoverage)}`
      : "",
  ].filter(Boolean);
  if (notes.length) fields.push(["note", bibtexEscape(notes.join("; "))]);

  const renderedFields = fields
    .map(
      ([name, value], index) =>
        `  ${name} = {${value}}${index === fields.length - 1 ? "" : ","}`,
    )
    .join("\n");
  return `@misc{${bibtexCitationKey(payload)},\n${renderedFields}\n}\n`;
}

function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function DataCitation() {
  // STATE ---------------------------------------------------------------
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const titleHintId = `${titleId}-hint`;
  const formatId = `${idPrefix}-format`;
  const versionId = `${idPrefix}-version`;
  const versionHintId = `${versionId}-hint`;
  const pidId = `${idPrefix}-pid`;
  const pidHintId = `${pidId}-hint`;
  const publisherId = `${idPrefix}-publisher`;
  const publisherHintId = `${publisherId}-hint`;
  const yearId = `${idPrefix}-year`;
  const yearHintId = `${yearId}-hint`;
  const temporalCoverageId = `${idPrefix}-temporal-coverage`;
  const temporalCoverageHintId = `${temporalCoverageId}-hint`;
  const includeDateAccessedId = `${idPrefix}-include-date-accessed`;
  const dateAccessedId = `${idPrefix}-date-accessed`;
  const dateAccessedControlId = `${idPrefix}-date-accessed-control`;
  const autofillInputId = `${idPrefix}-autofill-input`;
  const autofillStatusId = `${idPrefix}-autofill-status`;

  const [authors, setAuthors] = useState<Author[]>([{ type: "org", org: "" }]);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [temporalCoverage, setTemporalCoverage] = useState("");
  const [version, setVersion] = useState("");
  const [publisher, setPublisher] = useState("");
  const [pid, setPid] = useState("");
  const [dateAccessed, setDateAccessed] = useState("");
  const [includeDateAccessed, setIncludeDateAccessed] = useState(true);
  const [fileFormat, setFileFormat] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [style, setStyle] = useState<"apa" | "mla" | "chicago">("apa");
  const [copied, setCopied] = useState(false);
  const [clearPending, setClearPending] = useState(false);
  const [autofillMode, setAutofillMode] = useState<
    "manual" | "doi" | "geoportal"
  >("manual");
  const [doiInput, setDoiInput] = useState("");
  const [geoportalInput, setGeoportalInput] = useState("");
  const [autofillStatus, setAutofillStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const formatFieldRef = useRef<HTMLDivElement | null>(null);
  const formatInputRef = useRef<HTMLInputElement | null>(null);
  const autofillAbortRef = useRef<AbortController | null>(null);

  const filteredFormatOptions = useMemo(() => {
    const query = formatFilter.trim().toLowerCase();
    if (!query) return FILE_FORMAT_OPTIONS;
    return FILE_FORMAT_OPTIONS.filter((opt) =>
      opt.toLowerCase().includes(query),
    );
  }, [formatFilter]);

  const html = useMemo(() => {
    // Citation builders intentionally return a small amount of HTML for
    // italics. Escape every user-editable value before rendering that HTML.
    const displayTitle = title.trim() ? title : "Title";
    const safeAuthors = authors.map((author) =>
      author.type === "org"
        ? { type: "org" as const, org: escapeHtml(author.org) }
        : {
            type: "person" as const,
            first: escapeHtml(author.first),
            middle: escapeHtml(author.middle),
            last: escapeHtml(author.last),
          },
    );
    const payload = {
      authors: safeAuthors,
      title: escapeHtml(displayTitle),
      year: escapeHtml(year),
      temporalCoverage: escapeHtml(temporalCoverage),
      version: escapeHtml(version),
      publisher: escapeHtml(publisher),
      pid: escapeHtml(pid),
      dateAccessed: escapeHtml(
        includeDateAccessed ? formatDateForCitation(dateAccessed) : "",
      ),
    };
    if (style === "mla") {
      const base = buildMLA(payload);
      return appendFormat(base, escapeHtml(fileFormat));
    }
    if (style === "chicago") {
      const base = buildChicago(payload);
      return appendFormat(base, escapeHtml(fileFormat));
    }
    return buildAPA({ ...payload, format: escapeHtml(fileFormat) });
  }, [
    authors,
    title,
    year,
    temporalCoverage,
    version,
    publisher,
    pid,
    dateAccessed,
    includeDateAccessed,
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
          ? {
              type,
              first: current.first || "",
              middle: current.middle || "",
              last: current.last || "",
            }
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
    autofillAbortRef.current?.abort();
    autofillAbortRef.current = null;
    setAuthors([{ type: "org", org: "" }]);
    setTitle("");
    setYear("");
    setTemporalCoverage("");
    setVersion("");
    setPublisher("");
    setPid("");
    setDateAccessed(todayForDateInput());
    setIncludeDateAccessed(true);
    setFileFormat("");
    setFormatFilter("");
    setFormatMenuOpen(false);
    setAutofillMode("manual");
    setDoiInput("");
    setGeoportalInput("");
    setAutofillStatus({ type: "idle", message: "" });
    setClearPending(false);
  }
  function changeAutofillMode(mode: "manual" | "doi" | "geoportal") {
    // Switching sources invalidates any request and status from the old mode.
    autofillAbortRef.current?.abort();
    autofillAbortRef.current = null;
    setAutofillMode(mode);
    setAutofillStatus({ type: "idle", message: "" });
  }
  function handleAutofillInputChange(value: string) {
    autofillAbortRef.current?.abort();
    autofillAbortRef.current = null;
    if (autofillMode === "doi") {
      setDoiInput(value);
    } else {
      setGeoportalInput(value);
    }
    setAutofillStatus({ type: "idle", message: "" });
  }
  function applyAutofillMetadata(metadata: AutofillMetadata) {
    setAuthors(
      metadata.authors.length ? metadata.authors : [{ type: "org", org: "" }],
    );
    setTitle(metadata.title || "");
    setYear((metadata.year || "").slice(0, 4));
    setVersion(metadata.version || "");
    setPublisher(metadata.publisher || "");
    setFileFormat(metadata.fileFormat || "");
    setFormatFilter(metadata.fileFormat || "");
    setTemporalCoverage(metadata.temporalCoverage || "");
    setPid(metadata.pid);
  }
  async function lookupMetadata() {
    if (autofillMode === "manual") return;

    const doi = autofillMode === "doi" ? parseDoi(doiInput) : "";
    const resourceId =
      autofillMode === "geoportal"
        ? parseGeoportalLandingPage(geoportalInput)
        : "";

    if (autofillMode === "doi" && !doi) {
      setAutofillStatus({
        type: "error",
        message: "Enter a valid DOI, such as 10.13020/a88t-yb14.",
      });
      return;
    }
    if (autofillMode === "geoportal" && !resourceId) {
      setAutofillStatus({
        type: "error",
        message:
          "Enter a valid BTAA Geoportal landing page, such as https://geo.btaa.org/resources/…",
      });
      return;
    }

    // Only the newest lookup may update the editable form.
    autofillAbortRef.current?.abort();
    const controller = new AbortController();
    autofillAbortRef.current = controller;
    setAutofillStatus({
      type: "loading",
      message:
        autofillMode === "doi"
          ? "Retrieving DOI metadata…"
          : "Retrieving BTAA Geoportal metadata…",
    });

    try {
      const metadata =
        autofillMode === "doi"
          ? await fetchDoiMetadata(doi, controller.signal)
          : await fetchGeoportalMetadata(resourceId, controller.signal);
      if (controller.signal.aborted) return;

      applyAutofillMetadata(metadata);
      if (autofillMode === "doi") {
        setDoiInput(doi);
      } else {
        setGeoportalInput(
          `https://geo.btaa.org/resources/${encodeURIComponent(resourceId)}`,
        );
      }
      setAutofillStatus({
        type: "success",
        message: `Details loaded from ${metadata.source}. Review and edit the fields below as needed.`,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setAutofillStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The metadata could not be retrieved. Please try again.",
      });
    } finally {
      if (autofillAbortRef.current === controller) {
        autofillAbortRef.current = null;
      }
    }
  }

  useEffect(() => {
    setDateAccessed((current) => current || todayForDateInput());
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!formatFieldRef.current?.contains(target)) {
        setFormatMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      autofillAbortRef.current?.abort();
    };
  }, []);

  function copyPlainText() {
    // Convert the formatted preview to plain text before writing it to the
    // clipboard. The textarea branch supports browsers without Clipboard API.
    const citation = document.createElement("div");
    citation.innerHTML = html;
    const text = citation.textContent || "";
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
          const exec = legacyDoc["execCommand"] as
            | ((this: Document, commandId: string) => boolean)
            | undefined;
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

  function currentExportPayload(): CitationExportPayload {
    return {
      authors,
      title,
      year,
      temporalCoverage,
      version,
      publisher,
      pid,
      dateAccessed: includeDateAccessed ? dateAccessed : "",
      format: fileFormat,
    };
  }

  function downloadRIS() {
    const payload = currentExportPayload();
    downloadTextFile(
      `${citationFileStem(payload.title)}.ris`,
      buildRIS(payload),
      "application/x-research-info-systems;charset=utf-8",
    );
  }

  function downloadBibtex() {
    const payload = currentExportPayload();
    downloadTextFile(
      `${citationFileStem(payload.title)}.bib`,
      buildBibtex(payload),
      "application/x-bibtex;charset=utf-8",
    );
  }

  // RENDER --------------------------------------------------------------
  return (
    <div className="dcg-wrap not-content">
      <div className="dcg-grid">
        <section className="dcg-card">
          <div className="dcg-autofill-panel">
            <div className="dcg-step-heading">
              <p className="dcg-step-label">Step 1</p>
              <h2>Choose how to start</h2>
              <p>Select one option to begin.</p>
            </div>
            <div
              className="dcg-autofill-source"
              role="radiogroup"
              aria-label="Citation starting method"
            >
              <label
                className={`dcg-source-option ${autofillMode === "manual" ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-autofill-mode`}
                  value="manual"
                  checked={autofillMode === "manual"}
                  onChange={() => changeAutofillMode("manual")}
                />
                <span className="dcg-source-indicator" aria-hidden="true" />
                <span className="dcg-source-copy">
                  <span className="dcg-source-title">Manual entry</span>
                  <span className="dcg-source-description">
                    Fill in the citation details below.
                  </span>
                </span>
              </label>
              <label
                className={`dcg-source-option ${autofillMode === "doi" ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-autofill-mode`}
                  value="doi"
                  checked={autofillMode === "doi"}
                  onChange={() => changeAutofillMode("doi")}
                />
                <span className="dcg-source-indicator" aria-hidden="true" />
                <span className="dcg-source-copy">
                  <span className="dcg-source-title">DOI</span>
                  <span className="dcg-source-description">
                    Paste the DOI of a published dataset.
                  </span>
                </span>
              </label>
              <label
                className={`dcg-source-option ${autofillMode === "geoportal" ? "active" : ""}`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-autofill-mode`}
                  value="geoportal"
                  checked={autofillMode === "geoportal"}
                  onChange={() => changeAutofillMode("geoportal")}
                />
                <span className="dcg-source-indicator" aria-hidden="true" />
                <span className="dcg-source-copy">
                  <span className="dcg-source-title">BTAA Geoportal</span>
                  <span className="dcg-source-description">
                    Find a resource in the{" "}
                    {autofillMode === "geoportal" ? (
                      <a
                        href="https://geo.btaa.org"
                        target="_blank"
                        rel="noreferrer"
                      >
                        BTAA Geoportal
                      </a>
                    ) : (
                      <span>BTAA Geoportal</span>
                    )}
                    , then paste its landing-page URL.
                  </span>
                </span>
              </label>
            </div>
            {autofillMode !== "manual" && (
              <form
                className="dcg-autofill-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void lookupMetadata();
                }}
              >
                <label className="sr-only" htmlFor={autofillInputId}>
                  {autofillMode === "doi"
                    ? "DOI"
                    : "BTAA Geoportal landing page"}
                </label>
                <input
                  id={autofillInputId}
                  inputMode="url"
                  placeholder={
                    autofillMode === "doi"
                      ? "10.xxxx/xxxxx or https://doi.org/10.xxxx/xxxxx"
                      : "https://geo.btaa.org/resources/…"
                  }
                  value={autofillMode === "doi" ? doiInput : geoportalInput}
                  onChange={(event) =>
                    handleAutofillInputChange(event.target.value)
                  }
                  aria-describedby={
                    autofillStatus.message ? autofillStatusId : undefined
                  }
                  aria-invalid={autofillStatus.type === "error"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  className="dcg-btn secondary dcg-autofill-submit"
                  type="submit"
                  disabled={autofillStatus.type === "loading"}
                >
                  <RetrieveIcon />
                  {autofillStatus.type === "loading"
                    ? "Retrieving…"
                    : "Retrieve details"}
                </button>
              </form>
            )}
            {autofillStatus.message && (
              <p
                id={autofillStatusId}
                className={`dcg-autofill-status ${autofillStatus.type}`}
                role={autofillStatus.type === "error" ? "alert" : "status"}
              >
                {autofillStatus.message}
              </p>
            )}
          </div>

          <div className="dcg-step-guidance dcg-step-heading">
            <p className="dcg-step-label">Step 2</p>
            <h2>
              {autofillMode === "manual"
                ? "Enter citation details"
                : "Review and complete citation details"}
            </h2>
            <p>
              {autofillMode === "manual"
                ? "Fill in the fields below."
                : autofillStatus.type === "success"
                  ? "Review the autopopulated values below, make corrections, and fill in any missing details."
                  : "Retrieve details above, then review the autopopulated values and fill in anything missing."}
            </p>
          </div>

          <div className="dcg-field-group">
            <h3 className="dcg-group-heading">
              <SectionIcon type="what" />
              <span>Describe the dataset</span>
            </h3>
            <div className="dcg-field-group-body">
              <div className="dcg-field">
                <div className="dcg-label-row">
                  <label htmlFor={titleId}>Dataset title</label>
                  <FieldHelp id="help-title" text={FIELD_HELP.title} />
                </div>
                <input
                  id={titleId}
                  aria-describedby={titleHintId}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <span className="dcg-field-hint" id={titleHintId}>
                  Example: Urban Tree Canopy, Minneapolis
                </span>
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
                    aria-describedby={pidHintId}
                    value={pid}
                    onChange={(e) => setPid(e.target.value)}
                  />
                  <span className="dcg-field-hint" id={pidHintId}>
                    Example: https://doi.org/10.xxxx/xxxxx
                  </span>
                </div>
              </div>

              <div className="dcg-row single">
                <div>
                  <div className="dcg-label-row">
                    <label htmlFor={formatId}>File type / Format</label>
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
                          requestAnimationFrame(() =>
                            formatInputRef.current?.focus(),
                          );
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
                      <div
                        className="dcg-combo-menu"
                        role="listbox"
                        id="dcg-format-menu"
                      >
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
                    aria-describedby={versionHintId}
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                  <span className="dcg-field-hint" id={versionHintId}>
                    Examples: 2.1 or 2025-08
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="dcg-field-group">
            <h3 className="dcg-group-heading">
              <SectionIcon type="who" />
              <span>Credit the sources</span>
            </h3>
            <div className="dcg-field-group-body">
              <div className="dcg-authors">
                <div className="dcg-label-row">
                  <div className="dcg-field-label">Creator</div>
                  <FieldHelp id="help-creators" text={FIELD_HELP.creators} />
                </div>
                {authors.map((a, i) => (
                  <div
                    className={`dcg-author ${a.type === "org" ? "org" : "person"}`}
                    key={i}
                  >
                    {/* Type switcher */}

                    <div className="dcg-author-type">
                      <div
                        className="dcg-type-toggle"
                        role="group"
                        aria-label={`Author ${i + 1} type`}
                      >
                        <button
                          type="button"
                          className={
                            "dcg-pill" + (a.type === "org" ? " active" : "")
                          }
                          aria-pressed={a.type === "org"}
                          onClick={() => changeType(i, "org")}
                        >
                          Organization
                        </button>
                        <button
                          type="button"
                          className={
                            "dcg-pill" + (a.type === "person" ? " active" : "")
                          }
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
                                  onChange={(e) =>
                                    updateAuthor(i, "last", e.target.value)
                                  }
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
                                  onChange={(e) =>
                                    updateAuthor(i, "first", e.target.value)
                                  }
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
                                  onChange={(e) =>
                                    updateAuthor(i, "middle", e.target.value)
                                  }
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
                                aria-describedby={`${orgId}-hint`}
                                value={a.org || ""}
                                onChange={(e) =>
                                  updateAuthor(i, "org", e.target.value)
                                }
                              />
                              <span
                                className="dcg-field-hint"
                                id={`${orgId}-hint`}
                              >
                                Enter the full organization name.
                              </span>
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
                  <button
                    className="dcg-btn secondary dcg-add-author"
                    type="button"
                    onClick={addAuthor}
                  >
                    + Add author
                  </button>
                </div>
              </div>

              <div className="dcg-row single">
                <div>
                  <div className="dcg-label-row">
                    <label htmlFor={publisherId}>Publisher or Repository</label>
                    <FieldHelp
                      id="help-publisher"
                      text={FIELD_HELP.publisher}
                    />
                  </div>
                  <input
                    id={publisherId}
                    aria-describedby={publisherHintId}
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                  />
                  <span className="dcg-field-hint" id={publisherHintId}>
                    Enter the organization that made the dataset available.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="dcg-field-group">
            <h3 className="dcg-group-heading">
              <SectionIcon type="when" />
              <span>Log the dates</span>
            </h3>
            <div className="dcg-field-group-body">
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
                    aria-describedby={yearHintId}
                    value={year}
                    onChange={(e) => {
                      const next = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 4);
                      setYear(next);
                    }}
                  />
                  <span className="dcg-field-hint" id={yearHintId}>
                    Format: YYYY
                  </span>
                </div>
              </div>

              <div className="dcg-row single">
                <div>
                  <div className="dcg-label-row">
                    <label htmlFor={temporalCoverageId}>
                      Temporal coverage{" "}
                      <span className="dcg-muted">(optional)</span>
                    </label>
                    <FieldHelp
                      id="help-temporal-coverage"
                      text={FIELD_HELP.temporalCoverage}
                    />
                  </div>
                  <input
                    id={temporalCoverageId}
                    aria-describedby={temporalCoverageHintId}
                    value={temporalCoverage}
                    onChange={(e) => setTemporalCoverage(e.target.value)}
                  />
                  <span className="dcg-field-hint" id={temporalCoverageHintId}>
                    Example: 2010–2020
                  </span>
                </div>
              </div>

              <div className="dcg-row single">
                <div className="dcg-date-accessed">
                  <div className="dcg-label-row">
                    <label
                      className="dcg-checkbox-label"
                      htmlFor={includeDateAccessedId}
                    >
                      <input
                        id={includeDateAccessedId}
                        type="checkbox"
                        checked={includeDateAccessed}
                        aria-controls={dateAccessedControlId}
                        aria-expanded={includeDateAccessed}
                        onChange={(event) => {
                          const include = event.target.checked;
                          setIncludeDateAccessed(include);
                          if (include && !dateAccessed) {
                            setDateAccessed(todayForDateInput());
                          }
                        }}
                      />
                      <span>Date accessed</span>
                    </label>
                    <FieldHelp id="help-accessed" text={FIELD_HELP.accessed} />
                  </div>
                  {includeDateAccessed && (
                    <div
                      className="dcg-date-accessed-input"
                      id={dateAccessedControlId}
                    >
                      <input
                        id={dateAccessedId}
                        type="date"
                        aria-label="Date accessed"
                        value={dateAccessed}
                        onChange={(e) => setDateAccessed(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="dcg-clear-area" aria-live="polite">
            {clearPending ? (
              <div
                className="dcg-clear-confirmation"
                role="group"
                aria-label="Confirm clearing citation fields"
              >
                <span>Clear all entered citation details?</span>
                <button
                  className="dcg-clear-confirm"
                  type="button"
                  onClick={clearForm}
                >
                  Yes, clear fields
                </button>
                <button
                  className="dcg-clear-cancel"
                  type="button"
                  onClick={() => setClearPending(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="dcg-clear-trigger"
                type="button"
                onClick={() => setClearPending(true)}
              >
                Clear all fields
              </button>
            )}
          </div>
        </section>

        <section className="dcg-card dcg-output-card">
          <div className="dcg-output-header">
            <div className="dcg-output-title dcg-step-heading">
              <p className="dcg-step-label">Step 3</p>
              <h2>Use your citation</h2>
              <p>Choose a citation style, then copy or download the result.</p>
            </div>
            <fieldset className="dcg-style-options">
              <legend>Citation style</legend>
              <div className="dcg-style-list">
                {(
                  [
                    ["apa", "APA"],
                    ["mla", "MLA"],
                    ["chicago", "Chicago"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name={`${idPrefix}-style`}
                      value={value}
                      checked={style === value}
                      onChange={() => setStyle(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="dcg-output">
            <div
              className="dcg-output-text"
              dangerouslySetInnerHTML={{
                __html: html || "Fill the form to see a preview.",
              }}
            />
            <button
              className={
                "dcg-btn secondary dcg-copy-btn" + (copied ? " is-copied" : "")
              }
              type="button"
              onClick={copyPlainText}
              disabled={copied}
              aria-live="polite"
            >
              <CopyIcon />
              {copied ? "Copied!" : "Copy citation"}
            </button>
          </div>
          <div className="dcg-export">
            <p className="dcg-export-label">
              Export for RefWorks, Zotero, EndNote
            </p>
            <div className="dcg-export-buttons">
              <button
                className="dcg-btn secondary dcg-export-btn"
                type="button"
                onClick={downloadRIS}
              >
                <DownloadIcon />
                <span>Download RIS</span>
              </button>
              <button
                className="dcg-btn secondary dcg-export-btn"
                type="button"
                onClick={downloadBibtex}
              >
                <DownloadIcon />
                <span>Download BibTeX</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
