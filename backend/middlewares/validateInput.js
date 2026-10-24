const textLimits = {
    title: 500, company: 500, source: 500, url: 8192, jobId: 500,
    location: 2000, salary: 2000, experience: 10000, education: 10000,
    description: 30000, jobDescription: 30000, pageText: 30000,
    name: 200, email: 320, status: 100
};

function validateInput(req, res, next) {
    if (!['POST', 'PATCH', 'DELETE'].includes(req.method) || req.body === undefined) return next();
    const body = req.body;
    const reject = error => res.status(400).json({ error });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reject('Request body must be a JSON object');
    for (const [field, max] of Object.entries(textLimits)) {
        if (body[field] === undefined || body[field] === null) continue;
        if (typeof body[field] !== 'string') return reject(`${field} must be text`);
        if (body[field].length > max) return reject(`${field} must be at most ${max} characters`);
    }
    for (const field of ['responsibilities', 'requiredSkills', 'preferredSkills']) {
        if (body[field] === undefined || body[field] === null) continue;
        if (!Array.isArray(body[field]) || body[field].length > 100 ||
            body[field].some(item => typeof item !== 'string' || item.length > 2000)) {
            return reject(`${field} must be an array of up to 100 text items, each at most 2000 characters`);
        }
    }
    if (body.jobIds !== undefined && (!Array.isArray(body.jobIds) || body.jobIds.length > 1000 ||
        body.jobIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)))) {
        return reject('jobIds must contain at most 1000 valid job IDs');
    }
    return next();
}

// Keep parser failures in the same JSON format as controller errors.
function inputError(error, req, res, next) {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large (maximum 100 KB)' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body contains invalid JSON' });
    return next(error);
}

module.exports = { validateInput, inputError };
