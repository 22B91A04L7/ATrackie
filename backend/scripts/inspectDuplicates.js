// Read-only inspection. Never prints connection strings or modifies records.
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Job = require("../models/Job");

async function main() {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, serverSelectionTimeoutMS: 15000 });
    const groups = await Job.aggregate([
        { $group: {
            _id: { userId: "$userId", url: "$url" },
            count: { $sum: 1 },
            records: { $push: "$$ROOT" }
        } },
        { $match: { count: { $gt: 1 } } }
    ]);
    // Omit account IDs, URLs, and job content from diagnostics.
    console.log(JSON.stringify({
        duplicateGroups: groups.length,
        extraRecords: groups.reduce((sum, group) => sum + group.count - 1, 0),
        groups: groups.map((group, index) => {
            const ignored = new Set(["_id", "__v", "createdAt", "updatedAt", "timeline", "status"]);
            const fields = [...new Set(group.records.flatMap(record => Object.keys(record)))];
            return {
                group: index + 1,
                differingJobFields: fields.filter(field => !ignored.has(field) &&
                    new Set(group.records.map(record => JSON.stringify(record[field]))).size > 1),
                records: group.records.map(record => ({
                    id: record._id, status: record.status, createdAt: record.createdAt,
                    updatedAt: record.updatedAt, timeline: record.timeline
                }))
            };
        })
    }, null, 2));
}

main().catch(error => {
    console.error("Duplicate inspection failed:", error.name);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
