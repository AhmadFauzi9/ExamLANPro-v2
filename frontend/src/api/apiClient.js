/**
 * ExamLAN Pro - Core API Client
 */

export const API_BASE_URL = 'api.php';

export async function apiRequest(action, options = {}) {
    const { method = 'GET', data = null, keepalive = false, cache = 'no-store' } = options;

    let url = `${API_BASE_URL}?action=${encodeURIComponent(action)}`;
    const fetchOptions = {
        method,
        cache,
        keepalive,
        headers: {}
    };

    if (method === 'POST') {
        fetchOptions.headers['Content-Type'] = 'application/json';
        if (data) {
            fetchOptions.body = JSON.stringify(data);
        }
    } else if (data && method === 'GET') {
        const queryParams = new URLSearchParams(data).toString();
        url += (url.includes('?') ? '&' : '?') + queryParams;
    }

    try {
        const response = await fetch(url, fetchOptions);
        const json = await response.json();
        return { ok: response.ok, status: response.status, data: json };
    } catch (err) {
        return { ok: false, status: 0, error: err.message || 'Gagal menghubungi server.', data: null };
    }
}
