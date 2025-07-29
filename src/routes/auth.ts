import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest, RegisterData, LoginData, UpdatePasswordData } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Registering a user
router.post('/register', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req: express.Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { firstName, lastName, username, email, password }: RegisterData = req.body;

    // Checking if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      res.status(400).json({ 
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken' 
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: hashedPassword
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        email: true,
        dateJoined: true
      }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

// Login user
router.post('/login', [
  body('emailOrUsername').trim().notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: express.Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { emailOrUsername, password }: LoginData = req.body;

    // Finding user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername.toLowerCase() }
        ],
        isDeleted: false
      }
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Generating JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ message: 'JWT secret not configured' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id },
      jwtSecret
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to login' });
  }
});

// Updating password
router.post('/password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return value;
  })
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { currentPassword, newPassword }: UpdatePasswordData = req.body;
    const userId = req.user!.id;

    // Getting a user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    // Hashing new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        lastProfileUpdate: new Date()
      }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// Logout - removal of the token 
router.post('/logout', (req: express.Request, res: Response): void => {
  res.json({ message: 'Logout successful' });
});

export default router;