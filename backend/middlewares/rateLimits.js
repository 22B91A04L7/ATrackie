// Single-process limits for local development. Entries expire and are pruned.
function createLimiter({ windowMs, limit, key, failedLoginsOnly = false, now = Date.now }) {
    const entries = new Map();
    let nextCleanup = 0;
    return (req, res, next) => {
        const time = now();
        if (time >= nextCleanup) {
            for (const [id, entry] of entries) {
                if (entry.resetAt <= time) entries.delete(id);
            }
            nextCleanup = time + 60000;
        }
        const id = key(req);
        let entry = entries.get(id);
        if (!entry || entry.resetAt <= time) {
            entry = { count: 0, resetAt: time + windowMs };
            entries.set(id, entry);
        }
        if (entry.count >= limit) {
            const retryAfter = Math.max(1, Math.ceil((entry.resetAt - time) / 1000));
            res.setHeader('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: `Too many ${failedLoginsOnly ? 'login attempts' : 'AI extraction requests'}. Try again in ${retryAfter} seconds.`,
                retryAfter
            });
        }
        // Reserve a slot before asynchronous work to prevent parallel bypasses.
        entry.count++;
        if (failedLoginsOnly) {
            let settled = false;
            const release = (failed) => {
                if (settled) return;
                settled = true;
                if (!failed) entry.count--;
            };
            res.once('finish', () => release(res.statusCode === 400 || res.statusCode === 401));
            res.once('close', () => release(true));
        }
        next();
    };
}

const loginLimit = createLimiter({
    windowMs: 15 * 60 * 1000, limit: 10,
    key: req => req.ip, failedLoginsOnly: true
});
const extractionLimit = createLimiter({
    windowMs: 60 * 1000, limit: 10,
    key: req => req.user.userId
});

module.exports = { createLimiter, loginLimit, extractionLimit };
