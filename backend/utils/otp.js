// We use native fetch, no external packages required!

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (userEmail, otp) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Servon App", email: senderEmail },
        to: [{ email: userEmail }],
        subject: "Your Servon Password Reset Code",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #f9fafb; border-radius: 12px;">
            <h2 style="color: #111827;">Password Reset</h2>
            <p style="color: #4b5563; font-size: 16px;">Your 6-digit verification code is:</p>
            <h1 style="color: #10B981; letter-spacing: 8px; font-size: 36px; background: #fff; padding: 16px; border-radius: 8px; display: inline-block; border: 1px solid #e5e7eb;">${otp}</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">This code is valid for 10 minutes.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Error:", errorData);
      throw new Error("Failed to send email via Brevo");
    }

    return true;
  } catch (err) {
    console.error("Email send error:", err);
    throw new Error("Failed to send OTP");
  }
};

module.exports = { generateOTP, sendOTP };