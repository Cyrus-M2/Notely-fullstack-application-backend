import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Get user analytics dashboard
router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total notes
    const totalNotes = await prisma.entry.count({
      where: { userId, isDeleted: false }
    });

    // Notes created in last 30 days
    const recentNotes = await prisma.entry.count({
      where: {
        userId,
        isDeleted: false,
        dateCreated: { gte: thirtyDaysAgo }
      }
    });

    // Notes created in last 7 days
    const weeklyNotes = await prisma.entry.count({
      where: {
        userId,
        isDeleted: false,
        dateCreated: { gte: sevenDaysAgo }
      }
    });

    // Average words per note
    const entries = await prisma.entry.findMany({
      where: { userId, isDeleted: false },
      select: { content: true }
    });

    const totalWords = entries.reduce((sum, entry) => {
      return sum + entry.content.split(/\s+/).length;
    }, 0);

    const avgWordsPerNote = entries.length > 0 ? Math.round(totalWords / entries.length) : 0;

    // Most productive day of week
    const entriesByDay = await prisma.entry.findMany({
      where: {
        userId,
        isDeleted: false,
        dateCreated: { gte: thirtyDaysAgo }
      },
      select: { dateCreated: true }
    });

    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    entriesByDay.forEach(entry => {
      const day = entry.dateCreated.getDay();
      dayCount[day]++;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mostProductiveDay = dayNames[dayCount.indexOf(Math.max(...dayCount))];

    // Writing streak
    const writingStreak = await calculateWritingStreak(userId);

    // Monthly activity
    const monthlyActivity = await getMonthlyActivity(userId);

    res.json({
      totalNotes,
      recentNotes,
      weeklyNotes,
      avgWordsPerNote,
      totalWords,
      mostProductiveDay,
      writingStreak,
      monthlyActivity,
      weeklyActivity: dayCount.map((count, index) => ({
        day: dayNames[index],
        count
      }))
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Failed to get analytics' });
  }
});

// Get writing insights
router.get('/insights', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Get all user entries
    const entries = await prisma.entry.findMany({
      where: { userId, isDeleted: false },
      select: {
        title: true,
        content: true,
        dateCreated: true,
        lastUpdated: true
      }
    });

    // Most used words
    const wordFrequency = getMostUsedWords(entries);
    
    // Writing patterns
    const writingPatterns = getWritingPatterns(entries);
    
    // Content insights
    const contentInsights = getContentInsights(entries);

    res.json({
      mostUsedWords: wordFrequency.slice(0, 20),
      writingPatterns,
      contentInsights
    });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ message: 'Failed to get insights' });
  }
});

async function calculateWritingStreak(userId: string): Promise<number> {
  const entries = await prisma.entry.findMany({
    where: { userId, isDeleted: false },
    select: { dateCreated: true },
    orderBy: { dateCreated: 'desc' }
  });

  if (entries.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const entryDates = entries.map(entry => {
    const date = new Date(entry.dateCreated);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  });

  const uniqueDates = [...new Set(entryDates)].sort((a, b) => b - a);

  for (let i = 0; i < uniqueDates.length; i++) {
    const entryDate = uniqueDates[i];
    const expectedDate = currentDate.getTime() - (i * 24 * 60 * 60 * 1000);
    
    if (entryDate === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function getMonthlyActivity(userId: string) {
  const now = new Date();
  const months = [];
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    const count = await prisma.entry.count({
      where: {
        userId,
        isDeleted: false,
        dateCreated: {
          gte: date,
          lt: nextMonth
        }
      }
    });
    
    months.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      count
    });
  }
  
  return months;
}

function getMostUsedWords(entries: any[]): { word: string; count: number }[] {
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'];
  
  const wordCount: { [key: string]: number } = {};
  
  entries.forEach(entry => {
    const words = entry.content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word: string) => word.length > 3 && !commonWords.includes(word));
    
    words.forEach((word: string) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
  });
  
  return Object.entries(wordCount)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

function getWritingPatterns(entries: any[]) {
  const hourCounts = new Array(24).fill(0);
  
  entries.forEach(entry => {
    const hour = new Date(entry.dateCreated).getHours();
    hourCounts[hour]++;
  });
  
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  
  return {
    peakWritingHour: peakHour,
    hourlyDistribution: hourCounts.map((count, hour) => ({
      hour: `${hour}:00`,
      count
    }))
  };
}

function getContentInsights(entries: any[]) {
  const totalEntries = entries.length;
  const totalWords = entries.reduce((sum, entry) => sum + entry.content.split(/\s+/).length, 0);
  const avgWordsPerEntry = totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0;
  
  const shortEntries = entries.filter(entry => entry.content.split(/\s+/).length < 100).length;
  const mediumEntries = entries.filter(entry => {
    const wordCount = entry.content.split(/\s+/).length;
    return wordCount >= 100 && wordCount < 500;
  }).length;
  const longEntries = entries.filter(entry => entry.content.split(/\s+/).length >= 500).length;
  
  return {
    totalWords,
    avgWordsPerEntry,
    entryLengthDistribution: {
      short: shortEntries,
      medium: mediumEntries,
      long: longEntries
    }
  };
}

export default router;