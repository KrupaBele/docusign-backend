require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.sendMail(
  {
    from: process.env.EMAIL_USER,
    to: "krupabele47@gmail.com",
    subject: "Test Email",
    html: "<p>This is a test email from your backend</p>",
  },
  (err, info) => {
    if (err) {
      console.error("❌ Failed to send email:", err.message);
    } else {
      console.log("✅ Email sent:", info.response);
    }
  }
);
