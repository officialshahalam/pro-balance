import { Router, type NextFunction, type Response, type Router as ExpressRouter } from "express";
import isAuthenticated from "../../packages/middlewares/isAuthenticated";
import * as annexureService from "./annexure.service";

const annexureRouter: ExpressRouter = Router();
annexureRouter.use(isAuthenticated);

annexureRouter.get(
	"/financial-years/:fyId/annexures",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await annexureService.getAnnexures(Number(req.params.fyId), req.user.id);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

annexureRouter.post(
	"/financial-years/:fyId/annexures",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await annexureService.createAnnexure(Number(req.params.fyId), req.user.id, req.body);
			res.status(201).json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

annexureRouter.put(
	"/annexures/:id",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await annexureService.updateAnnexure(Number(req.params.id), req.user.id, req.body);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

annexureRouter.delete(
	"/annexures/:id",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			await annexureService.deleteAnnexure(Number(req.params.id), req.user.id);
			res.json({ status: "success", message: "Annexure deleted" });
		} catch (error) {
			next(error);
		}
	},
);

annexureRouter.post(
	"/financial-years/:fyId/project",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await annexureService.projectFY(Number(req.params.fyId), req.user.id, req.body.growth_percent);
			res.status(201).json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

annexureRouter.put(
	"/financial-years/:fyId/re-project",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await annexureService.reProjectFY(Number(req.params.fyId), req.user.id, req.body.growth_percent);
			res.json({ status: "success", data });
		} catch (error) {
			next(error);
		}
	},
);

export default annexureRouter;
