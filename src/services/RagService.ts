import { PrismaClient } from '@prisma/client';
import { D1Prisma } from '../utils/D1Prisma';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { AuthenticatedUserData } from '../types/auth';
import { isAdmin, isOwner } from '../utils/roleUtils';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
export class RagService {
	private env: Env;
	private prisma: PrismaClient;

	constructor(env: Env) {
		this.env = env;
		this.prisma = D1Prisma.initializePrisma(env);
	}

	async addNote(request: Request, userData: AuthenticatedUserData, workspaceId: string): Promise<Response> {
		if (!isAdmin(userData, workspaceId) && !isOwner(userData, workspaceId)) {
			return ResponseFormatter.error('You are not authorized to add notes');
		}

		try {
			const body: { title: string; content: string; maxTokens?: number } = await request.json();
			const { title, content, maxTokens = 1024 } = body;

			if (title.length === 0) {
				return ResponseFormatter.error('Title is empty');
			}

			if (content.length === 0) {
				return ResponseFormatter.error('Content is empty');
			}

			console.log('Creating note in D1 database...');
			// Create the main note
			const note = await this.prisma.note.create({
				data: {
					title: title,
					workspaceId: workspaceId,
				},
			});

			if (!note) {
				return ResponseFormatter.error('Failed to create note');
			}

			const chunks = await this.chunkContent(content, maxTokens);
			console.log(`Split content into ${chunks.length} chunks using token-based chunking with size ${maxTokens}`);

			// Store chunks and generate embeddings using the refactored method
			const chunkResults = await this.processAndStoreChunks(note.id, workspaceId, chunks);

			return ResponseFormatter.success(
				{
					note,
					chunks: chunkResults,
					totalChunks: chunks.length,
				},
				'Note created successfully'
			);
		} catch (error: any) {
			console.error('Error in addNote:', error);
			return ResponseFormatter.error(`Error creating note: ${error.message || 'Unknown error'}`);
		}
	}

	private async chunkContent(content: string, maxTokens: number = 256): Promise<string[]> {
		// Create a text splitter with overlap
		const textSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: maxTokens,
			chunkOverlap: Math.floor(maxTokens * 0.2), // 20% overlap between chunks
			separators: ['\n\n', '\n', ' ', ''], // Split on paragraphs, lines, words, and characters
		});

		// Split the text into chunks
		const chunks = await textSplitter.splitText(content);

		// Filter out trivial chunks (keeping the same logic as before)
		return chunks.filter((chunk: string) => chunk.trim().length >= 5);
	}

	private async processAndStoreChunks(
		noteId: string,
		workspaceId: string,
		chunks: string[]
	): Promise<Array<{ id: number; chunkIndex: number; contentLength: number }>> {
		const chunkResults = [];
		for (let i = 0; i < chunks.length; i++) {
			const chunkContent = chunks[i];

			// Create chunk in database
			const chunk = await this.prisma.noteChunk.create({
				data: {
					noteId: noteId,
					content: chunkContent,
					chunkIndex: i,
				},
			});

			// Create vector entry
			await this.prisma.vectorEntry.create({
				data: {
					docId: noteId.toString(), // Ensure docId is string if noteId isn't already
					vectorId: chunk.id.toString(),
				},
			});

			console.log(`Created chunk ${i + 1}/${chunks.length}`);

			// Generate embedding for the chunk
			const embedding = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
				text: chunkContent,
			});

			// Store embedding in vector database
			if (this.env.VECTORIZE) {
				await this.env.VECTORIZE.insert([
					{
						id: chunk.id.toString(),
						values: embedding.data[0],
						metadata: {
							id: chunk.id.toString(),
							noteId: noteId,
							chunkIndex: i,
							workspaceId: workspaceId,
						},
					},
				]);
				console.log(`Stored embedding for chunk ${i + 1}/${chunks.length}`);
			} else {
				console.warn('VECTORIZE binding is not available. Skipping vector storage.');
			}

			chunkResults.push({
				id: chunk.id,
				chunkIndex: i,
				contentLength: chunkContent.length,
			});
		}
		return chunkResults;
	}

	async queryNote(query: string, workspaceId: string, limit: number = 5): Promise<Array<{ id: string; title: string; content: string; score: number; chunkId?: string; chunkIndex?: number }>> {
		try {
			if (!query || query.length === 0) {
				return [];
			}

			const { notes, error } = await this.searchNotesByVector(query, workspaceId, limit);

			if (error) {
				return [];
			}

			// Format the response to include chunk information if available
			const formattedResults = notes.map((note) => ({
				id: note.id,
				title: note.title,
				content: note.content,
				score: note.score,
				isChunk: !!note.chunkId,
				chunkId: note.chunkId,
				chunkIndex: note.chunkIndex,
			}));

			return formattedResults;
		} catch (error: any) {
			console.error('Error in queryNote:', error);
			return [];
		}
	}

	private async searchNotesByVector(
		query: string,
		workspaceId: string,
		limit: number = 5
	): Promise<{
		notes: Array<{ id: string; title: string; content: string; score: number; chunkId?: string; chunkIndex?: number }>;
		error?: string;
	}> {
		try {
			// Check if VECTORIZE is available
			if (!this.env.VECTORIZE) {
				return { notes: [], error: 'Vector search is not available in this environment' };
			}

			// Generate embedding for the query using the same model
			const queryEmbedding = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
				text: query,
			});

			// Search for similar vectors
			const results = await this.env.VECTORIZE.query(queryEmbedding.data[0], {
				topK: limit,
				returnValues: true,
				returnMetadata: true,
			});

			console.log(
				'results',
				results.matches.map((match) => match.metadata)
			);

			if (!results || results.matches.length === 0) {
				return { notes: [], error: 'No similar notes found' };
			}

			const filteredResults = results.matches.filter((match) => match.metadata?.workspaceId === workspaceId);
			console.log('filteredResults', filteredResults);
			// Process results
			const processedResults = [];
			for (const match of filteredResults) {
				const metadata = match.metadata as { id: string; noteId?: string; chunkIndex?: number };

				if (metadata.noteId) {
					// This is a chunk, get the parent note
					const note = await this.prisma.note.findUnique({
						where: { id: metadata.noteId },
					});

					if (note) {
						// Get the specific chunk content
						const chunk = await this.prisma.noteChunk.findUnique({
							where: { id: parseInt(metadata.id) },
						});

						processedResults.push({
							id: note.id,
							title: note.title,
							content: chunk?.content || '',
							score: match.score,
							chunkId: metadata.id,
							chunkIndex: metadata.chunkIndex,
						});
					}
				}
			}

			return { notes: processedResults };
		} catch (error: any) {
			console.error('Error in searchNotesByVector:', error);
			return { notes: [], error: `Error searching notes: ${error.message || 'Unknown error'}` };
		}
	}
}
