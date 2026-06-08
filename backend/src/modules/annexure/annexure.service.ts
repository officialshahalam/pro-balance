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

// ─── Source-year net-profit helpers (Fix A: carry capital incl. net profit) ─
// Annexure totals at the SOURCE year (no growth factor) — mirrors the
// frontend buildAnnexureMap so net profit is computed identically.
function computeSourceAnnTotals(annexures: any[]) {
	const totals = new Map<string, { wdv?: number; dep?: number; total?: number }>();
	for (const ann of annexures) {
		const d = ann.data as any;
		if (ann.ann_type === "depreciation_schedule") {
			let wdv = 0, dep = 0;
			for (const item of d?.items ?? []) {
				const c = computeDepreciation(item);
				wdv += c.wdv_closing;
				dep += c.depreciation;
			}
			totals.set(ann.ref_code, { wdv, dep });
		} else if (ann.ann_type === "ledger") {
			const creditTotal = (d?.credit ?? []).reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
			const debitTotal = (d?.debit ?? []).reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
			totals.set(ann.ref_code, { total: Math.max(0, creditTotal - debitTotal) });
		} else {
			const total = (d?.items ?? []).reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0);
			totals.set(ann.ref_code, { total });
		}
	}
	return totals;
}

// Effective source amount of a P&L line (annexure-resolved, no growth).
function effectiveSourceAmount(line: any, srcAnnTotals: Map<string, { wdv?: number; dep?: number; total?: number }>): number {
	if (!line.annexure_ref) return Number(line.amount);
	const t = srcAnnTotals.get(line.annexure_ref);
	if (!t) return Number(line.amount);
	if (t.wdv !== undefined) {
		const isExpenseSection = line.section === "pl_debit_indirect" || line.section === "trading_debit_direct";
		return isExpenseSection ? (t.dep ?? 0) : (t.wdv ?? 0);
	}
	return t.total ?? 0;
}

// Net profit of the source year — same formula as the frontend computeNetProfit.
// (other-income lines use raw amounts; all other lines are annexure-resolved.)
function computeSourceNetProfit(plLines: any[], srcAnnTotals: Map<string, { wdv?: number; dep?: number; total?: number }>): number {
	let credit = 0, debit = 0, indirect = 0, otherIncomePL = 0;
	for (const line of plLines) {
		const raw = Number(line.amount);
		const eff = effectiveSourceAmount(line, srcAnnTotals);
		switch (line.section) {
			case "trading_credit": credit += eff; break;          // sales, closing stock
			case "trading_credit_other": credit += raw; break;    // trading other income
			case "trading_debit": debit += eff; break;            // opening stock, purchases
			case "trading_debit_direct": debit += eff; break;     // direct expenses
			case "pl_debit_indirect": indirect += eff; break;     // indirect expenses
			case "pl_credit_other": otherIncomePL += raw; break;  // P&L other income
		}
	}
	const gross = credit - debit;
	return gross + otherIncomePL - indirect;
}

// The capital account's ledger ref_code (BS "owners_capital" slot → annexure, else first ledger).
function findCapitalRef(bsLines: any[], annexures: any[]): string | undefined {
	const cap = bsLines.find((l) => l.slot_key === "owners_capital" && l.annexure_ref);
	if (cap?.annexure_ref) return cap.annexure_ref;
	return annexures.find((a) => a.ann_type === "ledger")?.ref_code;
}

// ─── Annexure projection helpers ────────────────────────
// Returns projected annexure data + computed totals per ref_code.
// Totals map: { wdv, dep } for depreciation_schedule; { total } for others.

function processAnnexuresForProjection(
	annexures: any[],
	factor: number,
	opts: { capitalRef?: string; netProfit?: number } = {},
) {
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
			// Fix A: the capital account's closing balance must include the source
			// year's net profit (it is display-only and not stored as a credit line),
			// otherwise the prior year's profit is dropped on carry-forward.
			const isCapital = !!opts.capitalRef && ann.ref_code === opts.capitalRef;
			const effectiveNet = isCapital ? netBalance + (opts.netProfit ?? 0) : netBalance;
			const closingBalance = Math.round(Math.abs(effectiveNet) * 100) / 100;

			// Project user-entered debit items (drawings/expenses) with growth factor
			const projectedDebitItems = debitItems.map((i: any) => ({
				name: i.name,
				amount: r1000((parseFloat(i.amount) || 0) * factor),
			}));

			let newDebit: any[];
			let newCredit: any[];
			if (effectiveNet >= 0) {
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
		const closingLine = sourceLines.find((l: any) => l.slot_key === "closing_stock" && l.statement_type === "PROFIT_LOSS");
		if (closingLine) return Number(closingLine.amount);
	}

	// The Balance Sheet "Closing Stock" slot mirrors the P&L closing stock in every projected year.
	if (line.slot_key === "closing_stock" && line.statement_type === "BALANCE_SHEET" && sourceLines) {
		const plClosing = sourceLines.find((l: any) => l.slot_key === "closing_stock" && l.statement_type === "PROFIT_LOSS");
		if (plClosing) return r1000(Number(plClosing.amount) * factor);
	}

	// Opening stock is carried flat (continuity) while closing/sales/etc grow by the factor.
	// Absorb that asymmetry into purchases so gross & net profit grow by the factor:
	//   factor·purchases + factor·prevOpening − prevClosing.
	// (Closing stock itself just grows by the factor via the generic branch below.)
	if (line.slot_key === "purchases" && !line.annexure_ref && sourceLines) {
		const prevOpen = Number(sourceLines.find((l: any) => l.slot_key === "opening_stock" && l.statement_type === "PROFIT_LOSS")?.amount ?? 0);
		const prevClose = Number(sourceLines.find((l: any) => l.slot_key === "closing_stock" && l.statement_type === "PROFIT_LOSS")?.amount ?? 0);
		return r1000(factor * Number(line.amount) + factor * prevOpen - prevClose);
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

// ─── Projected-year balancing (Fix #1) ──────────────────

// Net profit from projected P&L lines, using the SAME un-rounded annexure totals
// the frontend displays (projDisplayTotals) — not the r1000'd resolved line amounts.
// Mirrors the frontend computeNetProfit/getAmt so the on-screen BS balances exactly.
function computeNetProfitFromResolved(
	plLines: any[],
	projDisplayTotals: Map<string, { wdv?: number; dep?: number; total?: number }>,
): number {
	const eff = (l: any): number => {
		if (l.annexure_ref && projDisplayTotals.has(l.annexure_ref)) {
			const t = projDisplayTotals.get(l.annexure_ref)!;
			return t.dep !== undefined ? t.dep : (t.total ?? 0);
		}
		return Number(l.amount);
	};
	let credit = 0, debit = 0, indirect = 0, otherIncomePL = 0;
	for (const l of plLines) {
		switch (l.section) {
			case "trading_credit": credit += eff(l); break;                 // sales, closing stock
			case "trading_credit_other": credit += Number(l.amount); break; // trading other income (raw)
			case "trading_debit": debit += eff(l); break;                   // opening stock, purchases
			case "trading_debit_direct": debit += eff(l); break;            // direct expenses
			case "pl_debit_indirect": indirect += eff(l); break;            // indirect expenses
			case "pl_credit_other": otherIncomePL += Number(l.amount); break; // P&L other income (raw)
		}
	}
	return (credit - debit) + otherIncomePL - indirect;
}

// Shift an items-list annexure's total by `delta` (signed). Mutates ann.data.items.
function adjustItemsAnnexure(ann: any, delta: number): void {
	const items: any[] = (ann.data?.items ?? []).map((i: any) => ({ ...i }));
	let remaining = delta;
	if (delta < 0) {
		for (let i = items.length - 1; i >= 0 && remaining < -0.005; i--) {
			const reducible = Math.min(items[i].amount, -remaining);
			items[i].amount -= reducible;
			remaining += reducible;
		}
	} else if (delta > 0) {
		if (items.length > 0) items[items.length - 1].amount += delta;
		else items.push({ name: ann.title || "Balancing", amount: delta });
	}
	ann.data = { ...ann.data, items };
}

// Plug the BS liabilities/assets difference into Sundry Debtors → Cash in Hand
// (nothing negative). Mutates projectedLines / newAnnexures in place.
function balanceProjectedBS(
	projectedLines: any[],
	newAnnexures: any[],
	projDisplayTotals: Map<string, { wdv?: number; dep?: number; total?: number }>,
	projNetProfit: number,
	capitalRef: string | undefined,
): void {
	const bsLines = projectedLines.filter((l) => l.statement_type === "BALANCE_SHEET");

	const lineDisplay = (l: any): number => {
		let amt: number;
		if (l.annexure_ref && projDisplayTotals.has(l.annexure_ref)) {
			const t = projDisplayTotals.get(l.annexure_ref)!;
			amt = t.wdv !== undefined ? (t.wdv ?? 0) : (t.total ?? 0);
		} else {
			amt = Number(l.amount);
		}
		if (capitalRef && l.annexure_ref === capitalRef) amt += projNetProfit;
		return amt;
	};

	let liab = 0, asset = 0;
	for (const l of bsLines) {
		const amt = lineDisplay(l);
		if (l.section.startsWith("liab_")) liab += amt;
		else if (l.section.startsWith("asset_")) asset += amt;
	}

	let remaining = liab - asset;
	if (Math.abs(remaining) < 0.005) return;

	for (const label of ["sundry debtors", "cash in hand"]) {
		if (Math.abs(remaining) < 0.005) break;
		const line = bsLines.find(
			(l) => l.is_dynamic && l.section.startsWith("asset_") && (l.label ?? "").trim().toLowerCase() === label,
		);
		if (!line) continue;
		const current = lineDisplay(line);
		const newVal = Math.max(0, current + remaining);
		const delta = newVal - current;
		remaining -= delta;

		const ann = line.annexure_ref ? newAnnexures.find((a) => a.ref_code === line.annexure_ref) : undefined;
		if (ann && ann.ann_type !== "ledger" && ann.ann_type !== "depreciation_schedule") {
			adjustItemsAnnexure(ann, delta);
		} else {
			line.amount = newVal;
		}
	}
}

// Resolve every projected line + annexure, then balance the BS. Shared by project/re-project.
function resolveAndBalanceProjection(lines: any[], annexures: any[], factor: number) {
	const srcAnnTotals = computeSourceAnnTotals(annexures);
	const sourceNetProfit = computeSourceNetProfit(lines.filter((l) => l.statement_type === "PROFIT_LOSS"), srcAnnTotals);
	const capitalRef = findCapitalRef(lines.filter((l) => l.statement_type === "BALANCE_SHEET"), annexures);

	const { newAnnexures, annTotals } = processAnnexuresForProjection(annexures, factor, { capitalRef, netProfit: sourceNetProfit });

	const projectedLines = lines.map((line) => ({
		statement_type: line.statement_type,
		section: line.section,
		slot_key: line.slot_key,
		label: line.label,
		amount: resolveLineAmount(line, annTotals, factor, lines),
		annexure_ref: line.annexure_ref,
		is_dynamic: line.is_dynamic,
		sort_order: line.sort_order,
	}));

	const projDisplayTotals = computeSourceAnnTotals(newAnnexures);
	const projNetProfit = computeNetProfitFromResolved(projectedLines.filter((l) => l.statement_type === "PROFIT_LOSS"), projDisplayTotals);
	balanceProjectedBS(projectedLines, newAnnexures, projDisplayTotals, projNetProfit, capitalRef);

	return { projectedLines, projectedAnnexures: newAnnexures };
}

// ─── Project FY ─────────────────────────────────────────

export const projectFY = async (
	fyId: number,
	userId: number,
	growthPercent: number,
) => {
	const fy = await verifyFYOwnership(fyId, userId);

	const existingProjection = await prisma.financialYear.findFirst({
		where: { source_fy_id: fyId },
		select: { id: true, label: true },
	});
	if (existingProjection) {
		throw new ValidationError(
			`A projection (FY ${existingProjection.label}) already exists for this year. Use "Adjust Growth" to modify it.`,
		);
	}

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

	const { projectedLines, projectedAnnexures } = resolveAndBalanceProjection(lines, annexures, factor);

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
	for (const line of projectedLines) {
		ops.push(prisma.statementLine.create({
			data: { financial_year_id: newFY.id, ...line },
		}));
	}
	for (const ann of projectedAnnexures) {
		ops.push(prisma.annexure.create({
			data: { financial_year_id: newFY.id, ...ann },
		}));
	}
	if (ops.length > 0) await prisma.$transaction(ops, { timeout: 60_000 });

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

	const { projectedLines, projectedAnnexures } = resolveAndBalanceProjection(lines, annexures, factor);

	await prisma.$transaction([
		prisma.statementLine.deleteMany({ where: { financial_year_id: fyId } }),
		prisma.annexure.deleteMany({ where: { financial_year_id: fyId } }),
	], { timeout: 30_000 });

	const ops: any[] = [
		prisma.financialYear.update({ where: { id: fyId }, data: { growth_percent: growthPercent } }),
	];
	for (const line of projectedLines) {
		ops.push(prisma.statementLine.create({
			data: { financial_year_id: fyId, ...line },
		}));
	}
	for (const ann of projectedAnnexures) {
		ops.push(prisma.annexure.create({
			data: { financial_year_id: fyId, ...ann },
		}));
	}
	await prisma.$transaction(ops, { timeout: 60_000 });

	return fy;
};
