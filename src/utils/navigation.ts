import { Role } from '../types';

export interface ParsedRoute {
  path: string;
  role: Role | null;
  section: string;
  isLogin: boolean;
}

export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // If running on GitHub Pages (e.g., username.github.io/repo-name/...)
    if (window.location.hostname.includes('github.io')) {
      const match = window.location.pathname.match(/^(\/[^\/]+)/);
      if (match) {
        return match[1].replace(/\/$/, '');
      }
    }
  }
  // Root domain for Netlify, Vercel, localhost, or custom domains
  return '';
}

export function getAppPath(): string {
  if (typeof window === 'undefined') return '/';

  // Support hash router fallback if someone visited with #/path
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }

  // Support GitHub Pages redirect parameter ?p=/path
  const searchParams = new URLSearchParams(window.location.search);
  const pParam = searchParams.get('p');
  if (pParam) {
    return pParam.startsWith('/') ? pParam : '/' + pParam;
  }

  const base = getBaseUrl();
  let path = window.location.pathname;

  if (base && path.startsWith(base)) {
    path = path.slice(base.length);
  }

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Remove trailing slashes (except for root '/')
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  return path || '/';
}

export function buildAppUrl(subPath: string): string {
  const base = getBaseUrl();
  const clean = subPath.startsWith('/') ? subPath : '/' + subPath;
  const full = base + clean;
  return full || '/';
}

export function navigateTo(path: string, replace = false): void {
  if (typeof window === 'undefined') return;
  const targetUrl = buildAppUrl(path);

  if (window.location.pathname !== targetUrl) {
    if (replace) {
      window.history.replaceState({ path }, '', targetUrl);
    } else {
      window.history.pushState({ path }, '', targetUrl);
    }
    window.dispatchEvent(new Event('app:navigate'));
  }
}

export function parseRoute(rawPath: string): ParsedRoute {
  const clean = rawPath.replace(/^\/+/, '').split('?')[0];
  const parts = clean.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { path: '/', role: null, section: 'dashboard', isLogin: false };
  }

  // Login routes: /login, /login/admin, /login/teacher, /login/parent
  if (parts[0] === 'login') {
    const rolePart = parts[1] as Role | undefined;
    const role = (rolePart === 'admin' || rolePart === 'teacher' || rolePart === 'parent') ? rolePart : null;
    return { path: rawPath, role, section: 'dashboard', isLogin: true };
  }

  // Role routes: /admin/:section, /teacher/:section, /parent/:section
  const firstPart = parts[0] as Role;
  if (firstPart === 'admin' || firstPart === 'teacher' || firstPart === 'parent') {
    const section = parts[1] || (firstPart === 'parent' ? 'home' : 'dashboard');
    return { path: rawPath, role: firstPart, section, isLogin: false };
  }

  return { path: rawPath, role: null, section: 'dashboard', isLogin: false };
}
