// Centralized API configuration and URL builder
export const apiBaseUrl: string = (
  import.meta.env.MODE === 'production'
    ? (import.meta.env.VITE_API_URL_PROD || 'https://researchtubeai-197336418001.asia-south2.run.app')
    : (import.meta.env.VITE_API_URL_DEV || 'http://localhost:8000')
).replace(/\/+$/, '');

/**
 * Builds an absolute API URL by joining apiBaseUrl with the given path,
 * ensuring no duplicate slashes are ever created.
 */
export function buildApiUrl(path: string): string {
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
