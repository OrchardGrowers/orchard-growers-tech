import nodemailer from "nodemailer";

const truthyEnv = (value = "") => ["1", "true", "yes"].includes(String(value).trim().toLowerCase());

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);

export const getMailTransport = () => {
  if (!isSmtpConfigured()) return null;

  const port = Number(process.env.SMTP_PORT);
  return {
    from: process.env.SMTP_FROM,
    transporter: nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: truthyEnv(process.env.SMTP_SECURE) || port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }),
  };
};

const buildOtpEmailHtml = ({ otp, purpose }) => {
  const safePurpose = escapeHtml(purpose || "verification");
  const safeOtp = escapeHtml(otp);

  return `
    <div style="margin:0;padding:0;background:#f6f8f5;font-family:Arial,Helvetica,sans-serif;color:#172118;">
      <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
        <div style="background:#ffffff;border:1px solid #dfe8dc;border-radius:12px;padding:24px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#17351f;">Orchard Growers OTP</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#3d4f3f;">Use this code to complete ${safePurpose}. It expires in 5 minutes.</p>
          <div style="letter-spacing:8px;font-size:30px;font-weight:700;text-align:center;background:#eef7ed;border-radius:10px;padding:16px 12px;color:#163d24;">${safeOtp}</div>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b776c;">If you did not request this code, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
  `;
};

export const sendOtpEmail = async ({ to, otp, purpose = "verification" }) => {
  const mailConfig = getMailTransport();
  if (!mailConfig) {
    const error = new Error("SMTP is not configured");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  try {
    await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to,
      subject: "Your Orchard Growers OTP",
      text: `Your Orchard Growers OTP is ${otp}. It expires in 5 minutes. If you did not request this code, ignore this email.`,
      html: buildOtpEmailHtml({ otp, purpose }),
    });
  } catch (err) {
    const error = new Error("SMTP send failed");
    error.code = "SMTP_SEND_FAILED";
    error.smtpCode = err?.code || err?.responseCode;
    throw error;
  }
};

export const sendEmail = async ({ to, subject, text, html }) => {
  const mailConfig = getMailTransport();
  if (!mailConfig) {
    const error = new Error("SMTP is not configured");
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }

  try {
    await mailConfig.transporter.sendMail({
      from: mailConfig.from,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    const error = new Error("SMTP send failed");
    error.code = "SMTP_SEND_FAILED";
    error.smtpCode = err?.code || err?.responseCode;
    throw error;
  }
};
