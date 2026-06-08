import prisma from "../../configs/prisma";
import {
	AppError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "../../packages/error-handler";

type CreateFYInput = {
	label: string;
	start_date: string;
	end_date: string;
};

const verifyClientOwnership = async (clientId: number, userId: number) => {
	const client = await prisma.client.findFirst({
		where: { id: clientId, user_id: userId },
		select: { id: true },
	});
	if (!client) throw new NotFoundError("Client not found");
	return client;
};

export const verifyFYOwnership = async (fyId: number, userId: number) => {
	const fy = await prisma.financialYear.findFirst({
		where: { id: fyId, client: { user_id: userId } },
	});
	if (!fy) throw new NotFoundError("Financial year not found");
	return fy;
};

export const createFinancialYear = async (
	clientId: number,
	userId: number,
	payload: CreateFYInput,
) => {
	await verifyClientOwnership(clientId, userId);

	const label = payload.label?.trim();
	if (!label) throw new ValidationError("Financial year label is required");
	if (!/^\d{4}-\d{2}$/.test(label)) throw new ValidationError("Label must be in format YYYY-YY (e.g. 2025-26)");

	const startDate = new Date(payload.start_date);
	const endDate = new Date(payload.end_date);
	if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
		throw new ValidationError("Valid start and end dates are required");
	}
	if (endDate <= startDate) {
		throw new ValidationError("End date must be after start date");
	}
	const maxEnd = new Date(startDate);
	maxEnd.setFullYear(maxEnd.getFullYear() + 1);
	if (endDate > maxEnd) {
		throw new ValidationError("Financial year cannot exceed 1 year");
	}

	try {
		const fy = await prisma.financialYear.create({
			data: {
				client_id: clientId,
				label,
				start_date: startDate,
				end_date: endDate,
			},
		});
		await prisma.annexure.createMany({
			data: [
				{
					financial_year_id: fy.id,
					ref_code: "A",
					title: "Capital Account",
					ann_type: "ledger",
					data: { debit: [], credit: [], items: [] },
				},
				{
					financial_year_id: fy.id,
					ref_code: "B",
					title: "Fixed Assets",
					ann_type: "depreciation_schedule",
					data: { items: [] },
				},
			],
		});
		return fy;
	} catch (error) {
		if (error instanceof AppError) throw error;
		if ((error as any)?.code === "P2002") {
			throw new ValidationError("A financial year with this label already exists for this client");
		}
		throw new DatabaseError("Failed to create financial year", error);
	}
};

export const getFinancialYears = async (clientId: number, userId: number) => {
	await verifyClientOwnership(clientId, userId);

	return prisma.financialYear.findMany({
		where: { client_id: clientId },
		orderBy: { start_date: "desc" },
		include: {
			_count: {
				select: { statement_lines: true, annexures: true },
			},
		},
	});
};

export const getFinancialYearById = async (fyId: number, userId: number) => {
	const fy = await prisma.financialYear.findFirst({
		where: { id: fyId, client: { user_id: userId } },
		include: {
			_count: {
				select: { statement_lines: true, annexures: true },
			},
		},
	});

	if (!fy) throw new NotFoundError("Financial year not found");
	return fy;
};

export const updateFinancialYear = async (
	fyId: number,
	userId: number,
	payload: Partial<CreateFYInput>,
) => {
	await verifyFYOwnership(fyId, userId);

	const data: Record<string, any> = {};
	if (payload.label !== undefined) {
		const label = payload.label.trim();
		if (!label) throw new ValidationError("Label cannot be empty");
		data.label = label;
	}
	if (payload.start_date !== undefined) data.start_date = new Date(payload.start_date);
	if (payload.end_date !== undefined) data.end_date = new Date(payload.end_date);

	try {
		return await prisma.financialYear.update({ where: { id: fyId }, data });
	} catch (error) {
		if ((error as any)?.code === "P2002") {
			throw new ValidationError("A financial year with this label already exists for this client");
		}
		throw new DatabaseError("Failed to update financial year", error);
	}
};

export const deleteFinancialYear = async (fyId: number, userId: number) => {
	await verifyFYOwnership(fyId, userId);
	await prisma.financialYear.delete({ where: { id: fyId } });
};

export const finalizeFinancialYear = async (fyId: number, userId: number) => {
	const fy = await verifyFYOwnership(fyId, userId);
	if (fy.is_finalized) throw new ValidationError("Financial year is already finalized");

	return prisma.financialYear.update({
		where: { id: fyId },
		data: { is_finalized: true, finalized_at: new Date() },
	});
};
