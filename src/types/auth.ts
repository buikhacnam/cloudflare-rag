/**
 * Represents the structure of authenticated user data obtained from a verified JWT.
 */
export type AuthenticatedUserData = {
	userId: string;
	/**
	 * A record mapping workspace IDs to the user's role (as a string) in that workspace.
	 * Example: { "workspaceId1": "OWNER", "workspaceId2": "ADMIN" }
	 */
	workspaces: Record<string, string>; // Roles are stored as strings from JWT/DB
};
