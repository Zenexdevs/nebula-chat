/** Generates a free, keyless avatar URL from DiceBear's public API. */
export function generatedAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed || 'nebula');
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encoded}&backgroundColor=0a0a14,161628&shapeColor=00f0ff,a855f7,ff2fd0`;
}
