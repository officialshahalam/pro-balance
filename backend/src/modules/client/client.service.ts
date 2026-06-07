import prisma from "../../configs/prisma";
import {
	AppError,
	DatabaseError,
	NotFoundError,
	ValidationError,
} from "../../packages/error-handler";

type CreateClientInput = {
	name: string;
	firm_type?: string;
	pan?: string;
	gstin?: string;
	phone?: string;
	email?: string;
	address_line?: string;
	village?: string;
	post_office?: string;
	city?: string;
	state?: string;
	pin_code?: string;
};

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/;

export const createClient = async (userId: number, payload: CreateClientInput) => {
	const name = payload.name?.trim();
	if (!name || name.length < 2) {
		throw new ValidationError("Client name must be at least 2 characters");
	}

	const pan = payload.pan?.trim().toUpperCase() || null;
	const gstin = payload.gstin?.trim().toUpperCase() || null;

	if (pan && !PAN_REGEX.test(pan)) {
		throw new ValidationError("Invalid PAN format (e.g. ABCDE1234F)");
	}
	if (gstin && !GSTIN_REGEX.test(gstin)) {
		throw new ValidationError("Invalid GSTIN format (e.g. 22ABCDE1234F1Z5)");
	}

	// Check if PAN or GSTIN already exists for this CA
	if (pan || gstin) {
		const existing = await prisma.client.findFirst({
			where: {
				user_id: userId,
				OR: [
					...(pan ? [{ pan }] : []),
					...(gstin ? [{ gstin }] : []),
				],
			},
			select: { id: true, name: true, pan: true, gstin: true },
		});

		if (existing) {
			if (pan && existing.pan === pan) {
				throw new ValidationError(`PAN ${pan} already exists for client "${existing.name}"`);
			}
			if (gstin && existing.gstin === gstin) {
				throw new ValidationError(`GSTIN ${gstin} already exists for client "${existing.name}"`);
			}
		}
	}

	try {
		return await prisma.client.create({
			data: {
				user_id: userId,
				name,
				firm_type: payload.firm_type?.trim() || null,
				pan,
				gstin,
				phone: payload.phone?.trim() || null,
				email: payload.email?.trim().toLowerCase() || null,
				address_line: payload.address_line?.trim() || null,
				village: payload.village?.trim() || null,
				post_office: payload.post_office?.trim() || null,
				city: payload.city?.trim() || null,
				state: payload.state?.trim() || null,
				pin_code: payload.pin_code?.trim() || null,
			},
		});
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new DatabaseError("Failed to create client", error);
	}
};

export const getClients = async (userId: number) => {
	return prisma.client.findMany({
		where: { user_id: userId },
		orderBy: { created_at: "desc" },
		include: {
			_count: { select: { financial_years: true } },
		},
	});
};

export const getClientById = async (clientId: number, userId: number) => {
	const client = await prisma.client.findFirst({
		where: { id: clientId, user_id: userId },
		include: {
			financial_years: { orderBy: { start_date: "desc" } },
		},
	});

	if (!client) throw new NotFoundError("Client not found");
	return client;
};

export const updateClient = async (
	clientId: number,
	userId: number,
	payload: Partial<CreateClientInput>,
) => {
	const client = await prisma.client.findFirst({
		where: { id: clientId, user_id: userId },
		select: { id: true },
	});

	if (!client) throw new NotFoundError("Client not found");

	const data: Record<string, any> = {};
	if (payload.name !== undefined) {
		const name = payload.name.trim();
		if (name.length < 2) throw new ValidationError("Client name must be at least 2 characters");
		data.name = name;
	}
	if (payload.firm_type !== undefined) data.firm_type = payload.firm_type?.trim() || null;
	if (payload.pan !== undefined) data.pan = payload.pan?.trim().toUpperCase() || null;
	if (payload.gstin !== undefined) data.gstin = payload.gstin?.trim().toUpperCase() || null;
	if (payload.phone !== undefined) data.phone = payload.phone?.trim() || null;
	if (payload.email !== undefined) data.email = payload.email?.trim().toLowerCase() || null;
	if (payload.address_line !== undefined) data.address_line = payload.address_line?.trim() || null;
	if (payload.village !== undefined) data.village = payload.village?.trim() || null;
	if (payload.post_office !== undefined) data.post_office = payload.post_office?.trim() || null;
	if (payload.city !== undefined) data.city = payload.city?.trim() || null;
	if (payload.state !== undefined) data.state = payload.state?.trim() || null;
	if (payload.pin_code !== undefined) data.pin_code = payload.pin_code?.trim() || null;

	return prisma.client.update({
		where: { id: clientId },
		data,
	});
};

export const deleteClient = async (clientId: number, userId: number) => {
	const client = await prisma.client.findFirst({
		where: { id: clientId, user_id: userId },
		select: { id: true },
	});

	if (!client) throw new NotFoundError("Client not found");

	await prisma.client.delete({ where: { id: clientId } });
};
