import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest, CreateEntryData, UpdateEntryData } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Create entry
router.post('/entries', authenticateToken, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('synopsis').trim().notEmpty().withMessage('Synopsis is required'),
  body('content').trim().notEmpty().withMessage('Content is required')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { title, synopsis, content }: CreateEntryData = req.body;
    const userId = req.user!.id;

    const entry = await prisma.entry.create({
      data: {
        title,
        synopsis,
        content,
        userId
      }
    });

    res.status(201).json({
      message: 'Entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ message: 'Failed to create entry' });
  }
});

// Get all user entries - this gets the active only
router.get('/entries', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const entries = await prisma.entry.findMany({
      where: {
        userId,
        isDeleted: false
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });

    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ message: 'Failed to get entries' });
  }
});

router.get('/notes', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const entries = await prisma.entry.findMany({
      where: {
        userId,
        isDeleted: false
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });

    res.json({ entries });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ message: 'Failed to get notes' });
  }
});

// Get deleted entries (trash)
router.get('/entries/trash', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const deletedEntries = await prisma.entry.findMany({
      where: {
        userId,
        isDeleted: true
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });

    res.json({ entries: deletedEntries });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ message: 'Failed to get deleted entries' });
  }
});

// Get specific entry
router.get('/entry/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const entry = await prisma.entry.findFirst({
      where: {
        id,
        userId,
        isDeleted: false
      }
    });

    if (!entry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ message: 'Failed to get entry' });
  }
});

// Update entry
router.patch('/entry/:id', authenticateToken, [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('synopsis').optional().trim().notEmpty().withMessage('Synopsis cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Content cannot be empty')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const { title, synopsis, content }: UpdateEntryData = req.body;
    const userId = req.user!.id;

    // this checks if entry exists and belongs to user
    const existingEntry = await prisma.entry.findFirst({
      where: {
        id,
        userId,
        isDeleted: false
      }
    });

    if (!existingEntry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    // Update entry
    const updateData: any = {};
    if (title) updateData.title = title;
    if (synopsis) updateData.synopsis = synopsis;
    if (content) updateData.content = content;

    const updatedEntry = await prisma.entry.update({
      where: { id },
      data: updateData
    });

    res.json({
      message: 'Entry updated successfully',
      entry: updatedEntry
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ message: 'Failed to update entry' });
  }
});

// Restore deleted entry
router.patch('/entry/restore/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    //this checks if entry exists, belongs to user, and is deleted
    const existingEntry = await prisma.entry.findFirst({
      where: {
        id,
        userId,
        isDeleted: true
      }
    });

    if (!existingEntry) {
      res.status(404).json({ message: 'Deleted entry not found' });
      return;
    }

    // Restore entry
    const restoredEntry = await prisma.entry.update({
      where: { id },
      data: { isDeleted: false }
    });

    res.json({
      message: 'Entry restored successfully',
      entry: restoredEntry
    });
  } catch (error) {
    console.error('Restore entry error:', error);
    res.status(500).json({ message: 'Failed to restore entry' });
  }
});

// Soft delete entry
router.delete('/entry/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if entry exists and belongs to user
    const existingEntry = await prisma.entry.findFirst({
      where: {
        id,
        userId,
        isDeleted: false
      }
    });

    if (!existingEntry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }

    // Soft delete entry
    await prisma.entry.update({
      where: { id },
      data: { isDeleted: true }
    });

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ message: 'Failed to delete entry' });
  }
});

export default router;