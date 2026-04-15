import { isDev, isProd } from '../utils/runtimeEnv';
import {
  resolveCsrfTokenForRequest,
  setCachedCsrfToken,
  clearCachedCsrfToken,
} from '../utils/csrfClientStore.js';

const BUILD_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let cachedSuperAdminBaseUrl: string | null = null;

async function getSuperAdminApiBaseUrl(): Promise<string> {
  if (cachedSuperAdminBaseUrl) return cachedSuperAdminBaseUrl;

  // In production, prefer public/config.json (same as tenant API service),
  // then convert /api -> /super-admin/api.
  let baseApiUrl = BUILD_API_URL;
  if (isProd) {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      if (res.ok) {
        const config = await res.json();
        if (config && config.apiUrl) {
          baseApiUrl = String(config.apiUrl).replace(/\/+$/, '');
          if (!baseApiUrl.endsWith('/api')) baseApiUrl += '/api';
        }
      }
    } catch {
      // fall back to build-time URL
    }
  }

  // Convert base API URL to Super Admin API URL.
  let base = baseApiUrl;
  if (base.endsWith('/api')) {
    base = base.replace(/\/api$/, '/super-admin/api');
  } else {
    base = base.replace(/\/+$/, '') + '/super-admin/api';
  }

  cachedSuperAdminBaseUrl = base;
  return cachedSuperAdminBaseUrl;
}

class SuperAdminApiService {
  async makeRequest(endpoint: string, options: RequestInit = {}) {
    const base = await getSuperAdminApiBaseUrl();
    const url = `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (isDev) {
      console.log('[SuperAdmin] API request:', url);
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    };

    const method = String(options.method || 'GET').toUpperCase();
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (unsafe) {
      const csrf = resolveCsrfTokenForRequest();
      if (csrf) (headers as Record<string, string>)['X-XSRF-TOKEN'] = csrf;
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        credentials: 'include',
        ...options,
        cache: options.cache !== undefined ? options.cache : 'no-store',
      });

      if (isDev) {
        console.log('[SuperAdmin] Response status:', response.status);
      }

      if (!response.ok) {
        const text = await response.text();
        if (isDev) console.error('[SuperAdmin] Error response:', text);
        let apiMessage = text || `HTTP error ${response.status}`;
        try {
          const j = JSON.parse(text) as { message?: string };
          if (j && typeof j.message === 'string' && j.message.trim()) {
            apiMessage = j.message.trim();
          }
        } catch {
          /* use raw text */
        }
        // 401 = missing/expired Super Admin session — clear client auth.
        // 403 = wrong password / forbidden action — must NOT log the user out.
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent('super-admin:sessionInvalid'));
        }
        const err = new Error(apiMessage) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        throw new Error('Empty response from Super Admin API');
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON from Super Admin API');
      }
      return data;
    } catch (err) {
      if (isDev) console.error('[SuperAdmin] API request failed:', err);
      throw err;
    }
  }

  // Auth
  async login(emailOrUsername: string, password: string) {
    const data = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername, password }),
    });
    const token = (data as { data?: { csrfToken?: string } })?.data?.csrfToken;
    if (token) setCachedCsrfToken(token);
    return data;
  }

  /** Cross-origin SPA: sync XSRF into memory (cookie is on API host only). */
  async ensureCsrfToken() {
    const base = await getSuperAdminApiBaseUrl();
    const url = `${base}/auth/csrf-token`.replace(/([^:]\/)\/+/g, '$1');
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      if (!res.ok || !text) return;
      const data = JSON.parse(text) as { data?: { csrfToken?: string } };
      const token = data?.data?.csrfToken;
      if (token) setCachedCsrfToken(token);
    } catch {
      // ignore
    }
  }

  async getProfile() {
    return this.makeRequest('/me');
  }

  async logout() {
    try {
      return await this.makeRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } finally {
      clearCachedCsrfToken();
    }
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    return this.makeRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  async updateProfile(username: string, currentPassword: string) {
    return this.makeRequest('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username, currentPassword }),
    });
  }

  // Schools
  async listSchools(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.makeRequest(`/schools${qs}`);
  }

  async updateSchoolStatus(id: number, status: 'active' | 'disabled') {
    return this.makeRequest(`/schools/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getSchoolById(id: number) {
    return this.makeRequest(`/schools/${id}`);
  }

  async updateSchool(
    id: number,
    payload: {
      school_name?: string;
      institute_number?: string;
      type?: string | null;
    }
  ) {
    return this.makeRequest(`/schools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Two-step protected delete: password → short-lived token → soft-delete school record.
   */
  async deleteSchool(id: number, password: string) {
    const challenge = await this.makeRequest(`/schools/${id}/delete-challenge`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    const deleteToken = (challenge as { data?: { deleteToken?: string } })?.data?.deleteToken;
    if (!deleteToken) {
      throw new Error('Delete confirmation was not issued');
    }
    return this.makeRequest(`/schools/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password, deleteToken }),
    });
  }

  async createSchool(payload: {
    school_name: string;
    type: string;
    institute_number: string;
    admin_name: string;
    admin_email: string;
    admin_password: string;
  }) {
    return this.makeRequest('/schools', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Platform stats
  async getPlatformStats() {
    return this.makeRequest('/stats/platform');
  }
}

export const superAdminApiService = new SuperAdminApiService();

