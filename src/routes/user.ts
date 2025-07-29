import express, { Response } from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import { AuthenticatedRequest, UpdateUserData } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files are allowed'));
    }
  }
});


// Get user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
        dateJoined: true,
        lastProfileUpdate: true
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get user profile' });
  }
});

// Update user profile
router.patch('/', authenticateToken, [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').optional().isEmail().withMessage('Valid email is required')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { firstName, lastName, username, email }: UpdateUserData = req.body;
    const userId = req.user!.id;

    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                ...(username ? [{ username: username.toLowerCase() }] : []),
                ...(email ? [{ email: email.toLowerCase() }] : [])
              ]
            }
          ]
        }
      });

      if (existingUser) {
        res.status(400).json({ 
          message: existingUser.email === email?.toLowerCase() 
            ? 'Email already taken by another user' 
            : 'Username already taken by another user' 
        });
        return;
      }
    }

    // Update user
    const updateData: any = {
      lastProfileUpdate: new Date()
    };

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (username) updateData.username = username.toLowerCase();
    if (email) updateData.email = email.toLowerCase();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
        dateJoined: true,
        lastProfileUpdate: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Upload profile picture
router.patch('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No image file provided' });
      return;
    }

    const userId = req.user!.id;

    // Get current user to check for existing avatar
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true }
    });

    // Upload new image to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      public_id: `user_${userId}_${Date.now()}`
    });

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        avatar: uploadResult.secure_url,
        lastProfileUpdate: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        avatar: true,
        dateJoined: true,
        lastProfileUpdate: true
      }
    });

    // Delete old avatar from Cloudinary if it exists
    if (currentUser?.avatar) {
      try {
        const publicId = currentUser.avatar.split('/').pop()?.split('.')[0];
        if (publicId) {
          await deleteFromCloudinary(`notely/avatars/${publicId}`);
        }
      } catch (deleteError) {
        console.warn('Failed to delete old avatar:', deleteError);
      }
    }

    res.json({
      message: 'Profile picture updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ message: 'Failed to upload profile picture' });
  }
});

export default router;