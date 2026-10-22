// Preserve each caller's existing 401 navigation while sharing error handling.
export async function apiRequest(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("Could not reach the backend. Check your connection and try again.");
  }
  let data;
  try {
    data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
  } catch {
    if (response.status === 401) {
      data = { error: "Your session is invalid or expired. Please sign in again." };
    } else {
      throw new Error(`The backend returned an unexpected response (HTTP ${response.status}). Please try again.`);
    }
  }
  if (!response.ok && response.status !== 401) {
    throw new Error(typeof data.error === "string" ? data.error : `Request failed (HTTP ${response.status}). Please try again.`);
  }
  if (response.ok) {
    const path = new URL(url).pathname;
    const method = options?.method || "GET";
    const invalid = (path.endsWith('/auth/login') && typeof data.token !== 'string') ||
      (method === 'GET' && path === '/api/jobs' && !Array.isArray(data.jobs)) ||
      ((method === 'GET' || method === 'PATCH') && /^\/api\/jobs\/[^/]+(?:\/status)?$/.test(path) && !data.job?._id);
    if (invalid) throw new Error("The backend returned incomplete data. Please try again.");
  }
  return { ok: response.ok, status: response.status, json: async () => data };
}
