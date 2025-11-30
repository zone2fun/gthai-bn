const SystemSetting = require('../models/SystemSetting');
const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Announcement = require('../models/Announcement');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const AlbumAccessRequest = require('../models/AlbumAccessRequest');
const fs = require('fs');
const path = require('path');

// @desc    Get all system settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
const getSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.find({});

        // Convert array to object for easier frontend usage
        const settingsObj = {};
        settings.forEach(s => {
            settingsObj[s.key] = s.value;
        });

        // Ensure default settings exist
        if (settingsObj.adsenseEnabled === undefined) {
            await SystemSetting.create({
                key: 'adsenseEnabled',
                value: true,
                description: 'Enable or disable Google AdSense globally'
            });
            settingsObj.adsenseEnabled = true;
        }

        if (settingsObj.maintenanceMode === undefined) {
            await SystemSetting.create({
                key: 'maintenanceMode',
                value: false,
                description: 'Enable or disable maintenance mode'
            });
            settingsObj.maintenanceMode = false;
        }

        if (settingsObj.maintenanceConfig === undefined) {
            const defaultConfig = {
                enabled: false,
                reason: 'ปิดปรับปรุงปกติ',
                expectedEndTime: null
            };
            await SystemSetting.create({
                key: 'maintenanceConfig',
                value: defaultConfig,
                description: 'Maintenance mode configuration'
            });
            settingsObj.maintenanceConfig = defaultConfig;
        }

        res.json(settingsObj);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update a system setting
// @route   PUT /api/admin/settings
// @access  Private (Admin)
const updateSetting = async (req, res) => {
    const { key, value } = req.body;

    try {
        const setting = await SystemSetting.findOneAndUpdate(
            { key },
            { value },
            { new: true, upsert: true }
        );
        res.json(setting);
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Backup database to JSON
// @route   GET /api/admin/backup
// @access  Private (Admin)
const backupDatabase = async (req, res) => {
    try {
        const backupData = {
            timestamp: new Date().toISOString(),
            collections: {}
        };

        // Fetch data from all major collections
        backupData.collections.users = await User.find({});
        backupData.collections.posts = await Post.find({});
        backupData.collections.messages = await Message.find({});
        backupData.collections.announcements = await Announcement.find({});
        backupData.collections.reports = await Report.find({});
        backupData.collections.notifications = await Notification.find({});
        backupData.collections.albumAccessRequests = await AlbumAccessRequest.find({});
        backupData.collections.systemSettings = await SystemSetting.find({});

        const fileName = `backup-${new Date().toISOString().replace(/:/g, '-')}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        res.send(JSON.stringify(backupData, null, 2));
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ message: 'Backup failed' });
    }
};

// @desc    Restore database from JSON backup
// @route   POST /api/admin/restore
// @access  Private (Admin)
const restoreDatabase = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No backup file uploaded' });
        }

        const backupData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));

        if (!backupData.collections) {
            return res.status(400).json({ message: 'Invalid backup file format' });
        }

        // Restore collections
        if (backupData.collections.users) {
            await User.deleteMany({});
            await User.insertMany(backupData.collections.users);
        }

        if (backupData.collections.posts) {
            await Post.deleteMany({});
            await Post.insertMany(backupData.collections.posts);
        }

        if (backupData.collections.messages) {
            await Message.deleteMany({});
            await Message.insertMany(backupData.collections.messages);
        }

        if (backupData.collections.announcements) {
            await Announcement.deleteMany({});
            await Announcement.insertMany(backupData.collections.announcements);
        }

        if (backupData.collections.reports) {
            await Report.deleteMany({});
            await Report.insertMany(backupData.collections.reports);
        }

        if (backupData.collections.notifications) {
            await Notification.deleteMany({});
            await Notification.insertMany(backupData.collections.notifications);
        }

        if (backupData.collections.albumAccessRequests) {
            await AlbumAccessRequest.deleteMany({});
            await AlbumAccessRequest.insertMany(backupData.collections.albumAccessRequests);
        }

        if (backupData.collections.systemSettings) {
            await SystemSetting.deleteMany({});
            await SystemSetting.insertMany(backupData.collections.systemSettings);
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ message: 'Database restored successfully' });
    } catch (error) {
        console.error('Error restoring database:', error);
        res.status(500).json({ message: 'Restore failed: ' + error.message });
    }
};

// @desc    Get public settings (for user app)
// @route   GET /api/settings/public
// @access  Public
const getPublicSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.find({
            key: { $in: ['adsenseEnabled', 'maintenanceMode', 'maintenanceConfig'] }
        });

        const settingsObj = {
            adsenseEnabled: true,
            maintenanceMode: false,
            maintenanceConfig: {
                enabled: false,
                reason: 'ปิดปรับปรุงปกติ',
                expectedEndTime: null
            }
        };

        settings.forEach(s => {
            settingsObj[s.key] = s.value;
        });

        res.json(settingsObj);
    } catch (error) {
        console.error('Error fetching public settings:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getSettings,
    updateSetting,
    backupDatabase,
    restoreDatabase,
    getPublicSettings
};
