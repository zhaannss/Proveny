const nodemailer = require("nodemailer");
const { env } = require("./env");

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });
}

module.exports = { sendEmail };
