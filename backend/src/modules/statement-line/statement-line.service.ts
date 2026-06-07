import prisma from "../../configs/prisma";
import { NotFoundError, ValidationError } from "../../packages/error-handler";
import type { StatementType } from "../../generated/prisma/enums";
import { verifyFYOwnership } from "../financial-year/financial-year.service";

// ─── Read ─────────────────────────────────────────────────

export const getLines = async (fyId: number, userId: number, statementType: StatementType) => {
	await verifyFYOwnership(fyId, userId);
	return prisma.statementLine.findMany({
		where: { financial_year_id: fyId, statement_type: statementType },
		orderBy: [{ section: "asc" }, { sort_order: "asc" }, { id: "asc" }],
	});
};

// ─── Static slot upsert ───────────────────────────────────

export const upsertStaticLine = async (
	fyId: number,
	userId: number,
	payload: {
		statement_type: StatementType;
		section: string;
		slot_key: string;
		amount?: number;
		annexure_ref?: string | null;
	},
) => {
	await verifyFYOwnership(fyId, userId);
	if (!payload.slot_key) throw new ValidationError("slot_key is required for static lines");

	return prisma.statementLine.upsert({
		where: {
			financial_year_id_statement_type_section_slot_key: {
				financial_year_id: fyId,
				statement_type: payload.statement_type,
				section: payload.section,
				slot_key: payload.slot_key,
			},
		},
		create: {
			financial_year_id: fyId,
			statement_type: payload.statement_type,
			section: payload.section,
			slot_key: payload.slot_key,
			amount: payload.amount ?? 0,
			annexure_ref: payload.annexure_ref ?? null,
			is_dynamic: false,
		},
		update: {
			amount: payload.amount ?? 0,
			annexure_ref: payload.annexure_ref ?? null,
		},
	});
};

// ─── Dynamic row add ──────────────────────────────────────

export const addDynamicLine = async (
	fyId: number,
	userId: number,
	payload: {
		statement_type: StatementType;
		section: string;
		label: string;
		amount?: number;
		annexure_ref?: string | null;
		sort_order?: number;
	},
) => {
	await verifyFYOwnership(fyId, userId);
	if (!payload.label?.trim()) throw new ValidationError("label is required for dynamic lines");

	const lastRow = await prisma.statementLine.findFirst({
		where: {
			financial_year_id: fyId,
			statement_type: payload.statement_type,
			section: payload.section,
			is_dynamic: true,
		},
		orderBy: { sort_order: "desc" },
		select: { sort_order: true },
	});

	const nextOrder = payload.sort_order ?? (lastRow ? lastRow.sort_order + 1 : 0);

	return prisma.statementLine.create({
		data: {
			financial_year_id: fyId,
			statement_type: payload.statement_type,
			section: payload.section,
			slot_key: null,
			label: payload.label.trim(),
			amount: payload.amount ?? 0,
			annexure_ref: payload.annexure_ref ?? null,
			is_dynamic: true,
			sort_order: nextOrder,
		},
	});
};

// ─── Update a line ────────────────────────────────────────

export const updateLine = async (
	lineId: number,
	userId: number,
	payload: {
		amount?: number;
		label?: string;
		annexure_ref?: string | null;
	},
) => {
	const line = await prisma.statementLine.findFirst({
		where: { id: lineId, financial_year: { client: { user_id: userId } } },
	});
	if (!line) throw new NotFoundError("Statement line not found");

	const data: Record<string, any> = {};
	if (payload.amount !== undefined) data.amount = payload.amount;
	if (payload.annexure_ref !== undefined) data.annexure_ref = payload.annexure_ref;
	if (payload.label !== undefined) {
		if (!line.is_dynamic) throw new ValidationError("Cannot rename a static line");
		data.label = payload.label.trim();
	}

	return prisma.statementLine.update({ where: { id: lineId }, data });
};

// ─── Delete a dynamic row ─────────────────────────────────

export const deleteLine = async (lineId: number, userId: number) => {
	const line = await prisma.statementLine.findFirst({
		where: { id: lineId, financial_year: { client: { user_id: userId } } },
	});
	if (!line) throw new NotFoundError("Statement line not found");
	if (!line.is_dynamic) throw new ValidationError("Cannot delete a static line");

	await prisma.statementLine.delete({ where: { id: lineId } });
};

// ─── Reorder dynamic rows within a section ────────────────

export const reorderLines = async (
	fyId: number,
	userId: number,
	_statementType: StatementType,
	_section: string,
	orderedIds: number[],
) => {
	await verifyFYOwnership(fyId, userId);

	await prisma.$transaction(
		orderedIds.map((id, index) =>
			prisma.statementLine.update({
				where: { id },
				data: { sort_order: index },
			}),
		),
	);
};

// ─── Bulk upsert (used by frontend Save button) ───────────

export const bulkUpsertLines = async (
	fyId: number,
	userId: number,
	statementType: StatementType,
	lines: Array<{
		id?: number;
		section: string;
		slot_key?: string | null;
		label?: string | null;
		amount: number;
		annexure_ref?: string | null;
		is_dynamic: boolean;
		sort_order: number;
	}>,
) => {
	await verifyFYOwnership(fyId, userId);

	// Delete all dynamic rows first so the save is a full sync (removed rows disappear from DB)
	await prisma.statementLine.deleteMany({
		where: { financial_year_id: fyId, statement_type: statementType, is_dynamic: true },
	});

	await prisma.$transaction(
		lines.map((line) => {
			if (line.id) {
				return prisma.statementLine.update({
					where: { id: line.id },
					data: { amount: line.amount, annexure_ref: line.annexure_ref ?? null },
				});
			}
			if (!line.is_dynamic && line.slot_key) {
				return prisma.statementLine.upsert({
					where: {
						financial_year_id_statement_type_section_slot_key: {
							financial_year_id: fyId,
							statement_type: statementType,
							section: line.section,
							slot_key: line.slot_key,
						},
					},
					create: {
						financial_year_id: fyId,
						statement_type: statementType,
						section: line.section,
						slot_key: line.slot_key,
						amount: line.amount,
						annexure_ref: line.annexure_ref ?? null,
						is_dynamic: false,
						sort_order: line.sort_order,
					},
					update: { amount: line.amount, annexure_ref: line.annexure_ref ?? null },
				});
			}
			return prisma.statementLine.create({
				data: {
					financial_year_id: fyId,
					statement_type: statementType,
					section: line.section,
					slot_key: null,
					label: line.label?.trim() ?? null,
					amount: line.amount,
					annexure_ref: line.annexure_ref ?? null,
					is_dynamic: true,
					sort_order: line.sort_order,
				},
			});
		}),
	);

	return prisma.statementLine.findMany({
		where: { financial_year_id: fyId, statement_type: statementType },
		orderBy: [{ section: "asc" }, { sort_order: "asc" }, { id: "asc" }],
	});
};
