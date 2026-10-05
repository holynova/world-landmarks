import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageManifest, SiteConfig, Variant } from '../src/lib/schema';

export const SUPPORTED_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.tif', '.tiff', '.webp']);

export type InputFile = {
  absolutePath: string;
  relativePath: string;
};

export async function scanIncoming(incomingDir: string): Promise<InputFile[]> {
  const files: InputFile[] = [];
  const unsupported: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'README.md') continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        const relativePath = path.relative(incomingDir, absolutePath).split(path.sep).join('/');
        if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          files.push({ absolutePath, relativePath });
        } else {
          unsupported.push(relativePath);
        }
      }
    }
  }
  await visit(incomingDir);
  if (unsupported.length) {
    throw new Error(`incoming 中存在不支持的输入文件:\n- ${unsupported.join('\n- ')}`);
  }
  return files;
}

export async function sha256File(filePath: string): Promise<string> {
  const contents = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

export function orientedDimensions(metadata: { width?: number; height?: number; orientation?: number }): { width: number; height: number } {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const orientation = metadata.orientation ?? 1;
  const rotates = [5, 6, 7, 8].includes(orientation);
  return rotates ? { width: height, height: width } : { width, height };
}

export function chooseVariantWidths(sourceWidth: number, requested: number[]): number[] {
  const candidates = [...new Set(requested.filter((width) => Number.isInteger(width) && width > 0))]
    .sort((a, b) => a - b)
    .filter((width) => width < sourceWidth);
  candidates.push(sourceWidth);
  return [...new Set(candidates)];
}

type VariantFormat = 'avif' | 'webp' | 'jpeg';
type VariantStage = 'thumb' | 'detail';

const extensionForFormat: Record<VariantFormat, string> = {
  avif: 'avif',
  webp: 'webp',
  jpeg: 'jpg',
};

function srcFor(slug: string, stage: VariantStage, requestedWidth: number, format: VariantFormat): string {
  return `/media/${slug}/${stage}-${requestedWidth}.${extensionForFormat[format]}`;
}

async function existingVariant(
  previous: ImageManifest | undefined,
  outputPath: string,
  expectedSrc: string,
  expectedFormat: VariantFormat,
): Promise<Variant | undefined> {
  if (!previous || previous.sourceHash === '') return undefined;
  try {
    const stats = await fs.stat(outputPath);
    if (!stats.isFile() || stats.size < 1) return undefined;
    const previousVariants = [
      ...previous.variants.thumb[expectedFormat],
      ...previous.variants.detail[expectedFormat],
    ];
    const match = previousVariants.find((variant) => variant.src === expectedSrc && variant.format === expectedFormat);
    return match ? { ...match, bytes: stats.size } : undefined;
  } catch {
    return undefined;
  }
}

async function writeVariant(
  sourcePath: string,
  outputPath: string,
  format: VariantFormat,
  requestedWidth: number,
  quality: number,
): Promise<Variant> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  let pipeline = sharp(sourcePath, { failOn: 'warning' }).rotate().resize({
    width: requestedWidth,
    withoutEnlargement: true,
    fit: 'inside',
  });
  if (format === 'avif') {
    pipeline = pipeline.avif({ quality, effort: 4 });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality, effort: 4 });
  } else {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, progressive: true, mozjpeg: true });
  }
  const info = await pipeline.toFile(outputPath);
  if (!info.width || !info.height) throw new Error(`图片处理没有返回尺寸: ${outputPath}`);
  return {
    width: info.width,
    height: info.height,
    src: '',
    format,
    bytes: info.size,
  };
}

export async function buildImageVariants(options: {
  sourcePath: string;
  outputDir: string;
  slug: string;
  sourceWidth: number;
  sourceHash: string;
  site: SiteConfig;
  previous?: ImageManifest;
}): Promise<{
  thumb: Record<VariantFormat, Variant[]>;
  detail: Record<VariantFormat, Variant[]>;
  skipped: boolean;
}> {
  const formats: VariantFormat[] = ['avif', 'webp', 'jpeg'];
  const stages: Array<{ name: VariantStage; widths: number[] }> = [
    { name: 'thumb', widths: chooseVariantWidths(options.sourceWidth, options.site.layout.thumbWidths) },
    { name: 'detail', widths: chooseVariantWidths(options.sourceWidth, options.site.layout.detailWidths) },
  ];
  const result = {
    thumb: { avif: [], webp: [], jpeg: [] } as Record<VariantFormat, Variant[]>,
    detail: { avif: [], webp: [], jpeg: [] } as Record<VariantFormat, Variant[]>,
  };
  let allSkipped = true;
  for (const stage of stages) {
    for (const format of formats) {
      const quality = options.site.layout.quality[format];
      for (const requestedWidth of stage.widths) {
        const src = srcFor(options.slug, stage.name, requestedWidth, format);
        const outputPath = path.join(options.outputDir, `${stage.name}-${requestedWidth}.${extensionForFormat[format]}`);
        const reusable = options.previous?.sourceHash === options.sourceHash
          ? await existingVariant(options.previous, outputPath, src, format)
          : undefined;
        const variant = reusable ?? await writeVariant(options.sourcePath, outputPath, format, requestedWidth, quality);
        if (!reusable) allSkipped = false;
        variant.src = src;
        result[stage.name][format].push(variant);
      }
    }
  }
  return { ...result, skipped: allSkipped };
}

export async function makePlaceholder(sourcePath: string): Promise<string> {
  const buffer = await sharp(sourcePath, { failOn: 'warning' })
    .rotate()
    .resize({ width: 32, withoutEnlargement: true, fit: 'inside' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 45, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
