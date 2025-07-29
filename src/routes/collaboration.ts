import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/my-shared-entries', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const mySharedEntries = await prisma.entry.findMany({
      where: {
        userId,
        isDeleted: false,
        sharedEntries: {
          some: {}
        }
      },
      include: {
        sharedEntries: {
          include: {
            sharedWith: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: { lastUpdated: 'desc' }
    });

    res.json({ entries: mySharedEntries });
  } catch (error) {
    console.error('Get my shared entries error:', error);
    res.status(500).json({ message: 'Failed to get shared entries' });
  }
});

// Sharing a note with another user/person
router.post('/share', authenticateToken, [
  body('entryId').isUUID().withMessage('Valid entry ID is required'),
  body('shareWithEmail').isEmail().withMessage('Valid email is required'),
  body('permission').isIn(['read', 'edit']).withMessage('Permission must be read or edit')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { entryId, shareWithEmail, permission } = req.body;
    const userId = req.user!.id;

    // Preventing sahring notes with myself
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    if (currentUser?.email === shareWithEmail.toLowerCase()) {
      res.status(400).json({ message: 'Cannot share note with yourself' });
      return;
    }

    const entry = await prisma.entry.findFirst({
      where: { id: entryId, userId, isDeleted: false }
    });

    if (!entry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    // Finding a user to share notes with
    const shareWithUser = await prisma.user.findUnique({
      where: { email: shareWithEmail.toLowerCase() }
    });

    if (!shareWithUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const existingShare = await prisma.sharedEntry.findFirst({
      where: {
        entryId,
        sharedWithId: shareWithUser.id
      }
    });

    if (existingShare) {
      // Updating existing notes share
      const updatedShare = await prisma.sharedEntry.update({
        where: { id: existingShare.id },
        data: { permission },
        include: {
          sharedWith: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
      
      res.json({
        message: 'Share updated successfully',
        share: updatedShare
      });
      return;
    }

    // Creating a new notes share
    const share = await prisma.sharedEntry.create({
      data: {
        entryId,
        sharedById: userId,
        sharedWithId: shareWithUser.id,
        permission
      },
      include: {
        sharedWith: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Entry shared successfully',
      share
    });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ message: 'Failed to share entry' });
  }
});

// Getting sharing details for a specific entry
router.get('/entry/:entryId/shares', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { entryId } = req.params;
    const userId = req.user!.id;

    const entry = await prisma.entry.findFirst({
      where: { id: entryId, userId, isDeleted: false }
    });

    if (!entry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    const shares = await prisma.sharedEntry.findMany({
      where: { entryId },
      include: {
        sharedWith: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: { sharedAt: 'desc' }
    });

    res.json({ shares });
  } catch (error) {
    console.error('Get entry shares error:', error);
    res.status(500).json({ message: 'Failed to get entry shares' });
  }
});

// Getting shared entries
router.get('/shared-with-me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const sharedEntries = await prisma.sharedEntry.findMany({
      where: { 
        sharedWithId: userId,
        entry: { isDeleted: false } 
      },
      include: {
        entry: {
          include: { 
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatar: true
              },
            },
          },
        },
        sharedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: { sharedAt: 'desc' }
    });

    const validSharedEntries = sharedEntries.filter(share => share.entryId !== null);

    res.json({ sharedEntries: validSharedEntries });
  } catch (error) {
    console.error('Get shared entries error:', error);
    res.status(500).json({ message: 'Failed to get shared entries' });
  }
});

router.delete('/share/:shareId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { shareId } = req.params;
    const userId = req.user!.id;

    const share = await prisma.sharedEntry.findFirst({
      where: {
        id: shareId,
        sharedById: userId
      }
    });

    if (!share) {
      res.status(404).json({ message: 'Share not found' });
      return;
    }

    await prisma.sharedEntry.delete({
      where: { id: shareId }
    });

    res.json({ message: 'Share removed successfully' });
  } catch (error) {
    console.error('Remove share error:', error);
    res.status(500).json({ message: 'Failed to remove share' });
  }
});

export default router;