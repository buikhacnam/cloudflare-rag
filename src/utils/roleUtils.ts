// src/utils/roleUtils.ts

import { WorkspaceRole } from '@prisma/client';
import { AuthenticatedUserData } from '../types/auth';

/**
 * Retrieves the user's role for a specific workspace.
 *
 * @param userData The authenticated user data.
 * @param workspaceId The ID of the workspace to check.
 * @returns The user's WorkspaceRole enum value, or undefined if the user is not in the workspace or the role is unknown.
 */
export function getUserRole(userData: AuthenticatedUserData, workspaceId: string): WorkspaceRole | undefined {
	const roleString = userData.workspaces[workspaceId];
	if (!roleString) {
		return undefined; // User not part of this workspace
	}
	// Check if the role string is a valid key in the WorkspaceRole enum
	if (roleString in WorkspaceRole) {
		return roleString as WorkspaceRole;
	}
	console.warn(`Unknown role string '${roleString}' encountered for workspace ${workspaceId}`);
	return undefined; // Unknown role
}

/**
 * Checks if the user is an OWNER in the specified workspace.
 *
 * @param userData The authenticated user data.
 * @param workspaceId The ID of the workspace to check.
 * @returns True if the user is an OWNER, false otherwise.
 */
export function isOwner(userData: AuthenticatedUserData, workspaceId: string): boolean {
	return getUserRole(userData, workspaceId) === WorkspaceRole.OWNER;
}

/**
 * Checks if the user is an ADMIN in the specified workspace.
 *
 * @param userData The authenticated user data.
 * @param workspaceId The ID of the workspace to check.
 * @returns True if the user is an ADMIN, false otherwise.
 */
export function isAdmin(userData: AuthenticatedUserData, workspaceId: string): boolean {
	return getUserRole(userData, workspaceId) === WorkspaceRole.ADMIN;
}

/**
 * Checks if the user is a VIEWER in the specified workspace.
 *
 * @param userData The authenticated user data.
 * @param workspaceId The ID of the workspace to check.
 * @returns True if the user is a VIEWER, false otherwise.
 */
export function isViewer(userData: AuthenticatedUserData, workspaceId: string): boolean {
	return getUserRole(userData, workspaceId) === WorkspaceRole.VIEWER;
}
