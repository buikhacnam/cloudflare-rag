import { AuthService } from '../services/AuthService';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { AuthenticatedUserData } from '../types/auth'; // Import the shared type

// Define the type for a handler that requires authentication AND workspace context
// Added workspaceId to the signature
type AuthenticatedRequestHandler = (request: Request, userData: AuthenticatedUserData, workspaceId: string, pathname: string) => Promise<Response>;

/**
 * Middleware to enforce JWT authentication and workspace membership.
 * Verifies the JWT using the provided AuthService.
 * Checks if the authenticated user belongs to the specified workspace.
 * If valid, calls the handler with authenticated user data and workspaceId.
 * If invalid JWT or user not in workspace, returns an error response (401 or 403).
 *
 * @param authService Instance of AuthService for JWT verification.
 * @param handler The request handler function to call upon successful authentication and workspace validation.
 * @returns An async function that acts as the middleware request handler.
 */
export const requireAuth = (authService: AuthService, handler: AuthenticatedRequestHandler) => {
    // The outer function now accepts workspaceId extracted from the path
    return async (request: Request, workspaceId: string, pathname: string): Promise<Response> => {
        const userData = await authService.verifyJWT(request);
        if (!userData) {
            return ResponseFormatter.unauthorized('Authentication required');
        }

        // Check if the user belongs to the workspace specified in the URL
        if (!userData.workspaces[workspaceId]) {
            console.warn(`User ${userData.userId} attempted to access workspace ${workspaceId} without membership.`);
            // Return 403 Forbidden as the user is authenticated but not authorized for this specific workspace
            return ResponseFormatter.forbidden('Access to this workspace is denied');
        }

        // Call the original handler with the authenticated user data AND workspaceId
        return handler(request, userData, workspaceId, pathname);
    };
}; 