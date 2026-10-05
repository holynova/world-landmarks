import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config';
import { ManifestSchema, type Manifest } from '../src/lib/schema';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src', 'data');

async function readManifest(): Promise<Manifest> {
  const filePath = path.join(DATA_DIR, 'manifest.json');
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`无法读取 manifest.json：${(error as Error).message}`);
  }
  const result = ManifestSchema.safeParse(raw);
  if (!result.success) throw new Error(`manifest 校验失败：${result.error.message}`);
  return result.data;
}

async function assertFile(relativeUrl: string): Promise<void> {
  if (!relativeUrl.startsWith('/media/')) throw new Error(`派生图片路径不在 /media 下：${relativeUrl}`);
  const absolute = path.join(ROOT, 'public', relativeUrl.slice(1));
  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile() || stat.size < 1) throw new Error('不是非空文件');
  } catch (error) {
    throw new Error(`manifest 引用了缺失图片 ${relativeUrl}：${(error as Error).message}`);
  }
}

async function main(): Promise<void> {
  const { site, collections, images: imageConfig } = await loadConfig(ROOT);
  const manifest = await readManifest();
  const collectionIds = new Set(collections.collections.map((collection) => collection.id));
  if (new Set(manifest.images.map((image) => image.slug)).size !== manifest.images.length) {
    throw new Error('manifest 存在重复 slug');
  }
  if (new Set(manifest.images.map((image) => image.id)).size !== manifest.images.length) {
    throw new Error('manifest 存在重复 id');
  }
  const sources = new Set(imageConfig.images.map((image) => image.source));
  const seenUrls = new Set<string>();
  let outputBytes = 0;
  for (const image of manifest.images) {
    if (!collectionIds.has(image.collection)) throw new Error(`manifest 图片栏目不存在：${image.collection}`);
    if (!sources.has(image.source)) throw new Error(`manifest 图片没有对应配置：${image.source}`);
    if (!image.alt.trim()) throw new Error(`图片 alt 为空：${image.slug}`);
    if (image.width < 1 || image.height < 1) throw new Error(`图片尺寸异常：${image.slug}`);
    for (const stage of [image.variants.thumb, image.variants.detail]) {
      for (const variants of Object.values(stage)) {
        const widths = variants.map((variant) => variant.width);
        if (new Set(widths).size !== widths.length) throw new Error(`响应式宽度重复：${image.slug}`);
        for (const variant of variants) {
          if (seenUrls.has(variant.src) && !image.duplicateOf) {
            throw new Error(`派生图片路径重复：${variant.src}`);
          }
          if (!seenUrls.has(variant.src)) {
            seenUrls.add(variant.src);
            outputBytes += variant.bytes;
          }
          await assertFile(variant.src);
        }
      }
    }
  }
  if (manifest.images.length !== imageConfig.images.length) {
    throw new Error(`manifest 图片数量 ${manifest.images.length} 与配置 ${imageConfig.images.length} 不一致`);
  }
  const budget = site.layout.maxOutputBytes;
  if (outputBytes > budget) {
    throw new Error(`输出预算超限：${outputBytes} bytes > ${budget} bytes，请调整图片宽度/质量或 maxOutputBytes`);
  }
  console.log(`校验通过：${manifest.images.length} 张图片、${seenUrls.size} 个响应式派生文件、${outputBytes} bytes 输出。`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
