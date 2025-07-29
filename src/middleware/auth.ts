import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'Access token required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ message: 'JWT secret not configured' });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isDeleted: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
        dateJoined: true
      }
    });

    if (!user) {
      res.status(401).json({ message: 'User not found or account deactivated' });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(403).json({ message: 'Invalid token' });
      return;
    }
    if (error.name === 'TokenExpiredError') {
      res.status(403).json({ message: 'Token expired' });
      return;
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};