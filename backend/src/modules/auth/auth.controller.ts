import {
	Router,
	type NextFunction,
	type Request,
	type Response,
	type Router as ExpressRouter,
} from "express";
import { sendOtp, verifyOtpAndSignup, login } from "./auth.service";
import isAuthenticated from "../../packages/middlewares/isAuthenticated";

const authRouter: ExpressRouter = Router();

/**
 * @swagger
 * /api/v1/auth/send-otp:
 *   post:
 *     summary: Send OTP to email for signup verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
authRouter.post(
	"/send-otp",
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const result = await sendOtp(req.body);
			res.status(200).json({ status: "success", data: result });
		} catch (error) {
			next(error);
		}
	},
);

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and create the account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       201:
 *         description: Account created successfully
 */
authRouter.post(
	"/verify-otp",
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const user = await verifyOtpAndSignup(req.body);
			res.status(201).json({
				status: "success",
				message: "Account created successfully",
				data: user,
			});
		} catch (error) {
			next(error);
		}
	},
);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 */
authRouter.post(
	"/login",
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { user, token } = await login(req.body);

			res.cookie("access_token", token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 7 * 24 * 60 * 60 * 1000,
			});

			res.status(200).json({
				status: "success",
				message: "Login successful",
				data: { user, token },
			});
		} catch (error) {
			next(error);
		}
	},
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout and clear session
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out
 */
authRouter.post(
	"/logout",
	(_req: Request, res: Response): void => {
		res.clearCookie("access_token");
		res.status(200).json({ status: "success", message: "Logged out successfully" });
	},
);

authRouter.get(
	"/me",
	isAuthenticated,
	(req: any, res: Response): void => {
		res.json({ status: "success", data: req.user });
	},
);

export default authRouter;
