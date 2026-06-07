import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../configs/prisma";
import redis from "../../configs/radis";
import { sendOtpEmail } from "../../configs/mailer";
import {
	AppError,
	AuthError,
	DatabaseError,
	ValidationError,
} from "../../packages/error-handler";

type SignupInput = {
	name: string;
	email: string;
	password: string;
};

type LoginInput = {
	email: string;
	password: string;
};

const isValidEmail = (email: string): boolean =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const OTP_TTL = 300; // 5 minutes
const OTP_COOLDOWN = 60; // 1 minute between resends
const OTP_PREFIX = "otp:";
const COOLDOWN_PREFIX = "otp_cooldown:";
const PENDING_PREFIX = "pending_signup:";

export const sendOtp = async (payload: SignupInput): Promise<{ email: string; message: string }> => {
	const name = payload.name?.trim();
	const email = payload.email?.trim().toLowerCase();
	const password = payload.password;

	if (!name || name.length < 2) {
		throw new ValidationError("Name must be at least 2 characters long");
	}
	if (!email || !isValidEmail(email)) {
		throw new ValidationError("A valid email is required");
	}
	if (!password || password.length < 6) {
		throw new ValidationError("Password must be at least 6 characters long");
	}

	const existingUser = await prisma.user.findFirst({
		where: { email },
		select: { id: true },
	});
	if (existingUser) {
		throw new ValidationError("User with this email already exists");
	}

	// Rate limit: prevent spamming OTPs (1 minute cooldown between sends)
	const cooldown = await redis.get<string>(COOLDOWN_PREFIX + email);
	if (cooldown) {
		throw new ValidationError("Please wait before requesting a new OTP.");
	}

	const otp = crypto.randomInt(100000, 999999).toString();

	const password_hash = await bcrypt.hash(password, 12);

	// Store OTP, cooldown, and pending signup data in Redis
	try {
		await redis.set(OTP_PREFIX + email, otp, { ex: OTP_TTL });
		await redis.set(COOLDOWN_PREFIX + email, "1", { ex: OTP_COOLDOWN });
		await redis.set(
			PENDING_PREFIX + email,
			JSON.stringify({ name, email, password_hash }),
			{ ex: OTP_TTL },
		);
	} catch (error) {
		console.error("[OTP] Redis error:", error);
		throw new DatabaseError("Failed to store OTP data", error);
	}

	try {
		await sendOtpEmail(email, otp);
	} catch (error) {
		console.error("[OTP] Email send error:", error);
		await redis.del(OTP_PREFIX + email);
		await redis.del(PENDING_PREFIX + email);
		throw new DatabaseError("Failed to send verification email. Please try again.", error);
	}

	return { email, message: "Verification code sent to your email" };
};

export const verifyOtpAndSignup = async (payload: { email: string; otp: string }): Promise<{ id: number; name: string; email: string; created_at: Date }> => {
	const email = payload.email?.trim().toLowerCase();
	const otp = payload.otp?.trim();
	console.log(`[VERIFY] Input email=${email}, otp=${otp}`);

	if (!email || !isValidEmail(email)) {
		throw new ValidationError("A valid email is required");
	}
	if (!otp || otp.length !== 6) {
		console.log(`[VERIFY] OTP length check failed: "${otp}" (length=${otp?.length})`);
		throw new ValidationError("A valid 6-digit OTP is required");
	}

	const storedOtp = await redis.get(OTP_PREFIX + email);
	console.log(`[VERIFY] Redis key=${OTP_PREFIX + email}, storedOtp=${storedOtp} (type=${typeof storedOtp}), inputOtp=${otp} (type=${typeof otp})`);

	if (!storedOtp) {
		console.log("[VERIFY] No OTP found in Redis — expired");
		throw new ValidationError("OTP expired. Please request a new one.");
	}
	if (String(storedOtp) !== otp) {
		console.log(`[VERIFY] Mismatch: "${String(storedOtp)}" !== "${otp}"`);
		throw new AuthError("Invalid OTP");
	}
	console.log("[VERIFY] OTP matched!");

	const pendingData = await redis.get(PENDING_PREFIX + email);
	console.log(`[VERIFY] Pending data type=${typeof pendingData}, value=${JSON.stringify(pendingData)?.slice(0, 100)}`);

	if (!pendingData) {
		throw new ValidationError("Signup session expired. Please start over.");
	}

	const parsed = typeof pendingData === "string" ? JSON.parse(pendingData) : pendingData;
	const { name, password_hash } = parsed;
	console.log(`[VERIFY] Creating user: name=${name}, email=${email}`);

	try {
		// Double-check no user was created in the meantime
		const existingUser = await prisma.user.findFirst({
			where: { email },
			select: { id: true },
		});
		if (existingUser) {
			throw new ValidationError("User with this email already exists");
		}

		const user = await prisma.user.create({
			data: { name, email, password_hash },
			select: { id: true, name: true, email: true, created_at: true },
		});

		// Clean up Redis
		await redis.del(OTP_PREFIX + email);
		await redis.del(PENDING_PREFIX + email);

		return user;
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new DatabaseError("Failed to create user", error);
	}
};

export const login = async (payload: LoginInput) => {
	const email = payload.email?.trim().toLowerCase();
	const password = payload.password;

	if (!email || !isValidEmail(email)) {
		throw new ValidationError("A valid email is required");
	}
	if (!password) {
		throw new ValidationError("Password is required");
	}

	try {
		const user = await prisma.user.findFirst({
			where: { email },
		});

		if (!user) {
			throw new AuthError("Invalid email or password");
		}

		const isMatch = await bcrypt.compare(password, user.password_hash);
		if (!isMatch) {
			throw new AuthError("Invalid email or password");
		}

		const token = jwt.sign(
			{ id: user.id },
			process.env.ACCESS_TOKEN_SECRET!,
			{ expiresIn: "24h" },
		);

		return {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				created_at: user.created_at,
			},
			token,
		};
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new DatabaseError("Login failed", error);
	}
};
