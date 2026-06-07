import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
	host: "smtp.gmail.com",
	port: 587,
	secure: false,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

export const sendOtpEmail = async (to: string, otp: string) => {
	await transporter.sendMail({
		from: `"ProBalance" <${process.env.SMTP_USER}>`,
		to,
		subject: "Your ProBalance Verification Code",
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; border: 1px solid #e5e5e5; border-radius: 8px;">
				<h2 style="margin: 0 0 8px; font-size: 18px; color: #111;">ProBalance</h2>
				<p style="color: #555; font-size: 14px; margin: 0 0 24px;">Verify your email to create your account.</p>
				<div style="background: #f5f5f5; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
					<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">${otp}</span>
				</div>
				<p style="color: #888; font-size: 12px; margin: 0;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
			</div>
		`,
	});
};
