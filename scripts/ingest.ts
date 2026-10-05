import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadConfig } from './config';
import {
  buildImageVariants,
  makePlaceholder,
  orientedDimensions,
  scanIncoming,
  sha256File,
} from './image-pipeline';
import { idForSlug, sourceSlug } from './slug';
import { ManifestSchema, type ImageManifest, type Manifest } from '../src/lib/schema';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INCOMING_DIR = path.join(ROOT, 'incoming');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const DATA_DIR = path.join(ROOT, 'src', 'data');

async function readPreviousManifest(): Promise<Pick<Manifest, 'images' | 'processingSignature'>> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'manifest.json'), 'utf8')) as unknown;
    const parsed = ManifestSchema.safeParse(raw);
    return parsed.success ? parsed.data : { images: [], processingSignature: '' };
  } catch {
    return { images: [], processingSignature: '' };
  }
}

async function removeEmptyDirectories(directory: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = path.join(directory, entry);
    const stat = await fs.stat(child);
    if (stat.isDirectory()) await removeEmptyDirectories(child);
  }
  const after = await fs.readdir(directory);
  if (after.length === 0 && directory !== MEDIA_DIR) await fs.rmdir(directory);
}

async function removeStaleMedia(desired: Set<string>): Promise<number> {
  let removed = 0;
  async function visit(directory: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(directory);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const child = path.join(directory, entry);
      const stat = await fs.stat(child);
      if (stat.isDirectory()) {
        await visit(child);
      } else {
        const relative = `/${path.relative(path.join(ROOT, 'public'), child).split(path.sep).join('/')}`;
        if (!desired.has(relative)) {
          await fs.rm(child);
          removed += 1;
        }
      }
    }
  }
  await visit(MEDIA_DIR);
  await removeEmptyDirectories(MEDIA_DIR);
  return removed;
}

function ensureNoUnsafeSource(source: string): void {
  const normalized = path.posix.normalize(source);
  if (normalized.startsWith('../') || normalized.startsWith('/') || normalized.includes('/../')) {
    throw new Error(`图片 source 必须位于 incoming 内部: ${source}`);
  }
}

async function main(): Promise<void> {
  const { site, collections, images: imagesConfig } = await loadConfig(ROOT);
  const processingSignature = JSON.stringify({
    pipeline: 1,
    widths: { thumb: site.layout.thumbWidths, detail: site.layout.detailWidths },
    quality: site.layout.quality,
  });
  const incomingFiles = await scanIncoming(INCOMING_DIR);
  const incomingBySource = new Map(incomingFiles.map((file) => [file.relativePath, file]));
  const metadataBySource = new Map(imagesConfig.images.map((image) => [image.source, image]));
  const missing: string[] = [];
  for (const configured of imagesConfig.images) {
    ensureNoUnsafeSource(configured.source);
    if (!incomingBySource.has(configured.source)) missing.push(configured.source);
  }
  const unknown = incomingFiles.map((file) => file.relativePath).filter((source) => !metadataBySource.has(source));
  if (missing.length || unknown.length) {
    const details = [
      missing.length ? `配置中找不到原图:\n- ${missing.join('\n- ')}` : '',
      unknown.length ? `原图没有 content/images.yml 元数据:\n- ${unknown.join('\n- ')}` : '',
    ].filter(Boolean).join('\n');
    throw new Error(details);
  }

  const previous = await readPreviousManifest();
  const previousBySource = new Map(previous.images.map((image) => [image.source, image]));
  const seenSlugs = new Map<string, string>();
  const seenHashes = new Map<string, ImageManifest>();
  const outputImages: ImageManifest[] = [];
  let generated = 0;
  let skipped = 0;
  for (const file of incomingFiles) {
    const metadata = metadataBySource.get(file.relativePath);
    if (!metadata) throw new Error(`缺少图片元数据: ${file.relativePath}`);
    const slug = metadata.slug ? sourceSlug(metadata.slug) : sourceSlug(file.relativePath);
    const previousSlugSource = seenSlugs.get(slug);
    if (previousSlugSource) throw new Error(`slug 重复: ${slug}（来源 ${previousSlugSource} 与 ${file.relativePath}）`);
    seenSlugs.set(slug, file.relativePath);
    const sourceHash = await sha256File(file.absolutePath);
    const sourceMetadata = await sharp(file.absolutePath, { failOn: 'warning' }).metadata();
    const dimensions = orientedDimensions(sourceMetadata);
    if (!dimensions.width || !dimensions.height) throw new Error(`无法读取图片尺寸: ${file.relativePath}`);

    const duplicate = seenHashes.get(sourceHash);
    if (duplicate) {
      const duplicateManifest: ImageManifest = {
        ...duplicate,
        id: idForSlug(slug),
        slug,
        source: file.relativePath,
        collection: metadata.collection,
        alt: metadata.alt,
        caption: metadata.caption,
        duplicateOf: duplicate.slug,
      };
      outputImages.push(duplicateManifest);
      skipped += 1;
      continue;
    }

    const imageOutputDir = path.join(MEDIA_DIR, slug);
    const previousImage = previousBySource.get(file.relativePath);
    const reusablePrevious = previous.processingSignature === processingSignature ? previousImage : undefined;
    const variantResult = await buildImageVariants({
      sourcePath: file.absolutePath,
      outputDir: imageOutputDir,
      slug,
      sourceWidth: dimensions.width,
      sourceHash,
      site,
      previous: reusablePrevious,
    });
    const { skipped: variantsSkipped, ...variants } = variantResult;
    const manifestImage: ImageManifest = {
      id: idForSlug(slug),
      slug,
      source: file.relativePath,
      sourceHash,
      width: dimensions.width,
      height: dimensions.height,
      format: sourceMetadata.format ?? path.extname(file.relativePath).slice(1),
      collection: metadata.collection,
      alt: metadata.alt,
      caption: metadata.caption,
      placeholder: reusablePrevious?.sourceHash === sourceHash && reusablePrevious.placeholder
        ? reusablePrevious.placeholder
        : await makePlaceholder(file.absolutePath),
      variants,
    };
    outputImages.push(manifestImage);
    seenHashes.set(sourceHash, manifestImage);
    if (variantsSkipped) skipped += 1;
    else generated += 1;
  }

  const manifest = ManifestSchema.parse({
    version: 1,
    generatedBy: 'image-gallery-template',
    processingSignature,
    collections: collections.collections.toSorted((a, b) => a.order - b.order).map((collection) => collection.id),
    images: outputImages,
  });
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'site.json'), `${JSON.stringify(site, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'collections.json'), `${JSON.stringify(collections, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'images.json'), `${JSON.stringify(imagesConfig, null, 2)}\n`);
  const desired = new Set<string>();
  for (const image of outputImages) {
    for (const stage of [image.variants.thumb, image.variants.detail]) {
      for (const variants of Object.values(stage)) for (const variant of variants) desired.add(variant.src);
    }
  }
  const removed = await removeStaleMedia(desired);
  console.log(`图片处理完成：${outputImages.length} 张，生成 ${generated} 张，复用 ${skipped} 张，清理 ${removed} 个陈旧派生文件。`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
