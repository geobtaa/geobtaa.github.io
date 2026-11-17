export type PendingImage = { filename: string; path: string; mimeType: string; content: string };
const previews = new Map<string, string>();
export function setPendingImagePreviews(images: PendingImage[] = []) {
  previews.clear();
  for (const image of images) previews.set(image.path, `data:${image.mimeType};base64,${image.content}`);
}
export function pendingImagePreview(path: string) { return previews.get(path); }
