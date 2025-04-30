import { PrismaClient, Prisma } from '@prisma/client';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { ResponseFormatter } from '../utils/ResponseFormatter';
import { D1Prisma } from '../utils/D1Prisma';

export class AuthService {
	private env: Env;
	private prisma: PrismaClient;

	constructor(env: Env) {
		this.env = env;
		this.prisma = D1Prisma.initializePrisma(env);
	}

	// Helper to generate JWT
	private async generateJWT(userId: string, workspaces: Record<string, string>, expiresIn: string = '2h'): Promise<string> {
		const alg = 'HS256';
		const secretUint8 = new TextEncoder().encode(this.env.JWT_SECRET);
		const jti = crypto.randomUUID();

		const jwt = await new jose.SignJWT({ userId, workspaces, jti })
			.setProtectedHeader({ alg })
			.setIssuedAt()
			.setExpirationTime(expiresIn)
			.setSubject(userId)
			.setIssuer('cloudflare-d1-app')
			.setAudience('cloudflare-d1-users')
			.setJti(jti)
			.sign(secretUint8);
		return jwt;
	}

	// Helper to generate refresh token
	private async generateRefreshToken(userId: string, workspaces: Record<string, string>): Promise<string> {
		const alg = 'HS256';
		const secretUint8 = new TextEncoder().encode(this.env.JWT_SECRET);
		const jti = crypto.randomUUID();

		const jwt = await new jose.SignJWT({ userId, workspaces, tokenType: 'refresh', jti })
			.setProtectedHeader({ alg })
			.setIssuedAt()
			.setExpirationTime('7d')
			.setSubject(userId)
			.setIssuer('cloudflare-d1-app')
			.setAudience('cloudflare-d1-users')
			.setJti(jti)
			.sign(secretUint8);
		return jwt;
	}



	// Verify JWT
	public async verifyJWT(request: Request): Promise<{ userId: string; workspaces: Record<string, string> } | null> {
		try {
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return null;
			}

			const token = authHeader.split(' ')[1];
			const secretUint8 = new TextEncoder().encode(this.env.JWT_SECRET);

			const { payload } = await jose.jwtVerify(token, secretUint8, {
				issuer: 'cloudflare-d1-app',
				audience: 'cloudflare-d1-users',
			});

			if (!payload.userId || !payload.workspaces || typeof payload.workspaces !== 'object') {
				return null;
			}

			return {
				userId: payload.userId as string,
				workspaces: payload.workspaces as Record<string, string>,
			};
		} catch (error) {
			if (this.env.NODE_ENV === 'development' || this.env.NODE_ENV === 'local') {
				console.error('JWT verification error:', error);
			}
			return null;
		}
	}

	// Me route handler
	public async handleMeRoute(request: Request): Promise<Response> {
		const userData = await this.verifyJWT(request);

		if (!userData) {
			return ResponseFormatter.unauthorized();
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userData.userId },
			select: { email: true },
		});

		if (!user) {
			return ResponseFormatter.error('User not found', 404);
		}

		return ResponseFormatter.success({
			userId: userData.userId,
			workspaces: userData.workspaces,
			details: {
				email: user.email,
			},
		});
	}

	// Signup handler
	public async handleSignup(request: Request): Promise<Response> {
		try {
			const body = await request.json<{ email?: unknown; password?: unknown } | undefined>();

			const email = typeof body?.email === 'string' ? body.email : undefined;
			const password = typeof body?.password === 'string' ? body.password : undefined;

			if (!email || !password) {
				return ResponseFormatter.error('Email and password are required', 400);
			}

			if (typeof password !== 'string' || password.length < 8) {
				return ResponseFormatter.error('Password must be at least 8 characters long', 400);
			}

			// Check if user already exists
			const existingUser = await this.prisma.user.findUnique({ where: { email } });

			if (existingUser) {
				return ResponseFormatter.error('User already exists', 409);
			}

			// Hash password
			const hashedPassword = await bcrypt.hash(password, 10);

			// Generate UUIDs
			const userId = crypto.randomUUID();
			const workspaceId = crypto.randomUUID();
			const workspaceName = email.split('@')[0];
			console.log('Generated IDs:', { userId, workspaceId, workspaceName });

			const statements: D1PreparedStatement[] = [
				this.env.DB.prepare(`INSERT INTO User (id, email, hashed_password, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?)`).bind(
					userId,
					email,
					hashedPassword,
					new Date().toISOString(),
					new Date().toISOString(),
					'ACTIVE'
				),
				this.env.DB.prepare(`INSERT INTO Workspace (id, name, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?)`).bind(
					workspaceId,
					workspaceName,
					new Date().toISOString(),
					new Date().toISOString(),
					'ACTIVE'
				),
				this.env.DB.prepare(`INSERT INTO WorkspaceUser (user_id, workspace_id, role) VALUES (?, ?, ?)`).bind(userId, workspaceId, 'OWNER'),
			];

			try {
				await this.env.DB.batch(statements);
			} catch (dbError) {
				console.error('Database error:', dbError);
				throw dbError;
			}

			// Create workspaces object for JWT
			const workspaces = { [workspaceId]: 'OWNER' };

			// Generate JWT and refresh token
			const token = await this.generateJWT(userId, workspaces);
			const refreshToken = await this.generateRefreshToken(userId, workspaces);

			return ResponseFormatter.success({ token, refreshToken }, 'User created successfully', 201);
		} catch (e: unknown) {
			console.error('Signup Error:', e);
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2002') {
					return ResponseFormatter.error('Email already exists', 409);
				}
			}
			return ResponseFormatter.handleError(e);
		}
	}

	// Signin handler
	public async handleSignin(request: Request): Promise<Response> {
		try {
			const body = await request.json<{ email?: unknown; password?: unknown } | undefined>();
			const email = typeof body?.email === 'string' ? body.email : undefined;
			const password = typeof body?.password === 'string' ? body.password : undefined;

			if (!email || !password) {
				return ResponseFormatter.error('Email and password are required', 400);
			}

			// Find user by email
			const user = await this.prisma.user.findUnique({
				where: { email },
				include: {
					workspaces: {
						select: {
							workspaceId: true,
							role: true,
						},
					},
				},
			});

			if (!user || !user.hashedPassword) {
				return ResponseFormatter.error('Invalid credentials', 401);
			}

			// Verify password
			const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

			if (!passwordMatch) {
				return ResponseFormatter.error('Invalid credentials', 401);
			}

			// Get all workspaces and roles for the user
			if (!user.workspaces.length) {
				return ResponseFormatter.error('No workspaces found for user', 404);
			}

			// Format workspaces for JWT
			const workspaces = user.workspaces.reduce((acc, w) => {
				acc[w.workspaceId] = w.role;
				return acc;
			}, {} as Record<string, string>);

			// Generate JWT and refresh token
			const token = await this.generateJWT(user.id, workspaces);
			const refreshToken = await this.generateRefreshToken(user.id, workspaces);

			return ResponseFormatter.success({ token, refreshToken });
		} catch (e) {
			console.error('Signin Error:', e);
			return ResponseFormatter.handleError(e);
		}
	}

	// Refresh token handler
	public async handleRefreshToken(request: Request): Promise<Response> {
		try {
			const body = await request.json<{ refreshToken?: string } | undefined>();
			const refreshToken = body?.refreshToken;

			if (!refreshToken) {
				return ResponseFormatter.error('Refresh token is required', 400);
			}

			const secretUint8 = new TextEncoder().encode(this.env.JWT_SECRET);

			try {
				const { payload } = await jose.jwtVerify(refreshToken, secretUint8, {
					issuer: 'cloudflare-d1-app',
					audience: 'cloudflare-d1-users',
				});

				if (!payload.userId || payload.tokenType !== 'refresh' || !payload.workspaces || typeof payload.workspaces !== 'object') {
					return ResponseFormatter.error('Invalid refresh token', 401);
				}

				const userId = payload.userId as string;
				const workspaces = payload.workspaces as Record<string, string>;

				// Get user's workspaces from database to ensure they're still valid
				const user = await this.prisma.user.findUnique({
					where: { id: userId },
					include: {
						workspaces: {
							select: {
								workspaceId: true,
								role: true,
							},
						},
					},
				});

				if (!user || !user.workspaces.length) {
					return ResponseFormatter.error('User or workspaces not found', 404);
				}

				// Format workspaces for JWT
				const updatedWorkspaces = user.workspaces.reduce((acc, w) => {
					acc[w.workspaceId] = w.role;
					return acc;
				}, {} as Record<string, string>);

				// Generate new access token
				const newToken = await this.generateJWT(userId, updatedWorkspaces);

				return ResponseFormatter.success({ token: newToken });
			} catch (error) {
				return ResponseFormatter.error('Invalid or expired refresh token', 401);
			}
		} catch (e) {
			return ResponseFormatter.handleError(e);
		}
	}

	// Logout handler
	public async handleLogout(request: Request): Promise<Response> {
		try {
			return ResponseFormatter.success({}, 'Logged out successfully');
		} catch (e) {
			return ResponseFormatter.handleError(e);
		}
	}
}
