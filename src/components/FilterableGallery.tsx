// /src/components/FilterableGallery.tsx
import { useState } from 'react';

export interface Map {
  year: string;
  title: string;
  name: string;
  institution: string;
  other_authors?: string;
  abstract: string;
  link: string;
  image: string;   // from CSV (e.g., "map-gallery/foo.jpg" or "/map-gallery/foo.jpg")
  kind: string;
}

function resolveUrl(maybePath: string) {
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  if (!maybePath) return '';
  if (/^https?:\/\//i.test(maybePath)) return maybePath;           // allow absolute URLs
  const trimmed = maybePath.trim().replace(/^\/+/, '');            // drop leading slashes
  return base.replace(/\/+$/, '/') + trimmed;                      // join with BASE_URL
}

export default function FilterableGallery({ maps }: { maps: Map[] }) {
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const years = ['2025', '2023', '2022', '2021', '2020'];

  const filteredMaps = maps.filter(m => m.year === selectedYear);
  const interactiveMaps = filteredMaps.filter(m => m.kind.includes('Interactive'));
  const staticMaps = filteredMaps.filter(m => m.kind.includes('Static'));

  const open = (m: Map) => setSelectedMap(m);
  const close = () => setSelectedMap(null);

  return (
    <div>
      <div className="filter-controls">
        <label htmlFor="year-select">Select Map Gallery Year:</label>
        <select id="year-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <h2>Interactive Maps</h2>
      <hr />
      <div className="gallery-grid">
        {interactiveMaps.map(m => {
          const img = resolveUrl(m.image);
          return (
            <div key={m.link} className="project-card" onClick={() => open(m)}>
              <img src={img} alt={m.title} className="card-image" loading="lazy" />
              <div className="card-content">
                <h3>{m.title}</h3>
                <p>{`${m.name}, ${m.institution}${m.other_authors ? '; ' + m.other_authors : ''}`}</p>
              </div>
            </div>
          );
        })}
      </div>

      <h2>Static Maps</h2>
      <hr />
      <div className="gallery-grid">
        {staticMaps.map(m => {
          const img = resolveUrl(m.image);
          return (
            <div key={m.link} className="project-card" onClick={() => open(m)}>
              <img src={img} alt={m.title} className="card-image" loading="lazy" />
              <div className="card-content">
                <h3>{m.title}</h3>
                <p>{`${m.name}, ${m.institution}${m.other_authors ? '; ' + m.other_authors : ''}`}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="modal-backdrop" onClick={close} data-visible={!!selectedMap}>
        {selectedMap && (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={close}>&times;</button>
            <h2>{selectedMap.title}</h2>
            <h4>{`${selectedMap.name}, ${selectedMap.institution}${selectedMap.other_authors ? '; ' + selectedMap.other_authors : ''}`}</h4>
            <a href={selectedMap.link} target="_blank" rel="noopener noreferrer">
              <img src={resolveUrl(selectedMap.image)} alt={selectedMap.title} className="modal-image" />
            </a>
            <p>{selectedMap.abstract}</p>
            <a href={selectedMap.link} className="modal-link-card" target="_blank" rel="noopener noreferrer">View Full Map &rarr;</a>
          </div>
        )}
      </div>
    </div>
  );
}
