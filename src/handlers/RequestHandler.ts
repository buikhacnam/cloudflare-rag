import { AuthService } from '../services/AuthService';
import { ResponseFormatter } from '../utils/ResponseFormatter';

// Import the combined HTML page
import chatWidgetHtml from '../ui/pages/chat-widget.html';
import { RagService } from '../services/RagService';
import { AuthenticatedUserData } from '../types/auth'; // Import the shared type
import { requireAuth } from '../middleware/authMiddleware'; // Import the middleware
import { ChatService } from '../services/ChatService';

export class RequestHandler {
	private authService: AuthService;
	private ragService: RagService;
	private chatService: ChatService;
	constructor(env: Env) {
		this.authService = new AuthService(env);
		this.ragService = new RagService(env);
		this.chatService = new ChatService(env);
	}

	public async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		try {
			// Serve chat widget UI
			if (request.method === 'GET' && pathname.startsWith('/playground/widget/chat')) {
				// Check if it's the base path without a session ID
				if (pathname === '/playground/widget/chat') {
					const newSessionId = crypto.randomUUID();
					const redirectUrl = `/playground/widget/chat/${newSessionId}`;
					// Use a temporary redirect (302)
					return Response.redirect(url.origin + redirectUrl, 302);
				} else {
					// Path includes something after /chat (presumably a session ID)
					// Serve the HTML page
					return new Response(chatWidgetHtml, {
						headers: { 'Content-Type': 'text/html' },
					});
				}
			}

			if (pathname.startsWith('/auth')) {
				return await this.handleAuthRoutes(request, pathname);
			}

			if (pathname.startsWith('/playground')) {
				return await this.handlePlaygroundApi(request, pathname);
			}

			const API_BASE = '/api/v1';

			const workspaceApiMatch = pathname.match(`^${API_BASE}/([^/]+)(/.*)?$`);

			if (workspaceApiMatch) {
				const workspaceId = workspaceApiMatch[1];
				const remainingPath = workspaceApiMatch[2] || '';

				if (remainingPath.startsWith('/rag')) {
					const authorizedHandler = requireAuth(this.authService, this.handleRagRoutes.bind(this));
					return await authorizedHandler(request, workspaceId, remainingPath);
				}
			}

			return ResponseFormatter.notFound('Route not found');
		} catch (e) {
			console.error('Error:', e);
			return ResponseFormatter.serverError();
		}
	}

	private async handleAuthRoutes(request: Request, pathname: string): Promise<Response> {
		if (request.method === 'POST' && pathname === '/auth/signup') {
			return await this.authService.handleSignup(request);
		} else if (request.method === 'POST' && pathname === '/auth/signin') {
			return await this.authService.handleSignin(request);
		}

		return ResponseFormatter.notFound('Auth route not found');
	}

	private async handlePlaygroundApi(request: Request, pathname: string): Promise<Response> {
		const historyMatch = pathname.match(/^\/playground\/chat\/history\/([^/]+)$/);
		if (request.method === 'GET' && historyMatch) {
			const sessionId = historyMatch[1];
			const messages = await this.chatService.getMessageHistory(sessionId);
			return ResponseFormatter.success({ history: messages });
		}
		if (request.method === 'POST' && pathname.startsWith('/playground/chat')) {
			return await this.chatService.chatWithNotes(request, pathname);
		}

		return ResponseFormatter.notFound('Playground route not found');
	}

	private async handleRagRoutes(
		request: Request,
		userData: AuthenticatedUserData,
		workspaceId: string,
		pathname: string
	): Promise<Response> {
		if (pathname === '/rag/add-note') {
			return await this.ragService.addNote(request, userData, workspaceId);
		}

		return ResponseFormatter.notFound('Rag route not found');
	}
}
