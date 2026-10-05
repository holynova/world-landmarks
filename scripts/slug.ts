import path from 'node:path';

/**
 * Make a URL-safe, deterministic slug while retaining Chinese characters.
 * Keeping CJK code points avoids turning a filename into an opaque hash.
 */
export function slugify(value: string): string {
  const withoutExtension = value.replace(/\.[^.\/]+$/, '');
  const normalized = withoutExtension.normalize('NFKD').toLocaleLowerCase();
  const slug = normalized
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'image';
}

export function sourceSlug(relativeSource: string): string {
  return slugify(relativeSource.split(path.sep).join('/'));
}

export function idForSlug(slug: string): string {
  return `image-${slug}`;
}
