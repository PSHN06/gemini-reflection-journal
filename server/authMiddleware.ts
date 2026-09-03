import { Request, Response, NextFunction } from 'express';
import { getAdminAuth } from './firebaseAdmin';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Express middleware to enforce Firebase ID Token authentication.
 * Derives the authenticated UID strictly from the verified cryptographically-signed token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'Authentication required. Missing Authorization header.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Malformed Authorization header. Format must be Bearer <token>.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({
      error: 'Empty authentication token provided.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken || !decodedToken.uid) {
      res.status(401).json({
        error: 'Invalid authentication token: missing user identifier.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Attach verified user identity to request in a type-safe manner
    (req as AuthenticatedRequest).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };

    next();
  } catch (error: any) {
    // Zero exposure of internal credentials or detailed token decoding errors
    console.warn('[Auth Middleware] Token verification failed:', error?.code || 'AUTH_REJECTED');
    res.status(401).json({
      error: 'Invalid, expired, or unverified authentication token.',
      code: 'UNAUTHORIZED',
    });
  }
}
