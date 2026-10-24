import { accountFromToken, draftKey, getSession } from "./utils/session";
import { DASHBOARD_URL, API_URL } from "./config";

// Serialize mutations across popups and dashboard tabs.
let queue = Promise.resolve();
const enqueue = (task) => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
};
const makeDraft = (job) => ({ job, revision: crypto.randomUUID() });

async function matchingSession(token) {
    const active = await getSession();
    const requested = accountFromToken(token);
    if (token !== active.token || requested.userId !== active.userId || requested.exp * 1000 <= Date.now()) {
        throw new Error("Your account changed. Reopen this page before continuing.");
    }
    return active;
}

async function handleMessage(message) {
    if (!message || typeof message.type !== "string") throw new Error("Invalid request.");
    if (message.type === "ACCOUNT_DELETED") {
        const session = await matchingSession(message.token);
        const response = await fetch(`${API_URL}/api/auth/session`, {
            headers: {Authorization: `Bearer ${session.token}`}, signal: AbortSignal.timeout(15000)
        });
        if (response.status !== 401) throw new Error("Account deletion could not be verified.");
        await chrome.storage.local.remove([draftKey(session.userId, "pending"), draftKey(session.userId, "manual"), "token"]);
        return {};
    }
    if (message.type === "CLEAR_EXPIRED_TOKEN") {
        const { token } = await chrome.storage.local.get("token");
        if (message.token && token === message.token) await chrome.storage.local.remove("token");
        return {};
    }
    if (message.type === "LOGOUT") {
        const { token } = await chrome.storage.local.get("token");
        if (!message.token || token !== message.token) throw new Error("Your account changed. Reopen this page before continuing.");
        await chrome.storage.local.remove("token");
        return {};
    }
    if (message.type === "AUTHENTICATE") {
        const account = accountFromToken(message.token);
        if (account.exp * 1000 <= Date.now()) throw new Error("Please sign in again.");
        const { token: previousToken } = await chrome.storage.local.get("token");
        // Hide the previous account immediately while verifying a different
        // session. Its drafts remain stored under their original owner.
        if (previousToken && previousToken !== message.token) await chrome.storage.local.remove("token");
        const response = await fetch(`${API_URL}/api/auth/session`, {
            headers: { Authorization: `Bearer ${message.token}` },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok || (await response.json()).userId !== account.userId) {
            throw new Error("Could not verify this account. Please sign in again.");
        }
        await chrome.storage.local.set({ token: message.token });
        return {};
    }
    const session = await matchingSession(message.token);
    const pendingKey = draftKey(session.userId, "pending");
    const manualKey = draftKey(session.userId, "manual");
    const stored = await chrome.storage.local.get([pendingKey, manualKey, "pendingJob", "manualEntryJob"]);
    switch (message.type) {
        case "GET_DRAFT_STATE":
            return { pending: stored[pendingKey] || null, hasManual: Boolean(stored[manualKey]), hasLegacy: Boolean(stored.pendingJob || stored.manualEntryJob) };
        case "GET_MANUAL_ENTRY_JOB":
            return { job: stored[manualKey]?.job || null, revision: stored[manualKey]?.revision || null };
        case "SET_PENDING_JOB":
        case "SET_MANUAL_JOB": {
            if (!message.job || typeof message.job !== "object" || Array.isArray(message.job)) throw new Error("Invalid job details.");
            const key = message.type === "SET_PENDING_JOB" ? pendingKey : manualKey;
            if (stored[key]) throw new Error("You already have unfinished work. Reopen the extension to continue it.");
            const draft = makeDraft(message.job);
            await chrome.storage.local.set({ [key]: draft });
            return { draft };
        }
        case "SAVE_MANUAL_ENTRY_JOB": {
            if (!message.job || typeof message.job !== "object" || Array.isArray(message.job)) throw new Error("Invalid job details.");
            if ((stored[manualKey]?.revision || null) !== (message.revision || null)) throw new Error("This draft changed. Reload the page before saving.");
            if (stored[pendingKey]) throw new Error("Confirm or discard your current pending application before saving another.");
            const draft = makeDraft(message.job);
            await chrome.storage.local.set({ [pendingKey]: draft, [manualKey]: null });
            return { draft };
        }
        case "REMOVE_PENDING_JOB":
            if (!message.revision || stored[pendingKey]?.revision !== message.revision) return { removed: false };
            await chrome.storage.local.remove(pendingKey);
            return { removed: true };
        case "CLAIM_LEGACY_DRAFTS": {
            if (stored[pendingKey] || stored[manualKey]) throw new Error("Finish your current drafts before restoring older work.");
            const changes = { pendingJob: null, manualEntryJob: null };
            if (stored.pendingJob) changes[pendingKey] = makeDraft(stored.pendingJob);
            if (stored.manualEntryJob) changes[manualKey] = makeDraft(stored.manualEntryJob);
            await chrome.storage.local.set(changes);
            return {};
        }
        default:
            throw new Error("Unsupported request.");
    }
}

function listener(message, sender, sendResponse) {
    if (sender.id !== chrome.runtime.id && sender.origin !== new URL(DASHBOARD_URL).origin) return false;
    enqueue(() => handleMessage(message))
        .then((result) => sendResponse({ success: true, ...result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
}
chrome.runtime.onMessage.addListener(listener);
chrome.runtime.onMessageExternal.addListener(listener);

async function refreshBadge() {
    let pending = false;
    try {
        const session = await getSession();
        const key = draftKey(session.userId, "pending");
        pending = Boolean((await chrome.storage.local.get(key))[key]);
    } catch { /* No active account. */ }
    await chrome.action.setBadgeText({ text: pending ? "1" : "" });
    if (pending) await chrome.action.setBadgeBackgroundColor({ color: "#2f5bd3" });
}
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.token || Object.keys(changes).some(key => key.startsWith("draft:")))) {
        enqueue(refreshBadge).catch(console.error);
    }
});
enqueue(refreshBadge).catch(console.error);
