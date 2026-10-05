import { z } from 'zod';

const PositiveInt = z.number().int().positive();

export const SiteConfigSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    language: z.string().trim().min(2).default('zh-CN'),
    features: z
      .object({
        download: z.boolean().default(true),
        share: z.boolean().default(true),
      })
      .strict()
      .default({ download: true, share: true }),
    layout: z
      .object({
        mode: z.enum(['grid', 'masonry']).default('grid'),
        batchSize: PositiveInt.default(24),
        maxOutputBytes: PositiveInt.default(100_000_000),
        thumbWidths: z.array(PositiveInt).min(1).default([480, 768]),
        detailWidths: z.array(PositiveInt).min(1).default([960, 1440, 1920]),
        quality: z
          .object({
            avif: z.number().int().min(1).max(100).default(55),
            webp: z.number().int().min(1).max(100).default(78),
            jpeg: z.number().int().min(1).max(100).default(84),
          })
          .strict()
          .default({ avif: 55, webp: 78, jpeg: 84 }),
      })
      .strict()
      .default({
        mode: 'grid',
        batchSize: 24,
        maxOutputBytes: 100_000_000,
        thumbWidths: [480, 768],
        detailWidths: [960, 1440, 1920],
        quality: { avif: 55, webp: 78, jpeg: 84 },
      }),
    style: z
      .object({
        theme: z.enum(['minimal', 'dark', 'editorial']).default('minimal'),
      })
      .strict()
      .default({ theme: 'minimal' }),
    analytics: z
      .object({
        enabled: z.boolean().default(false),
        provider: z.literal('umami').default('umami'),
      })
      .strict()
      .default({ enabled: false, provider: 'umami' }),
  })
  .strict();

export const CollectionSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]*$/),
    title: z.string().trim().min(1),
    description: z.string().trim().optional().default(''),
    order: z.number().int().default(0),
  })
  .strict();

export const CollectionsConfigSchema = z
  .object({ collections: z.array(CollectionSchema).min(1) })
  .strict();

export const ImageMetadataSchema = z
  .object({
    source: z.string().trim().min(1),
    collection: z.string().trim().min(1),
    alt: z.string().trim().min(1),
    caption: z.string().trim().optional().default(''),
    slug: z.string().trim().min(1).optional(),
  })
  .strict();

export const ImagesConfigSchema = z
  .object({ images: z.array(ImageMetadataSchema) })
  .strict();

export const VariantSchema = z
  .object({
    width: PositiveInt,
    height: PositiveInt,
    src: z.string().regex(/^\/media\/[a-z0-9\u3400-\u9fff][a-z0-9\u3400-\u9fff_-]*\//),
    format: z.enum(['avif', 'webp', 'jpeg']),
    bytes: z.number().int().nonnegative(),
  })
  .strict();

export const ImageManifestSchema = z
  .object({
    id: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    source: z.string().trim().min(1),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    width: PositiveInt,
    height: PositiveInt,
    format: z.string().trim().min(1),
    collection: z.string().trim().min(1),
    alt: z.string().trim().min(1),
    caption: z.string(),
    placeholder: z.string().startsWith('data:image/'),
    variants: z
      .object({
        thumb: z
          .object({
            avif: z.array(VariantSchema).min(1),
            webp: z.array(VariantSchema).min(1),
            jpeg: z.array(VariantSchema).min(1),
          })
          .strict(),
        detail: z
          .object({
            avif: z.array(VariantSchema).min(1),
            webp: z.array(VariantSchema).min(1),
            jpeg: z.array(VariantSchema).min(1),
          })
          .strict(),
      })
      .strict(),
    download: z.object({src: z.string().startsWith('/media/'), bytes: z.number().int().nonnegative()}).optional(),
    duplicateOf: z.string().trim().min(1).optional(),
  })
  .strict();

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    generatedBy: z.literal('image-gallery-template'),
    processingSignature: z.string().trim().min(1),
    collections: z.array(z.string().trim().min(1)),
    images: z.array(ImageManifestSchema),
  })
  .strict();

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type CollectionsConfig = z.infer<typeof CollectionsConfigSchema>;
export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type ImageManifest = z.infer<typeof ImageManifestSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
