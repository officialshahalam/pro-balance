import { Router, type NextFunction, type Response, type Router as ExpressRouter } from "express";
import isAuthenticated from "../../packages/middlewares/isAuthenticated";
import * as svc from "./statement-line.service";
import type { StatementType } from "../../generated/prisma/enums";

const statementLineRouter: ExpressRouter = Router();
statementLineRouter.use(isAuthenticated);

// GET  /financial-years/:fyId/statement-lines?type=BALANCE_SHEET
statementLineRouter.get(
	"/financial-years/:fyId/statement-lines",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const type = req.query.type as StatementType;
			if (!type) { res.status(400).json({ status: "error", message: "type query param required" }); return; }
			const data = await svc.getLines(Number(req.params.fyId), req.user.id, type);
			res.json({ status: "success", data });
		} catch (e) { next(e); }
	},
);

// POST /financial-years/:fyId/statement-lines/static  — upsert a static slot
statementLineRouter.post(
	"/financial-years/:fyId/statement-lines/static",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await svc.upsertStaticLine(Number(req.params.fyId), req.user.id, req.body);
			res.json({ status: "success", data });
		} catch (e) { next(e); }
	},
);

// POST /financial-years/:fyId/statement-lines/dynamic  — add a dynamic row
statementLineRouter.post(
	"/financial-years/:fyId/statement-lines/dynamic",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await svc.addDynamicLine(Number(req.params.fyId), req.user.id, req.body);
			res.status(201).json({ status: "success", data });
		} catch (e) { next(e); }
	},
);

// POST /financial-years/:fyId/statement-lines/bulk  — save all lines at once (frontend Save button)
statementLineRouter.post(
	"/financial-years/:fyId/statement-lines/bulk",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { statement_type, lines } = req.body;
			const data = await svc.bulkUpsertLines(
				Number(req.params.fyId),
				req.user.id,
				statement_type,
				lines,
			);
			res.json({ status: "success", data });
		} catch (e) { next(e); }
	},
);

// PATCH /statement-lines/:lineId
statementLineRouter.patch(
	"/statement-lines/:lineId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const data = await svc.updateLine(Number(req.params.lineId), req.user.id, req.body);
			res.json({ status: "success", data });
		} catch (e) { next(e); }
	},
);

// DELETE /statement-lines/:lineId
statementLineRouter.delete(
	"/statement-lines/:lineId",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			await svc.deleteLine(Number(req.params.lineId), req.user.id);
			res.json({ status: "success", message: "Line deleted" });
		} catch (e) { next(e); }
	},
);

// POST /financial-years/:fyId/statement-lines/reorder
statementLineRouter.post(
	"/financial-years/:fyId/statement-lines/reorder",
	async (req: any, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { statement_type, section, ordered_ids } = req.body;
			await svc.reorderLines(
				Number(req.params.fyId),
				req.user.id,
				statement_type,
				section,
				ordered_ids,
			);
			res.json({ status: "success" });
		} catch (e) { next(e); }
	},
);

export default statementLineRouter;
