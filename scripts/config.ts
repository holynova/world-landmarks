import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  CollectionsConfigSchema,
  ImagesConfigSchema,
  SiteConfigSchema,
  type CollectionsConfig,
  type ImagesConfig,
  type SiteConfig,
} from '../src/lib/schema';

export function formatZodError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : '<root>'}: ${issue.message}`)
    .join('\n');
}

async function readYaml(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`无法读取配置 ${path.relative(process.cwd(), filePath)}: ${(error as Error).message}`);
  }
  try {
    return yaml.load(raw);
  } catch (error) {
    throw new Error(`YAML 解析失败 ${path.relative(process.cwd(), filePath)}: ${(error as Error).message}`);
  }
}

export async function loadConfig(root: string): Promise<{
  site: SiteConfig;
  collections: CollectionsConfig;
  images: ImagesConfig;
}> {
  const contentDir = path.join(root, 'content');
  const rawSite = await readYaml(path.join(contentDir, 'site.yml'));
  const rawCollections = await readYaml(path.join(contentDir, 'collections.yml'));
  const rawImages = await readYaml(path.join(contentDir, 'images.yml'));

  const siteResult = SiteConfigSchema.safeParse(rawSite);
  const collectionsResult = CollectionsConfigSchema.safeParse(rawCollections);
  const imagesResult = ImagesConfigSchema.safeParse(rawImages);
  const failures: string[] = [];
  if (!siteResult.success) failures.push(`content/site.yml\n${formatZodError(siteResult.error)}`);
  if (!collectionsResult.success) failures.push(`content/collections.yml\n${formatZodError(collectionsResult.error)}`);
  if (!imagesResult.success) failures.push(`content/images.yml\n${formatZodError(imagesResult.error)}`);
  if (failures.length) throw new Error(`配置校验失败:\n${failures.join('\n')}`);
  if (!siteResult.success || !collectionsResult.success || !imagesResult.success) {
    throw new Error('配置校验失败');
  }

  const site = siteResult.data;
  const collections = collectionsResult.data;
  const images = imagesResult.data;
  const collectionIds = new Set<string>();
  for (const collection of collections.collections) {
    if (collectionIds.has(collection.id)) throw new Error(`栏目 id 重复: ${collection.id}`);
    collectionIds.add(collection.id);
  }
  for (const image of images.images) {
    if (!collectionIds.has(image.collection)) {
      throw new Error(`图片 ${image.source} 引用了不存在的栏目 ${image.collection}`);
    }
  }
  const imageSources = new Set<string>();
  for (const image of images.images) {
    if (imageSources.has(image.source)) throw new Error(`图片 source 重复: ${image.source}`);
    imageSources.add(image.source);
  }
  return { site, collections, images };
}
