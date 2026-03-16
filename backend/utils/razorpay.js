const Razorpay = require("razorpay"); 
const instance = new Razorpay({ 
key_id: process.env.RAZORPAY_KEY_ID, 
key_secret: process.env.RAZORPAY_KEY_SECRET, 
}); 
const createOrder = async (amount, currency = "INR", receipt = "order_receipt") => { 
return instance.orders.create({ amount, currency, receipt }); 
}; 
const verifySignature = (orderId, paymentId, signature) => { 
const crypto = require("crypto"); 
const generatedSignature = crypto 
.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET) 
.update(`${orderId}|${paymentId}`) 
.digest("hex"); 
return generatedSignature === signature; 
}; 
module.exports = { createOrder, verifySignature, instance };