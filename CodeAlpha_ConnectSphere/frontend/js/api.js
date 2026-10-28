/* ConnectSphere – API helper
 * Every request to the Express backend goes through Api.request().
 *  - Sends JSON when a body is given.
 *  - Adds "Authorization: Bearer <token>" when we have a token.
 *  - Also sends cookies (same origin) in case your backend uses a cookie session.
 *  - Never fakes success: failures are thrown as ApiError.
 */
class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;   // HTTP status (0 = could not reach the server)
    this.data = data;       // parsed JSON error body, if any
    this.notJson = false;   // true when the server answered 200 with HTML (route missing)
  }

  /** True when the endpoint probably isn't built on the backend yet. */
  get isMissing() {
    return this.notJson || this.status === 404 || this.status === 405 || this.status === 501;
  }
}

const Api = (() => {
  function messageFromBody(data) {
    if (!data || typeof data !== 'object') return '';
    const direct = data.message || data.error || data.msg;
    if (typeof direct === 'string') return direct;
    if (direct && typeof direct.message === 'string') return direct.message;
    if (Array.isArray(data.errors) && data.errors.length) {
      return data.errors.map((e) => (typeof e === 'string' ? e : e.msg || e.message || '')).filter(Boolean).join(' ');
    }
    return '';
  }

  function friendlyStatus(status) {
    if (status === 400 || status === 422) return 'Some of the details look wrong. Please check them and try again.';
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to do that.';
    if (status === 404 || status === 405 || status === 501) return 'This feature is not available on the server yet.';
    if (status === 409) return 'That already exists. Try something different.';
    if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (status >= 500) return 'The server ran into a problem. Please try again shortly.';
    return 'Something went wrong. Please try again.';
  }

  /**
   * @param {string} path  e.g. '/posts' (API_BASE_URL is added for you)
   * @param {{method?:string, body?:any, auth?:boolean}} options
   */
  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { Accept: 'application/json' };
    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const token = auth ? Auth.getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(API_BASE_URL + path, { method, headers, body: payload, credentials: 'same-origin' });
    } catch (e) {
      throw new ApiError('Cannot reach the server. Check that the backend is running and try again.', 0);
    }

    const type = response.headers.get('content-type') || '';
    const isJson = type.includes('json');
    let data = null;
    if (isJson) {
      try { data = await response.json(); } catch (e) { data = null; }
    }

    if (!response.ok) {
      if (response.status === 401 && auth && Auth.isLoggedIn()) {
        Auth.expireSession(); // token no longer valid -> back to login
      }
      throw new ApiError(messageFromBody(data) || friendlyStatus(response.status), response.status, data);
    }

    if (response.status !== 204 && !isJson) {
      // A 200 that is not JSON usually means Express served an HTML page for an unknown route.
      const err = new ApiError('The server did not return JSON for this request.', response.status, null);
      err.notJson = true;
      throw err;
    }
    return data;
  }

  return {
    request,
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => request(path, { ...opts, method: 'POST', body: body === undefined ? {} : body }),
    put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
    del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),

    /** Pull an array out of common response shapes: [..], {posts:[..]}, {data:[..]}, {data:{posts:[..]}} */
    list(data, ...keys) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== 'object') return [];
      for (const k of [...keys, 'data', 'items', 'results']) {
        if (Array.isArray(data[k])) return data[k];
        if (data[k] && typeof data[k] === 'object') {
          for (const k2 of keys) if (Array.isArray(data[k][k2])) return data[k][k2];
        }
      }
      return [];
    },

    /** Pull one object out of {user:{..}} / {data:{..}} / {..} */
    item(data, ...keys) {
      if (!data || typeof data !== 'object') return null;
      for (const k of [...keys, 'data']) {
        if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k])) return data[k];
      }
      return data;
    }
  };
})();
