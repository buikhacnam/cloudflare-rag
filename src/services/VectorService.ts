import { ResponseFormatter } from '../utils/ResponseFormatter';

export class VectorService {
	private env: Env;

	constructor(env: Env) {
		this.env = env;
	}

	async deleteVector(request: Request) {
        const body: { vectorIds: string[] } = await request.json();
		const { vectorIds } = body;
		if (!vectorIds) {
			return ResponseFormatter.error('Vector IDs are required');
		}
		await this.env.VECTORIZE.deleteByIds(vectorIds);
		console.log(`Deleted vectors ${vectorIds}`);
		return ResponseFormatter.success('Vectors deleted');
	}

	async getVectorListByIds(request: Request) {
		const body: { vectorIds: string[] } = await request.json();
		const { vectorIds } = body;
		if (!vectorIds) {
			return ResponseFormatter.error('Vector IDs are required');
		}
		const vectorList = await this.env.VECTORIZE.getByIds(vectorIds);
		return ResponseFormatter.success(
			(vectorList || []).map((vector) => ({
				id: vector.id,
				values: vector.values,
				metadata: vector.metadata,
			}))
		);
	}
}
