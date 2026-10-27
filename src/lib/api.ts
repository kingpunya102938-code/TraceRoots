import type { UserRole } from '../shared/types';

const AUTH_TOKEN_KEY = 'traceroots_auth_token';
const ENTITLEMENT_KEY_STORAGE = 'traceroots_consumer_entitlement_key';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota/privacy mode errors
  }
}

export function getClientEntitlementKey(): string {
  try {
    let existing = localStorage.getItem(ENTITLEMENT_KEY_STORAGE);
    if (!existing) {
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      existing = `ent_${randomPart}`;
      localStorage.setItem(ENTITLEMENT_KEY_STORAGE, existing);
    }
    return existing;
  } catch {
    return 'ent_ephemeral_browser_session';
  }
}

export function createIdempotencyKey(prefix = 'idem'): string {
  const bytes = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${Date.now()}_${bytes}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getStoredAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('x-entitlement-key', getClientEntitlementKey());

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data as T;
}

export function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case 'farmer':
      return '/farmer';
    case 'wholesaler':
      return '/wholesaler';
    case 'retailer':
      return '/retailer';
    case 'consumer':
      return '/consumer';
    case 'transporter':
      return '/transporter';
    case 'partner':
      return '/partner';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

export function formatLocalDateInput(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalTimeInput(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function formatDisplayDateTime(isoOrDate: string | undefined | null): string {
  if (!isoOrDate) return 'Not recorded';
  const parsed = Date.parse(isoOrDate);
  if (Number.isNaN(parsed)) return isoOrDate;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(parsed));
}

export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatStorageMethodLabel(method: string): string {
  switch (method) {
    case 'ambient':
      return 'Ambient Field / Room Temp';
    case 'ventilated_crate':
      return 'Ventilated Plastic Crates';
    case 'cold_storage':
      return 'Cold Storage Chamber';
    case 'controlled_atmosphere':
      return 'Controlled Atmosphere Cold Room';
    case 'refrigerated_transport':
      return 'Refrigerated Reefer Vehicle';
    case 'dry_warehouse':
      return 'Dry Ventilated Warehouse';
    default:
      return method;
  }
}

export async function compressImageFileToDataUrl(
  file: File,
  maxWidth = 720,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
