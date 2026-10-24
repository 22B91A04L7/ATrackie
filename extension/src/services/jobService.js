import { getAuthToken, clearAuthToken } from "../utils/auth"
import { API_URL } from "../config";

export async function extractJob(pageText, sessionToken) {
    const token = sessionToken || await getAuthToken();

    const response = await request(
        `${API_URL}/api/jobs/extract`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                pageText,
            }),
        },
    );

    const data = await readResponse(response, token);


    if (!response.ok) {
        throw new Error(
            data.error || "Failed to extract job information.",
        );
    }

    if (!data.jobData) {
        throw new Error("Backend returned no job data.");
    }

    return data.jobData;
}

export async function checkJobDuplicate(url, sessionToken) {
    const token = sessionToken || await getAuthToken();

    const response = await request(
        `${API_URL}/api/jobs/check-duplicate`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                url,
            }),
        },
    );

    const data = await readResponse(response, token);


    if (!response.ok) {
        throw new Error(
            data.error || "Failed to check duplicate job.",
        );
    }

    if (typeof data.exists !== "boolean") throw new Error("The backend returned an unexpected duplicate-check response. Please try again.");
    return {
        exists: data.exists,
        jobId: data.jobId,
    };
}

export async function saveJob(job, sessionToken) {
    const token = sessionToken || await getAuthToken();

    const response = await request(
        `${API_URL}/api/jobs`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(job),
        },
    );

    const data = await readResponse(response, token);


    // Recover when an earlier save succeeded but its response was lost.
    if (response.status === 409 && data.job) return { job: data.job, alreadySaved: true };
    if (!response.ok) throw new Error(data.error || "Failed to save job.");
    if (!data.job || !data.job._id) throw new Error("The backend did not confirm the saved application. Please retry; your pending draft is preserved.");

    return data;
}


async function request(url, options) {
    const signal = AbortSignal.timeout(url.endsWith("/extract") ? 120000 : 30000);
    try {
        const response = await fetch(url, { ...options, signal });
        // Keep the same deadline while reading the response body.
        return { ok: response.ok, status: response.status, signal, json: () => response.json() };
    } catch {
        if (signal.aborted) throw new Error("The request timed out. Please try again. Your pending draft is preserved; a save may already have completed.");
        throw new Error("Could not reach the backend. Check your connection and try again. If saving, retrying will not create a duplicate.");
    }
}

async function readResponse(response, token) {
    // Check authentication before parsing: proxies can return HTML for a 401.
    if (response.status === 401) {
        await clearAuthToken(token);
        throw new Error("Your session has expired. Please reconnect your account.");
    }
    try {
        const data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
        return data;
    } catch {
        if (response.signal?.aborted) throw new Error("The response timed out. Your pending draft is preserved; retrying a save will recover an application already saved.");
        throw new Error(response.ok
            ? "The backend returned an unexpected response. Please try again."
            : "The backend could not complete the request (HTTP " + response.status + "). Please try again.");
    }
}
