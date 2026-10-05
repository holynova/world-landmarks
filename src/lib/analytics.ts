export type GalleryEventName = 'gallery_view' | 'collection_select' | 'image_open' | 'image_download' | 'share_click';

type Umami = {
  track?: (eventName: string, data?: Record<string, string>) => void;
};

declare global {
  interface Window {
    umami?: Umami;
  }
}

export function trackGalleryEvent(eventName: GalleryEventName, data: Record<string, string> = {}): void {
  if (typeof window === 'undefined') return;
  window.umami?.track?.(eventName, data);
}
