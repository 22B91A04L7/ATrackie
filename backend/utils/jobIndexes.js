const Job = require("../models/Job");

// Never delete or merge existing applications to make an index fit.
async function ensureJobIndexes() {
    const duplicates = await Job.aggregate([
        { $group: { _id: { userId: "$userId", url: "$url" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 }
    ]);
    if (duplicates.length) {
        throw new Error("Duplicate applications exist. Review them before enabling unique_user_job_url; no records were changed.");
    }
    await Job.createIndexes();
}

module.exports = { ensureJobIndexes };
