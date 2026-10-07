import { trackGalleryEvent } from '../lib/analytics';
import type { ImageManifest, Manifest } from '../lib/schema';

const manifestElement = document.querySelector<HTMLScriptElement>('#gallery-manifest');
const configElement = document.querySelector<HTMLScriptElement>('#gallery-config');
const galleryElement = document.querySelector<HTMLElement>('[data-gallery]');
const lightboxElement = document.querySelector<HTMLDialogElement>('#lightbox');
if (!manifestElement || !configElement || !galleryElement || !lightboxElement) throw new Error('画廊初始化元素缺失');
const gallery = galleryElement;
const lightbox = lightboxElement;

const manifest = JSON.parse(manifestElement.textContent || '{"images":[]}') as Manifest;
const config = JSON.parse(configElement.textContent || '{}') as {
  features: { download: boolean; share: boolean };
  batchSize: number;
  layoutMode: 'grid' | 'masonry';
};
const basePath = document.documentElement.dataset.basePath ?? '/';
const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');
const toUrl = (source: string): string => source.startsWith('/') ? `${normalizedBasePath}${source}` : source;

let nextIndex = Math.min(config.batchSize, manifest.images.length);
let activeCollection = 'all';
let currentImageId: string | undefined;
let previouslyFocused: HTMLElement | null = null;

const visibleCount = document.querySelector<HTMLElement>('#visible-count');
const sentinel = document.querySelector<HTMLElement>('#gallery-sentinel');
const loadMore = document.querySelector<HTMLButtonElement>('#gallery-load-more');
const closeButton = document.querySelector<HTMLButtonElement>('[data-lightbox-close]');
const previousButton = document.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
const nextButton = document.querySelector<HTMLButtonElement>('[data-lightbox-next]');
const shareButton = document.querySelector<HTMLButtonElement>('[data-lightbox-share]');
const downloadLink = document.querySelector<HTMLAnchorElement>('[data-lightbox-download]');
const lightboxImage = document.querySelector<HTMLImageElement>('[data-lightbox-image]');
const lightboxAvif = document.querySelector<HTMLSourceElement>('[data-lightbox-avif]');
const lightboxWebp = document.querySelector<HTMLSourceElement>('[data-lightbox-webp]');
const lightboxCaption = document.querySelector<HTMLElement>('[data-lightbox-caption]');
const lightboxPosition = document.querySelector<HTMLElement>('#lightbox-position');

function variantSrcset(variants: ImageManifest['variants']['thumb']['avif']): string {
  return variants.map((variant) => `${toUrl(variant.src)} ${variant.width}w`).join(', ');
}

function createCard(image: ImageManifest, index: number): HTMLElement {
  const article = document.createElement('article');
  article.className = 'gallery-card';
  article.dataset.galleryCard = '';
  article.dataset.imageId = image.id;
  article.dataset.collection = image.collection;

  const button = document.createElement('button');
  button.className = 'gallery-card__button';
  button.type = 'button';
  button.dataset.galleryOpen = image.id;
  button.setAttribute('aria-label', `打开图片：${image.alt}`);
  const picture = document.createElement('picture');
  const avif = document.createElement('source');
  avif.type = 'image/avif';
  avif.srcset = variantSrcset(image.variants.thumb.avif);
  avif.sizes = '(min-width: 1100px) 31vw, (min-width: 700px) 47vw, 94vw';
  const webp = document.createElement('source');
  webp.type = 'image/webp';
  webp.srcset = variantSrcset(image.variants.thumb.webp);
  webp.sizes = avif.sizes;
  const fallback = image.variants.thumb.jpeg[0];
  const img = document.createElement('img');
  img.src = toUrl(fallback.src);
  img.srcset = variantSrcset(image.variants.thumb.jpeg);
  img.sizes = avif.sizes;
  img.width = image.width;
  img.height = image.height;
  img.alt = image.alt;
  img.loading = index === 0 ? 'eager' : 'lazy';
  img.decoding = 'async';
  picture.append(avif, webp, img);
  button.append(picture);
  article.append(button);
  if (image.caption) {
    const caption = document.createElement('p');
    caption.className = 'gallery-card__caption';
    caption.textContent = image.caption;
    article.append(caption);
  }
  return article;
}

function updateVisibleCount(): void {
  if (!visibleCount) return;
  const cards = [...gallery.querySelectorAll<HTMLElement>('[data-gallery-card]')];
  visibleCount.textContent = String(cards.filter((card) => !card.hidden).length);
}

function applyFilter(): void {
  for (const card of gallery.querySelectorAll<HTMLElement>('[data-gallery-card]')) {
    card.hidden = activeCollection !== 'all' && card.dataset.collection !== activeCollection;
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-collection-filter]')) {
    const isActive = button.dataset.collectionFilter === activeCollection;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }
  updateVisibleCount();
  const total = document.querySelector('#matched-count');
  if (total) total.textContent = String(navigationImages().length);
  const complete = nextIndex >= navigationImages().length;
  if (loadMore) loadMore.hidden = complete;
  if (sentinel) sentinel.hidden = complete;
}

function loadNextBatch(): void {
  const matching = navigationImages();
  if (nextIndex >= matching.length) {
    if (loadMore) loadMore.hidden = true;
    if (sentinel) sentinel.hidden = true;
    return;
  }
  const fragment = document.createDocumentFragment();
  const end = Math.min(nextIndex + config.batchSize, matching.length);
  for (let index = nextIndex; index < end; index += 1) fragment.append(createCard(matching[index], index));
  gallery.append(fragment);
  nextIndex = end;
  applyFilter();
  if (nextIndex >= matching.length) {
    if (loadMore) loadMore.hidden = true;
    if (sentinel) sentinel.hidden = true;
  }
}

function navigationImages(): ImageManifest[] {
  return activeCollection === 'all' ? manifest.images : manifest.images.filter((image) => image.collection === activeCollection);
}

function preloadAdjacent(image: ImageManifest): void {
  const images = navigationImages();
  const index = images.findIndex((candidate) => candidate.id === image.id);
  for (const adjacent of [images[index - 1], images[index + 1]]) {
    if (!adjacent) continue;
    const detail = adjacent.variants.detail.jpeg.find((variant) => variant.width >= 1440) ?? adjacent.variants.detail.jpeg.at(-1);
    if (detail) {
      const preload = new Image();
      preload.src = toUrl(detail.src);
    }
  }
}

let lightboxRevision = 0;

function setLightboxImage(image: ImageManifest): void {
  currentImageId = image.id;
  const req = ++lightboxRevision;
  const thumb = image.variants.thumb;
  const detail = image.variants.detail;
  const thumbFallback = thumb.jpeg.at(-1) ?? thumb.jpeg[0];
  const detailFallback = detail.jpeg.at(-1) ?? detail.jpeg[0];

  // 1. Immediately display thumbnail while detail loads and decodes
  if (lightboxAvif) lightboxAvif.srcset = variantSrcset(thumb.avif);
  if (lightboxWebp) lightboxWebp.srcset = variantSrcset(thumb.webp);
  if (lightboxImage) {
    lightboxImage.src = toUrl(thumbFallback.src);
    lightboxImage.srcset = variantSrcset(thumb.jpeg);
    lightboxImage.sizes = '100vw';
    lightboxImage.width = image.width;
    lightboxImage.height = image.height;
    lightboxImage.alt = image.alt;
  }
  if (lightboxCaption) lightboxCaption.textContent = image.caption || image.alt;
  const images = navigationImages();
  const index = images.findIndex((candidate) => candidate.id === image.id);
  if (lightboxPosition) lightboxPosition.textContent = `${index + 1} / ${images.length}`;
  if (downloadLink) {
    downloadLink.href = toUrl(image.download?.src || detailFallback.src);
    downloadLink.download = `${image.slug}.${image.download ? "png" : "jpg"}`;
  }

  // 2. Offscreen decode high-res detail and swap seamlessly
  const offscreen = new Image();
  const commit = async (): Promise<void> => {
    try {
      if (typeof offscreen.decode === 'function') await offscreen.decode();
    } catch {}
    if (req === lightboxRevision) {
      if (lightboxAvif) lightboxAvif.srcset = variantSrcset(detail.avif);
      if (lightboxWebp) lightboxWebp.srcset = variantSrcset(detail.webp);
      if (lightboxImage) {
        lightboxImage.src = toUrl(detailFallback.src);
        lightboxImage.srcset = variantSrcset(detail.jpeg);
      }
    }
  };
  offscreen.onload = () => { void commit(); };
  offscreen.src = toUrl(detailFallback.src);
  if (offscreen.complete && offscreen.naturalWidth > 0) {
    void commit();
  }

  preloadAdjacent(image);
}

function openLightbox(image: ImageManifest): void {
  if (!lightbox.showModal) return;
  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setLightboxImage(image);
  lightbox.showModal();
  closeButton?.focus();
  trackGalleryEvent('image_open', { image_id: image.id, collection: image.collection });
}

function closeLightbox(): void {
  lightboxRevision += 1;
  if (lightbox.open) lightbox.close();
  previouslyFocused?.focus();
  previouslyFocused = null;
}

function moveLightbox(step: -1 | 1): void {
  const images = navigationImages();
  const current = images.findIndex((image) => image.id === currentImageId);
  if (current < 0 || images.length < 2) return;
  const next = (current + step + images.length) % images.length;
  setLightboxImage(images[next]);
  trackGalleryEvent('image_open', { image_id: images[next].id, collection: images[next].collection });
}

gallery.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-gallery-open]') : null;
  if (!target) return;
  const image = manifest.images.find((candidate) => candidate.id === target.dataset.galleryOpen);
  if (image) openLightbox(image);
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-collection-filter]')) {
  button.addEventListener('click', () => {
    activeCollection = button.dataset.collectionFilter || 'all';
    trackGalleryEvent('collection_select', { collection: activeCollection });
    const matching = navigationImages();
    nextIndex = Math.min(config.batchSize, matching.length);
    gallery.replaceChildren(...matching.slice(0, nextIndex).map(createCard));
    applyFilter();
  });
}

closeButton?.addEventListener('click', closeLightbox);
previousButton?.addEventListener('click', () => moveLightbox(-1));
nextButton?.addEventListener('click', () => moveLightbox(1));
downloadLink?.addEventListener('click', () => {
  if (currentImageId) {
    const image = manifest.images.find((candidate) => candidate.id === currentImageId);
    if (image) trackGalleryEvent('image_download', { image_id: image.id, collection: image.collection });
  }
});
shareButton?.addEventListener('click', async () => {
  const image = manifest.images.find((candidate) => candidate.id === currentImageId);
  if (!image) return;
  const shareData = { title: image.caption || image.alt, text: image.alt, url: new URL(`?image=${encodeURIComponent(image.slug)}`, window.location.href).href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else if (navigator.clipboard) await navigator.clipboard.writeText(shareData.url);
    if (shareButton) {shareButton.textContent = '已分享'; setTimeout(() => {shareButton.textContent = '分享';}, 1800);}
    trackGalleryEvent('share_click', { image_id: image.id, collection: image.collection });
  } catch {
    // A cancelled native share is intentionally silent.
  }
});
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
lightbox.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeLightbox();
});
lightbox.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') return;
  if (event.key === 'ArrowLeft') return moveLightbox(-1);
  if (event.key === 'ArrowRight') return moveLightbox(1);
  if (event.key !== 'Tab') return;
  const focusable = [...lightbox.querySelectorAll<HTMLElement>('button, a[href]')].filter((element) => !element.hasAttribute('disabled'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

loadMore?.addEventListener('click', loadNextBatch);
if ('IntersectionObserver' in window && sentinel) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadNextBatch();
  }, { rootMargin: '900px 0px' });
  observer.observe(sentinel);
}

trackGalleryEvent('gallery_view', { collection: 'all' });
updateVisibleCount();

applyFilter();
const sharedImage = manifest.images.find(image => image.slug === new URLSearchParams(location.search).get("image"));
if (sharedImage) openLightbox(sharedImage);
