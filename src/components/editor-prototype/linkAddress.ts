// Normalize only clear website addresses entered by an editor. Relative paths,
// filenames, anchors, and explicit schemes retain their existing meaning.
export function normalizeLinkAddress(value: string): string {
  const address = value.trim();
  if (!address || /^[/.?#]/.test(address) || /\s/.test(address)) return address;
  const hostWithPort = address.split(/[/?#]/, 1)[0];
  if (/^[a-z][a-z\d+.-]*:/i.test(address) && !/^[^:]+:\d+$/.test(hostWithPort)) return address;
  const hostname = hostWithPort.replace(/:\d+$/, '');
  if (!/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(hostname)) return address;
  // A bare local filename can otherwise look like a domain name.
  if (/\.(?:html?|mdx?|pdf|png|jpe?g|gif|svg|webp|zip|csv|json|xml|txt|xlsx?|docx?|pptx?|css|js|mp4|gz|7z|geojson|topojson|jsonl|shp|gpkg|tiff?|kml|kmz|gpx|parquet)$/i.test(hostname)) return address;
  return `https://${address}`;
}
