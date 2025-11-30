const SystemSetting = require('../models/SystemSetting');

const checkMaintenanceMode = async (req, res, next) => {
    try {
        const maintenanceSetting = await SystemSetting.findOne({ key: 'maintenanceMode' });

        if (maintenanceSetting && maintenanceSetting.value === true) {
            // Check if user is admin (if they have admin token, let them through)
            // For now, we'll just block all non-admin routes
            return res.status(503).json({
                message: 'System is currently under maintenance. Please try again later.',
                maintenanceMode: true
            });
        }

        next();
    } catch (error) {
        console.error('Error checking maintenance mode:', error);
        next(); // Continue on error to avoid breaking the app
    }
};

module.exports = { checkMaintenanceMode };
