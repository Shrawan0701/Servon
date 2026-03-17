const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const sendPush = async (targetToken, title, body) => {
  if (!Expo.isExpoPushToken(targetToken)) return;

  let messages = [{
    to: targetToken,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high'
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error("Push Error:", error);
  }
};

module.exports = sendPush;