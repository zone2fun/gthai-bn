const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

const sendPushNotification = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushToken) {
            // console.log('No push token for user', userId);
            return;
        }

        const pushToken = user.pushToken;

        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            return;
        }

        const messages = [{
            to: pushToken,
            sound: 'default',
            title: title || 'GTHAILOVER',
            body: body,
            data: data,
        }];

        const chunks = expo.chunkPushNotifications(messages);

        for (let chunk of chunks) {
            try {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                // console.log('Push notification sent:', ticketChunk);
            } catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }
    } catch (error) {
        console.error('Error in sendPushNotification:', error);
    }
};

module.exports = {
    sendPushNotification
};
