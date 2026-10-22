import { getSession } from "./session";

async function request(type, session, fields = {}) {
    const active = session || await getSession();
    const response = await chrome.runtime.sendMessage({ type, token: active.token, ...fields });
    if (!response?.success) throw new Error(response?.error || "Could not update your saved work.");
    return response;
}

export const getDraftState = (session) => request("GET_DRAFT_STATE", session);
export const setPendingJob = async (job, session) => (await request("SET_PENDING_JOB", session, { job })).draft;
export const setManualEntryJob = (job, session) => request("SET_MANUAL_JOB", session, { job });
export const removePendingJob = (session, revision) => request("REMOVE_PENDING_JOB", session, { revision });
export const claimLegacyDrafts = (session) => request("CLAIM_LEGACY_DRAFTS", session);
