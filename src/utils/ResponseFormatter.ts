export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export class ResponseFormatter {
	/**
	 * Creates a successful response with data
	 */
	public static success<T>(data: T, message?: string, status = 200): Response {
		const response: ApiResponse<T> = {
			success: true,
			data,
		};

		if (message) {
			response.message = message;
		}

		return new Response(JSON.stringify(response), {
			status,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	/**
	 * Creates an error response
	 */
	public static error(message: string, status = 400): Response {
		const response: ApiResponse = {
			success: false,
			error: message,
		};

		return new Response(JSON.stringify(response), {
			status,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	/**
	 * Creates a not found response
	 */
	public static notFound(message = 'Resource not found'): Response {
		return this.error(message, 404);
	}

	/**
	 * Creates an unauthorized response
	 */
	public static unauthorized(message = 'Unauthorized'): Response {
		return this.error(message, 401);
	}

	/**
	 * Creates a forbidden response
	 */
	public static forbidden(message = 'Forbidden'): Response {
		return this.error(message, 403);
	}

	/**
	 * Creates a server error response
	 */
	public static serverError(message = 'Internal Server Error'): Response {
		return this.error(message, 500);
	}

	public static handleError(error: unknown, status = 500): Response {
		const message = error instanceof Error ? error.message : 'Internal Server Error';
		return ResponseFormatter.error(message, status);
	}
}
