import { Router, type NextFunction, type Response, type Router as ExpressRouter } from "express";
import isAuthenticated from "../../packages/middlewares/isAuthenticated";
import * as fyService from "./financial-year.service";

const financialYearRouter: ExpressRouter = Router();

financialYearRouter.use(isAuthenticated);

// Routes nested under /clients/:clientId/financial-years
financialYearRouter.get(
	"/clients/:clientId/financial-years",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await fyService.getFinancialYears(
				Number(req.params.clientId),
				req.user.id,
			);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

financialYearRouter.post(
	"/clients/:clientId/financial-years",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await fyService.createFinancialYear(
				Number(req.params.clientId),
				req.user.id,
				req.body,
			);
			res.status(201).json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

// Routes directly on /financial-years/:fyId
financialYearRouter.get(
	"/financial-years/:fyId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await fyService.getFinancialYearById(
				Number(req.params.fyId),
				req.user.id,
			);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

financialYearRouter.patch(
	"/financial-years/:fyId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await fyService.updateFinancialYear(
				Number(req.params.fyId),
				req.user.id,
				req.body,
			);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

financialYearRouter.delete(
	"/financial-years/:fyId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			await fyService.deleteFinancialYear(
				Number(req.params.fyId),
				req.user.id,
			);
			res.json({ status: "success", message: "Financial year deleted" });
		} catch (error) {
			next(error);
		}
	},
);

financialYearRouter.post(
	"/financial-years/:fyId/finalize",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await fyService.finalizeFinancialYear(
				Number(req.params.fyId),
				req.user.id,
			);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

export default financialYearRouter;
