const mongoose = require("mongoose");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus")

const timelineEventSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    },
},
    {
        _id: false
    });


const jobSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        company: {
            type: String,
            required: true,
            trim: true
        },

        jobId: {
            type: String,
            default: null
        },

        location: {
            type: String,
            default: null
        },

        salary: {
            type: String,
            default: null
        },

        description: {
            type: String,
            default: null
        },
        jobDescription: {
            type: String,
            default: null
        },

        responsibilities: {
            type: [String],
            default: []
        },

        requiredSkills: {
            type: [String],
            default: []
        },

        preferredSkills: {
            type: [String],
            default: []
        },

        experience: {
            type: String,
            default: null
        },

        education: {
            type: String,
            default: null
        },

        url: {
            type: String,
            required: true
        },

        source: {
            type: String,
            required: true
        },

        status: {
            type: String,
            required: true,
            enum: APPLICATION_STATUSES,
            default: "Applied"
        },

        appliedAt: {
            type: Date,
            required: true
        },

        timeline: {
            type: [timelineEventSchema],
            required: true,
            default: []
        }
    },

    {
        timestamps: true,
        autoIndex: false
    }
);

jobSchema.index({ userId: 1, url: 1 }, { unique: true, name: "unique_user_job_url" });

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
