const { Expo } = require('expo-server-sdk');
let expo = new Expo();

const sendPush = async (targetToken, title, body) => {
  const tokens = Array.isArray(targetToken) ? targetToken : [targetToken];
  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
  if (validTokens.length === 0) return;

  let messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high'
  }));

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
