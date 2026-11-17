// Serve immutable blob queries without a network connection in API/storage tests.
export function blobQueryResponse(payload, files) {
  const repository = {};
  const blobs = new Map([...files].map(file => [file.sha, file]));
  for (const [, alias, encoded] of payload.query.matchAll(/\b(b\d+): object\(oid: ("(?:[^"\\]|\\.)*")\)/g)) {
    const oid = JSON.parse(encoded);
    const file = blobs.get(oid);
    repository[alias] = file ? { oid, text: file.content, isTruncated: false } : null;
  }
  return { data: { repository } };
}
