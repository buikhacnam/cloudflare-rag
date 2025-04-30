import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

export class D1Prisma {
	public static initializePrisma(env: Env): PrismaClient {
		const adapter = new PrismaD1(env.DB);
		return new PrismaClient({ adapter });
	}
}
