import { promises as fs } from 'fs';
import path from 'path';
import Papa from 'papaparse';

export interface GalleryMap {
  year: string;
  title: string;
  name: string;
  institution: string;
  other_authors?: string;
  abstract: string;
  link: string;
  image: string;
  kind: string;
  publish_status?: string;
  publication_status?: string;
}

const csvPath = path.join(process.cwd(), 'src/content/docs/conference/map-gallery/submissions.csv');

export async function loadGalleryMaps(): Promise<GalleryMap[]> {
  const csvFile = await fs.readFile(csvPath, 'utf-8');
  const parseResult = Papa.parse(csvFile, {
    header: true,
    skipEmptyLines: true,
  });

  return parseResult.data as GalleryMap[];
}

export function isPublished(map: GalleryMap): boolean {
  const status = (map.publication_status ?? map.publish_status ?? 'published').trim().toLowerCase();
  return status === 'published';
}
