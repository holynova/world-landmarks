export function withBase(pathname: string): string {
  if (/^(?:https?:)?\/\//.test(pathname)) return pathname;
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}` || '/';
}
