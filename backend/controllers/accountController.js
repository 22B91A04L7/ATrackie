const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Job = require('../models/Job');

async function getProfile(req, res) {
    try {
        const user = await User.findById(req.user.userId).select('name email createdAt');
        if (!user) return res.status(401).json({error: 'Account no longer exists'});
        res.json({user});
    } catch {
        res.status(500).json({error: 'Could not load your profile. Please try again.'});
    }
}

async function deleteAccount(req, res) {
    try {
        const {password, confirmation} = req.body || {};
        if (typeof password !== 'string' || !password || confirmation !== 'DELETE') {
            return res.status(400).json({error: 'Enter your password and type DELETE to confirm.'});
        }
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(401).json({error: 'Account no longer exists'});
        if (!await bcrypt.compare(password, user.password)) return res.status(400).json({error: 'Incorrect password. Account was not deleted.'});
        // Block new activity first. If cleanup fails, this authenticated endpoint
        // can be retried using the same token and password, even on standalone MongoDB.
        await User.updateOne({_id: user._id}, {$set: {deleting: true}});
        await Job.deleteMany({userId: String(user._id)});
        await User.deleteOne({_id: user._id});
        res.json({message: 'Your account and applications have been deleted.'});
    } catch {
        res.status(503).json({error: 'Deletion could not finish. Keep this page open and retry with your password.'});
    }
}
module.exports = {getProfile, deleteAccount};
