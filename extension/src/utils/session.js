// Decoding selects a local namespace; the backend verifies JWT signatures.
export function accountFromToken(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const { userId, exp } = JSON.parse(atob(payload));
        if (!/^[a-f\d]{24}$/i.test(userId) || !Number.isFinite(exp)) throw new Error();
        return { userId, exp };
    } catch {
        throw new Error("Please reconnect your account.");
    }
}

export async function getSession() {
    const { token } = await chrome.storage.local.get("token");
    if (!token) throw new Error("Connect your account to continue.");
    const account = accountFromToken(token);
    if (account.exp * 1000 <= Date.now()) throw new Error("Your session has expired. Please reconnect your account.");
    return { token, userId: account.userId };
}

export const draftKey = (userId, kind) => `draft:${userId}:${kind}`;
