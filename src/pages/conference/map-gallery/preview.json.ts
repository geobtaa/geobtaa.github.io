import type { APIRoute } from 'astro';
import { loadGalleryMaps } from '../../../utils/mapGallery';

export const prerender = true;

export const GET: APIRoute = async () => {
  const maps = await loadGalleryMaps();

  return new Response(JSON.stringify(maps), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
