import { D1Prisma } from '../utils/D1Prisma';
import { PrismaClient, Prisma } from '@prisma/client';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { RagService } from './RagService';
import type { AiTextGenerationInput } from '@cloudflare/workers-types';

interface CfAiMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export class ChatService {
	private env: Env;
	private prisma: PrismaClient;
	private ragService: RagService;
	constructor(env: Env) {
		this.env = env;
		this.prisma = D1Prisma.initializePrisma(env);
		this.ragService = new RagService(env);
	}

	async chatWithNotes(request: Request, pathname: string): Promise<Response> {
		try {
			const body: { message: string; limit?: number; workspaceId?: string } = await request.json();
			const { message, limit = 5, workspaceId } = body;

			if (!message || message.length === 0) {
				return ResponseFormatter.error('Message is empty');
			}

			if (!workspaceId) {
				return ResponseFormatter.error('Workspace ID is required');
			}

			const sessionId = this.getSessionIdFromPath(pathname);
			console.log(`Using sessionId: ${sessionId}`);

			const history = await this.getMessageHistory(sessionId);
			console.log(`Found ${history.length} messages in history`);

			const userMsg: CfAiMessage = { role: 'user', content: message };

			const notes = await this.ragService.queryNote(message, workspaceId, limit);

			let notesContext = `No relevant notes found.`;
			if (notes.length > 0) {
				notesContext = notes
					.map(
						(note) =>
							`Title: ${note.title}\nContent: ${note.content}\nRelevance Score: ${note.score}${
								note.chunkId ? `\nChunk Index: ${note.chunkIndex}` : ''
							}\n---`
					)
					.join('\n\n');
			}

			console.log(`Notes context: ${notesContext}`);

			const systemMessage: CfAiMessage = {
				role: 'system',
				content: `You are a helpful assistant that can answer questions. Please use the following notes to answer the question. If there is no relevant notes, please say you don't know. \n\n${notesContext}`,
			};

			const messagesForAI: CfAiMessage[] = [systemMessage, ...history, userMsg];

			await this.saveMessage(sessionId, workspaceId, 'user', message);

			console.log('Calling Cloudflare AI...');
			const aiInput: AiTextGenerationInput = {
				messages: messagesForAI,
				stream: false,
				max_tokens: 1000,
				temperature: 0.7,
			};
			const aiResponse = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', aiInput);

			// Type guard to check if the response is the non-streamed object
			if (
				!aiResponse ||
				typeof aiResponse !== 'object' ||
				aiResponse instanceof ReadableStream ||
				!('response' in aiResponse) ||
				typeof aiResponse.response !== 'string'
			) {
				console.error('Invalid or streamed response format from Cloudflare AI:', aiResponse);
				return ResponseFormatter.error('Failed to get a valid non-streamed response from the AI model.');
			}

			const answer = aiResponse.response;

			await this.saveMessage(sessionId, workspaceId, 'assistant', answer);

			return ResponseFormatter.success(
				{
					answer,
					sessionId,
					relevantNotes: notes.map((note) => ({
						id: note.id,
						title: note.title,
						score: note.score,
						chunkId: note.chunkId,
						chunkIndex: note.chunkIndex,
					})),
				},
				'Response generated successfully'
			);
		} catch (error: any) {
			console.error('Error in chatWithNotes:', error);
			if (error.message && error.message.includes('Authentication error')) {
				return ResponseFormatter.error('AI Service Authentication Error.', 500);
			}
			return ResponseFormatter.error(`Error generating response: ${error.message || 'Unknown error'}`);
		}
	}

	private getSessionIdFromPath(pathname: string): string {
		const match = pathname.match(/\/playground\/chat\/([^/]+)/);
		if (match && match[1]) {
			return match[1];
		}
		return crypto.randomUUID();
	}

	private async saveMessage(sessionId: string, workspaceId: string, role: 'user' | 'assistant', text: string) {
		const messageToStore: CfAiMessage = { role, content: text };
		await this.prisma.messageTemp.create({
			data: {
				sessionId,
				workspaceId,
				content: messageToStore as unknown as Prisma.InputJsonValue,
			},
		});
	}

	async getMessageHistory(sessionId: string): Promise<CfAiMessage[]> {
		const messages = await this.prisma.messageTemp.findMany({
			where: { sessionId },
			orderBy: { createdAt: 'asc' },
		});

		const history: CfAiMessage[] = [];
		for (const msg of messages) {
			if (this.isCfAiMessage(msg.content)) {
				if (msg.content.role === 'user' || msg.content.role === 'assistant') {
					history.push(msg.content);
				}
			} else {
				console.warn(`Skipping invalid message structure in history for session ${sessionId}:`, msg.content);
			}
		}
		return history;
	}

	private isCfAiMessage(obj: any): obj is CfAiMessage {
		return (
			obj &&
			typeof obj === 'object' &&
			(obj.role === 'system' || obj.role === 'user' || obj.role === 'assistant') &&
			typeof obj.content === 'string'
		);
	}
}
