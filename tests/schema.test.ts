import { describe, expect, it } from 'vitest';
import manifest from '../src/data/manifest.json';
import { ImageMetadataSchema, ManifestSchema, SiteConfigSchema } from '../src/lib/schema';

describe('content schema', () => {
  it('rejects empty alt text', () => {
    expect(ImageMetadataSchema.safeParse({ source: 'a.jpg', collection: 'featured', alt: ' ' }).success).toBe(false);
  });

  it('applies safe defaults for optional site controls', () => {
    const parsed = SiteConfigSchema.parse({ title: '画廊', description: '描述' });
    expect(parsed.features.download).toBe(true);
    expect(parsed.layout.batchSize).toBe(24);
    expect(parsed.analytics.provider).toBe('umami');
  });

  it('accepts the generated machine-readable manifest', () => {
    const parsed = ManifestSchema.parse(manifest);
    expect(Array.isArray(parsed.images)).toBe(true);
    if (parsed.images[0]) expect(parsed.images[0].sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
