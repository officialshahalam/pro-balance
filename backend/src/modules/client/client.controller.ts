import { Router, type NextFunction, type Response, type Router as ExpressRouter } from "express";
import isAuthenticated from "../../packages/middlewares/isAuthenticated";
import * as clientService from "./client.service";

const clientRouter: ExpressRouter = Router();

clientRouter.use(isAuthenticated);

clientRouter.get(
	"/",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const clients = await clientService.getClients(req.user.id);
			res.json({ status: "success", data: clients });
		} catch (error) {
			next(error);
		}
	},
);

clientRouter.get(
	"/:clientId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const client = await clientService.getClientById(
				Number(req.params.clientId),
				req.user.id,
			);
			res.json({ status: "success", data: client });
		} catch (error) {
			next(error);
		}
	},
);

clientRouter.post(
	"/",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const client = await clientService.createClient(req.user.id, req.body);
			res.status(201).json({ status: "success", data: client });
		} catch (error) {
			next(error);
		}
	},
);

clientRouter.patch(
	"/:clientId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const client = await clientService.updateClient(
				Number(req.params.clientId),
				req.user.id,
				req.body,
			);
			res.json({ status: "success", data: client });
		} catch (error) {
			next(error);
		}
	},
);

clientRouter.delete(
	"/:clientId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			await clientService.deleteClient(
				Number(req.params.clientId),
				req.user.id,
			);
			res.json({ status: "success", message: "Client deleted" });
		} catch (error) {
			next(error);
		}
	},
);

export default clientRouter;
