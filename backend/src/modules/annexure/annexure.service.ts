import prisma from "../../configs/prisma";
import { NotFoundError, ValidationError } from "../../packages/error-handler";

const verifyFYOwnership = async (fyId: number, userId: number) => {
	const fy = await prisma.financialYear.findFirst({
		where: { id: fyId, client: { user_id: userId } },
	});
	if (!fy) throw new NotFoundError("Financial year not found");
	return fy;
};

export const getAnnexures = async (fyId: number, userId: number) => {
	await verifyFYOwnership(fyId, userId);
	return prisma.annexure.findMany({
		where: { financial_year_id: fyId },
		orderBy: { ref_code: "asc" },
	});
};

export const createAnnexure = async (
	fyId: number,
	userId: number,
	payload: { title: string; ann_type?: string; data?: any },
) => {
	await verifyFYOwnership(fyId, userId);
	if (!payload.title?.trim()) throw new ValidationError("Title is required");

	const existing = await prisma.annexure.findMany({
		where: { financial_year_id: fyId },
		select: { ref_code: true },
		orderBy: { ref_code: "asc" },
	});

	const usedCodes = new Set(existing.map((a) => a.ref_code));
	let nextCode = "A";
	while (usedCodes.has(nextCode)) {
		nextCode = String.fromCharCode(nextCode.charCodeAt(0) + 1);
	}

	return prisma.annexure.create({
		data: {
			financial_year_id: fyId,
			ref_code: nextCode,
			title: payload.title.trim(),
			ann_type: (payload.ann_type as any) || "key_value",
			data: payload.data || { items: [] },
		},
	});
};

// ─── Auto-sync annexure totals → linked statement lines ─
async function syncAnnexureToStatementLines(ann: any): Promise<void> {
	const d = ann.data as any;
	let linkedAmount = 0;
	let wdvTotal = 0;
	let depTotal = 0;
	const isDepreciation = ann.ann_type === "depreciation_schedule";

	if (isDepreciation) {
		for (const item of d?.items ?? []) {
			const c = computeDepreciation(item);
			wdvTotal += c.wdv_closing;
			depTotal += c.depreciation;
		}
	} else if (ann.ann_type === "ledger") {
		const creditTotal = (d?.credit ?? []).reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
		const debitTotal = (d?.debit ?? []).reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
		linkedAmount = Math.abs(creditTotal - debitTotal);
	} else {
		linkedAmount = (d?.items ?? []).reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
	}

	const linkedLines = await prisma.statementLine.findMany({
		where: { financial_year_id: ann.financial_year_id, annexure_ref: ann.ref_code },
	});

	if (linkedLines.length === 0) return;

	await prisma.$transaction(
		linkedLines.map((line) => {
			let newAmount: number;
			if (isDepreciation) {
				const isExpense = line.section === "pl_debit_indirect" || line.section === "trading_debit_direct";
				newAmount = isExpense ? depTotal : wdvTotal;
			} else {
				newAmount = linkedAmount;
			}
			return prisma.statementLine.update({ where: { id: line.id }, data: { amount: newAmount } });
		}),
	);
}

export const updateAnnexure = async (
	annexureId: number,
	userId: number,
	payload: { title?: string; data?: any },
) => {
	const ann = await prisma.annexure.findFirst({
		where: { id: annexureId, financial_year: { client: { user_id: userId } } },
	});
	if (!ann) throw new NotFoundError("Annexure not found");

	const updateData: Record<string, any> = {};
	if (payload.title !== undefined) updateData.title = payload.title.trim();
	if (payload.data !== undefined) updateData.data = payload.data;

	const updated = await prisma.annexure.update({ where: { id: annexureId }, data: updateData });

	// Auto-sync: push computed totals into any statement lines that reference this annexure
	if (payload.data !== undefined) {
		await syncAnnexureToStatementLines(updated);
	}

	return updated;
};

export const deleteAnnexure = async (annexureId: number, userId: number) => {
	const ann = await prisma.annexure.findFirst({
		where: { id: annexureId, financial_year: { client: { user_id: userId } } },
	});
	if (!ann) throw new NotFoundError("Annexure not found");
	await prisma.annexure.delete({ where: { id: annexureId } });
};

// ─── Projection helpers ─────────────────────────────────

const r1000 = (n: number) => Math.round(n / 1000) * 1000;

function computeDepreciation(item: any) {
	const rate = parseFloat(item.rate) || 0;
	const wdv = parseFloat(item.wdv_opening) || 0;
	const addUpto = parseFloat(item.addition_upto) || 0;
	const addAfter = parseFloat(item.addition_after) || 0;
	const sold = parseFloat(item.sold_transfer) || 0;
	const total = wdv + addUpto + addAfter - sold;
	const dep = Math.ceil((wdv + addUpto) * rate / 100 + addAfter * rate / 200 - 0.5);
	return { total, depreciation: dep, wdv_closing: Math.ceil(total - dep - 0.5) };
}



// ─── Annexure projection helpers ────────────────────────
// Returns projected annexure data + computed totals per ref_code.
// Totals map: { wdv, dep } for depreciation_schedule; { total } for others.

function processAnnexuresForProjection(annexures: any[], factor: number) {
	const newAnnexures: any[] = [];
	const annTotals = new Map<string, { wdv?: number; dep?: number; total?: number }>();

	for (const ann of annexures) {
		const d = ann.data as any;

		if (ann.ann_type === "depreciation_schedule") {
			const newItems = (d?.items ?? []).map((item: any) => {
				const prev = computeDepreciation(item);
				return {
					name: item.name,
					rate: item.rate,
					wdv_opening: String(Math.round(prev.wdv_closing * 100) / 100),
					addition_upto: "",
					addition_after: "",
					sold_transfer: "",
				};
			});
			const wdvTotal = newItems.reduce((s: number, item: any) => s + (computeDepreciation(item).wdv_closing), 0);
			const depTotal = newItems.reduce((s: number, item: any) => s + (computeDepreciation(item).depreciation), 0);
			annTotals.set(ann.ref_code, { wdv: r1000(wdvTotal), dep: r1000(depTotal) });
			newAnnexures.push({ ref_code: ann.ref_code, title: ann.title, ann_type: ann.ann_type, data: { items: newItems } });

		} else if (ann.ann_type === "ledger") {
			const creditItems: any[] = d?.credit ?? [];
			const debitItems: any[] = d?.debit ?? [];
			const creditTotal = creditItems.reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
			const debitTotal = debitItems.reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
			const netBalance = creditTotal - debitTotal; // positive = credit balance (normal), negative = debit balance
			const closingBalance = Math.round(Math.abs(netBalance) * 100) / 100;

			// Project user-entered debit items (drawings/expenses) with growth factor
			const projectedDebitItems = debitItems.map((i: any) => ({
				name: i.name,
				amount: r1000((parseFloat(i.amount) || 0) * factor),
			}));

			let newDebit: any[];
			let newCredit: any[];
			if (netBalance >= 0) {
				// Credit balance (normal): Balance b/d goes on credit side of next year
				newDebit = projectedDebitItems;
				newCredit = [{ name: "Balance b/d", amount: closingBalance }];
			} else {
				// Debit balance: Balance b/d goes on debit side of next year
				newDebit = [{ name: "Balance b/d", amount: closingBalance }, ...projectedDebitItems];
				newCredit = [];
			}

			annTotals.set(ann.ref_code, { total: closingBalance });
			newAnnexures.push({
				ref_code: ann.ref_code, title: ann.title, ann_type: ann.ann_type,
				data: { debit: newDebit, credit: newCredit, items: [{ name: "Balance c/d", amount: closingBalance }] },
			});

		} else {
			const newItems = (d?.items ?? []).map((i: any) => ({ name: i.name, amount: r1000((i.amount ?? 0) * factor) }));
			const total = newItems.reduce((s: number, i: any) => s + i.amount, 0);
			annTotals.set(ann.ref_code, { total });
			newAnnexures.push({ ref_code: ann.ref_code, title: ann.title, ann_type: ann.ann_type, data: { items: newItems } });
		}
	}

	return { newAnnexures, annTotals };
}

function resolveLineAmount(
	line: any,
	annTotals: Map<string, { wdv?: number; dep?: number; total?: number }>,
	factor: number,
	sourceLines?: any[],
): number {
	// opening_stock must carry exactly from the source year's closing_stock (no growth factor)
	if (line.slot_key === "opening_stock" && sourceLines) {
		const closingLine = sourceLines.find((l: any) => l.slot_key === "closing_stock");
		if (closingLine) return Number(closingLine.amount);
	}

	if (!line.annexure_ref) return r1000(Number(line.amount) * factor);
	const t = annTotals.get(line.annexure_ref);
	if (!t) return r1000(Number(line.amount) * factor);
	// Depreciation schedule: asset sections get WDV, expense sections get depreciation amount
	if (t.wdv !== undefined) {
		const isExpenseSection = line.section === "pl_debit_indirect" || line.section === "trading_debit_direct";
		return isExpenseSection ? (t.dep ?? 0) : (t.wdv ?? 0);
	}
	return t.total ?? 0;
}

// ─── Project FY ─────────────────────────────────────────

export const projectFY = async (
	fyId: number,
	userId: number,
	growthPercent: number,
) => {
	const fy = await verifyFYOwnership(fyId, userId);
	const factor = 1 + growthPercent / 100;

	const prevEnd = new Date(fy.end_date);
	const nextStart = new Date(prevEnd);
	nextStart.setDate(nextStart.getDate() + 1);
	const nextEnd = new Date(nextStart);
	nextEnd.setFullYear(nextEnd.getFullYear() + 1);
	nextEnd.setDate(nextEnd.getDate() - 1);
	const newLabel = `${nextStart.getFullYear()}-${String(nextEnd.getFullYear()).slice(-2)}`;

	const [lines, annexures] = await Promise.all([
		prisma.statementLine.findMany({ where: { financial_year_id: fyId } }),
		prisma.annexure.findMany({ where: { financial_year_id: fyId } }),
	]);

	const { newAnnexures, annTotals } = processAnnexuresForProjection(annexures, factor);

	const newFY = await prisma.financialYear.create({
		data: {
			client_id: fy.client_id,
			label: newLabel,
			start_date: nextStart,
			end_date: nextEnd,
			source_fy_id: fyId,
			growth_percent: growthPercent,
		},
	});

	const ops: any[] = [];
	for (const line of lines) {
		ops.push(prisma.statementLine.create({
			data: {
				financial_year_id: newFY.id,
				statement_type: line.statement_type,
				section: line.section,
				slot_key: line.slot_key,
				label: line.label,
				amount: resolveLineAmount(line, annTotals, factor, lines),
				annexure_ref: line.annexure_ref,
				is_dynamic: line.is_dynamic,
				sort_order: line.sort_order,
			},
		}));
	}
	for (const ann of newAnnexures) {
		ops.push(prisma.annexure.create({
			data: { financial_year_id: newFY.id, ...ann },
		}));
	}
	if (ops.length > 0) await prisma.$transaction(ops);

	return newFY;
};

// ─── Re-project FY (adjust growth) ─────────────────────

export const reProjectFY = async (
	fyId: number,
	userId: number,
	growthPercent: number,
) => {
	const fy = await verifyFYOwnership(fyId, userId);
	if (!fy.source_fy_id) throw new ValidationError("This FY is not a projection — cannot re-project");

	const sourceFy = await verifyFYOwnership(fy.source_fy_id, userId);
	const factor = 1 + growthPercent / 100;

	const [lines, annexures] = await Promise.all([
		prisma.statementLine.findMany({ where: { financial_year_id: sourceFy.id } }),
		prisma.annexure.findMany({ where: { financial_year_id: sourceFy.id } }),
	]);

	const { newAnnexures, annTotals } = processAnnexuresForProjection(annexures, factor);

	await prisma.$transaction([
		prisma.statementLine.deleteMany({ where: { financial_year_id: fyId } }),
		prisma.annexure.deleteMany({ where: { financial_year_id: fyId } }),
	]);

	const ops: any[] = [
		prisma.financialYear.update({ where: { id: fyId }, data: { growth_percent: growthPercent } }),
	];
	for (const line of lines) {
		ops.push(prisma.statementLine.create({
			data: {
				financial_year_id: fyId,
				statement_type: line.statement_type,
				section: line.section,
				slot_key: line.slot_key,
				label: line.label,
				amount: resolveLineAmount(line, annTotals, factor, lines),
				annexure_ref: line.annexure_ref,
				is_dynamic: line.is_dynamic,
				sort_order: line.sort_order,
			},
		}));
	}
	for (const ann of newAnnexures) {
		ops.push(prisma.annexure.create({
			data: { financial_year_id: fyId, ...ann },
		}));
	}
	await prisma.$transaction(ops);

	return fy;
};
