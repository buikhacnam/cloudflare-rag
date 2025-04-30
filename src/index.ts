import { RequestHandler } from './handlers/RequestHandler';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const requestHandler = new RequestHandler(env);
		return await requestHandler.handleRequest(request);
	},
} satisfies ExportedHandler<Env>;
