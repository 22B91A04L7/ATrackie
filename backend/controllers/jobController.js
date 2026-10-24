const mongoose = require("mongoose");
const Job = require("../models/Job")
const { extractJobData } = require("../services/aiService");
const { normalizeJobUrl } = require("../utils/url")
const { APPLICATION_STATUSES, STATUS_TRANSITIONS } = require("../constants/applicationStatus")

//controller to fetch all jobs
async function getJobs(req, res) {
    try {
        const jobs = await Job.find({
            userId: req.user.userId
        }).sort({ createdAt: -1 })
        res.status(200).json({
            jobs: jobs
        })
    } catch (error) {
        console.error("Fetch jobs error:", error);
        res.status(500).json({
            error: "Failed to fetch job applications"
        });
    }
}

//controller to fetch individual job using id
async function getJobById(req, res) {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid job ID format"
            });
        }
        const job = await Job.findOne({
            _id: id,
            userId: req.user.userId
        });
        if (!job) {
            return res.status(404).json({
                error: "Job application not found"
            })
        }
        res.status(200).json({
            job: job
        });
    } catch (error) {
        console.error("Fetch single job error:", error);

        res.status(500).json({
            error: "Failed to fetch job application"
        });
    }
}

// Controller to add a new job to DB
async function createJob(req, res) {
    try {
        const {
            title,
            company,
            jobId,
            location,
            salary,
            description,
            jobDescription,
            responsibilities,
            requiredSkills,
            preferredSkills,
            experience,
            education,
            url,
            source
        } = req.body || {};

        if (
            typeof title !== "string" ||
            typeof company !== "string" ||
            typeof url !== "string" ||
            typeof source !== "string" ||
            !title.trim() ||
            !company.trim() ||
            !url.trim() ||
            !source.trim()
        ) {
            return res.status(400).json({
                error: "title, company, url, and source must be non-empty strings"
            });
        }

        try {
            const parsedUrl = new URL(url);

            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                return res.status(400).json({
                    error: "url must be a valid HTTP or HTTPS URL"
                });
            }
        } catch {
            return res.status(400).json({
                error: "url must be a valid HTTP or HTTPS URL"
            });
        }

        const normalizedUrl = normalizeJobUrl(url);

        //duplicate job application check
        const existingJob = await Job.findOne({
            userId: req.user.userId,
            url: normalizedUrl
        });

        if (existingJob) {
            return res.status(409).json({
                error: "This job application is already in your tracker.",
                job: existingJob
            });
        }

        const appliedAt = new Date();

        const job = await Job.create({
            userId: req.user.userId,

            title,
            company,
            jobId: jobId || null,
            location: location || null,
            salary: salary || null,

            // Keep old field for backward compatibility
            description: description || null,

            // New AI-extracted fields
            jobDescription: jobDescription || null,
            responsibilities: responsibilities || [],
            requiredSkills: requiredSkills || [],
            preferredSkills: preferredSkills || [],
            experience: experience || null,
            education: education || null,

            url: normalizedUrl,
            source,

            status: "Applied",
            appliedAt,

            timeline: [
                {
                    status: "Applied",
                    timestamp: appliedAt
                }
            ]
        });

        // An account deletion may overlap a save already in flight.
        const owner = await require("../models/User").exists({_id: req.user.userId, deleting: {$ne: true}});
        if (!owner) {
            await Job.deleteOne({_id: job._id, userId: req.user.userId});
            return res.status(401).json({error: "This account is no longer active."});
        }
        res.status(201).json({
            message: "Job application saved",
            job
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: "This job application is already in your tracker."
            });
        }
        console.error("Save job error:", error);

        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({
                error: "Invalid job application data"
            });
        }

        res.status(500).json({
            error: "Failed to save job application"
        });
    }
}

//controller to extract job info
async function extractJob(req, res) {
    try {
        const { pageText } = req.body || {};
        if (typeof pageText !== "string" || !pageText.trim()) {
            return res.status(400).json({
                error: "Page text is required"
            });
        }

        if (pageText.length > 30000) {
            return res.status(400).json({
                error: "Page text is too large"
            });
        }

        const jobData = await extractJobData(pageText);
        res.json({
            jobData: jobData
        });

    } catch (error) {
        console.error("Job extraction error:", error);

        res.status(500).json({
            error: "Failed to extract job information"
        });
    }
}

//controller to update status of job application
async function updateJobStatus(req, res) {
    try {
        const { id } = req.params;
        if (!req.body || typeof req.body !== "object") {
            return res.status(400).json({
                error: "Request body must be valid JSON"
            });
        }
        const { status } = req.body || {};
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid job ID format"
            });
        }

        if (!APPLICATION_STATUSES.includes(status)) {
            return res.status(400).json({
                error: "Invalid status"
            });
        }
        const job = await Job.findOne({
            _id: id,
            userId: req.user.userId
        });
        if (!job) {
            return res.status(404).json({
                error: "Job application not found"
            });
        }

        const allowedNextStatuses = STATUS_TRANSITIONS[job.status];

        if (!allowedNextStatuses.includes(status)) {
            return res.status(400).json({
                error: `Cannot change status from ${job.status} to ${status}`
            });
        }

        // Compare the status read above as part of the write. Only one racing
        // request can move this application from that status.
        const updatedJob = await Job.findOneAndUpdate(
            { _id: id, userId: req.user.userId, status: job.status },
            {
                $set: { status },
                $push: { timeline: { status, timestamp: new Date() } }
            },
            { returnDocument: "after", runValidators: true }
        );
        if (!updatedJob) {
            return res.status(409).json({
                error: "This application changed in another request. Refresh before updating its status."
            });
        }
        res.status(200).json({
            message: "Job status updated successfully",
            job: updatedJob
        });
    } catch (error) {
        console.error("Update job status error:", error);

        res.status(500).json({
            error: "Failed to update job status"
        });
    }
}

// controller to delete a job application
async function deleteJob(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid job ID format"
            });
        }

        const job = await Job.findOneAndDelete({
            _id: id,
            userId: req.user.userId
        });

        if (!job) {
            return res.status(404).json({
                error: "Job application not found"
            });
        }

        res.status(200).json({
            message: "Job application deleted successfully"
        });
    } catch (error) {
        console.error("Delete job error:", error);

        res.status(500).json({
            error: "Failed to delete job application"
        });
    }
}

//controller to delete multiple jobs
async function deleteJobs(req, res) {
    try {
        const { jobIds } = req.body || {};

        if (!Array.isArray(jobIds) || jobIds.length === 0) {
            return res.status(400).json({
                error: "No job applications selected"
            });
        }

        const invalidIds = jobIds.some(
            (id) => !mongoose.isValidObjectId(id)
        );

        if (invalidIds) {
            return res.status(400).json({
                error: "One or more job IDs are invalid"
            });
        }

        const result = await Job.deleteMany({
            _id: { $in: jobIds },
            userId: req.user.userId
        });

        res.status(200).json({
            message: "Job applications deleted successfully",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error("Delete jobs error:", error);

        res.status(500).json({
            error: "Failed to delete job applications"
        });
    }
}

// Controller to check whether a job URL is already tracked
async function checkJobDuplicate(req, res) {
    try {
        const { url } = req.body || {};

        if (typeof url !== "string" || !url.trim()) {
            return res.status(400).json({
                error: "Job URL must be a non-empty string"
            });
        }

        try {
            const parsedUrl = new URL(url);

            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                return res.status(400).json({
                    error: "Job URL must be a valid HTTP or HTTPS URL"
                });
            }
        } catch {
            return res.status(400).json({
                error: "Job URL must be a valid HTTP or HTTPS URL"
            });
        }

        const normalizedUrl = normalizeJobUrl(url);

        const existingJob = await Job.findOne({
            userId: req.user.userId,
            url: normalizedUrl
        });

        res.status(200).json({
            exists: !!existingJob,
            jobId: existingJob ? existingJob._id : null
        });
    } catch (error) {
        console.error("Check duplicate job error:", error);

        res.status(500).json({
            error: "Failed to check duplicate job"
        });
    }
}

module.exports = {
    getJobs,
    getJobById,
    createJob,
    extractJob,
    updateJobStatus,
    deleteJob,
    deleteJobs,
    checkJobDuplicate
};
