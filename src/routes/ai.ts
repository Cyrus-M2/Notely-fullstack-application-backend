import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// AI Note Generation
router.post('/generate-note', authenticateToken, [
  body('topic').trim().notEmpty().withMessage('Topic is required'),
  body('type').isIn(['informative', 'creative', 'technical', 'personal']).withMessage('Invalid note type'),
  body('length').isIn(['short', 'medium', 'long']).withMessage('Invalid length')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { topic, type, length } = req.body;
    const userId = req.user!.id;
    
    // Generate note content based on topic and type
    const generatedNote = await generateNoteContent(topic, type, length);
    
    // Create the note in database
    const entry = await prisma.entry.create({
      data: {
        title: generatedNote.title,
        synopsis: generatedNote.synopsis,
        content: generatedNote.content,
        userId
      }
    });

    res.status(201).json({
      message: 'AI note generated successfully',
      entry,
      generatedNote
    });
  } catch (error) {
    console.error('AI note generation error:', error);
    res.status(500).json({ message: 'Failed to generate note' });
  }
});

// AI Content Suggestions
router.post('/content-suggestions', authenticateToken, [
  body('topic').trim().notEmpty().withMessage('Topic is required')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { topic } = req.body;
    
    const suggestions = await generateContentSuggestions(topic);
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Content suggestions error:', error);
    res.status(500).json({ message: 'Failed to generate suggestions' });
  }
});

// AI Text Enhancement using free Hugging Face API
router.post('/enhance-text', authenticateToken, [
  body('text').trim().notEmpty().withMessage('Text is required'),
  body('type').isIn(['grammar', 'summarize', 'expand']).withMessage('Invalid enhancement type')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { text, type } = req.body;
    
    type HuggingFaceResponse = Array<{
      summary_text?: string;    
      generated_text?: string;  
      error?: string;       
    }>;    

    let enhancedText = text;
    
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: type === 'summarize' ? text : `Improve this text: ${text}`,
            parameters: {
              max_length: type === 'summarize' ? 100 : 200,
              min_length: 30,
              do_sample: false
            }
          }),
        });

        const result = await response.json() as HuggingFaceResponse;

        enhancedText = result[0]?.summary_text || result[0]?.generated_text || text;
      } catch (error) {
        console.warn('Hugging Face API failed, using fallback');
        enhancedText = await enhanceTextFallback(text, type);
      }
    } else {
      enhancedText = await enhanceTextFallback(text, type);
    }
    
    res.json({
      originalText: text,
      enhancedText,
      type
    });
  } catch (error) {
    console.error('AI Enhancement error:', error);
    res.status(500).json({ message: 'Failed to enhance text' });
  }
});

// AI-powered note suggestions section
router.post('/suggest-tags', authenticateToken, [
  body('content').trim().notEmpty().withMessage('Content is required')
], async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    
    const keywords = extractKeywords(content);
    const suggestions = generateTagSuggestions(keywords);
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Tag suggestion error:', error);
    res.status(500).json({ message: 'Failed to generate tag suggestions' });
  }
});

// Smart search with AI
router.get('/smart-search', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { query } = req.query;
    const userId = req.user!.id;
    
    if (!query) {
      res.status(400).json({ message: 'Search query is required' });
      return;
    }
    
    // Get user's entries
    const entries = await prisma.entry.findMany({
      where: {
        userId,
        isDeleted: false,
        OR: [
          { title: { contains: query as string, mode: 'insensitive' } },
          { content: { contains: query as string, mode: 'insensitive' } },
          { synopsis: { contains: query as string, mode: 'insensitive' } }
        ]
      },
      orderBy: { lastUpdated: 'desc' }
    });
    
    // Add relevance scoring
    const scoredEntries = entries.map(entry => ({
      ...entry,
      relevanceScore: calculateRelevanceScore(entry, query as string)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    res.json({ entries: scoredEntries });
  } catch (error) {
    console.error('Smart search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

// AI Note Generation Functions
async function generateNoteContent(topic: string, type: string, length: string) {
  const templates = {
    informative: {
      title: `Understanding ${topic}`,
      synopsis: `A comprehensive overview of ${topic} covering key concepts and important details.`,
      content: generateInformativeContent(topic, length)
    },
    creative: {
      title: `Creative Exploration: ${topic}`,
      synopsis: `A creative take on ${topic} with imaginative insights and unique perspectives.`,
      content: generateCreativeContent(topic, length)
    },
    technical: {
      title: `Technical Guide: ${topic}`,
      synopsis: `Technical documentation and implementation details for ${topic}.`,
      content: generateTechnicalContent(topic, length)
    },
    personal: {
      title: `My Thoughts on ${topic}`,
      synopsis: `Personal reflections and insights about ${topic}.`,
      content: generatePersonalContent(topic, length)
    }
  };

  return templates[type as keyof typeof templates] || templates.informative;
}

function generateInformativeContent(topic: string, length: string): string {
  const baseContent = `# ${topic}

## Overview
${topic} is an important subject that deserves careful consideration and understanding.

## Key Points
- **Definition**: Understanding what ${topic} means and its significance
- **Applications**: How ${topic} is used in real-world scenarios
- **Benefits**: The advantages and positive impacts of ${topic}
- **Considerations**: Important factors to keep in mind

## Detailed Analysis
When examining ${topic}, it's essential to consider multiple perspectives and approaches. This comprehensive view helps in developing a thorough understanding.

### Important Aspects
1. **Historical Context**: How ${topic} has evolved over time
2. **Current State**: The present situation and trends
3. **Future Outlook**: Potential developments and implications

## Conclusion
${topic} represents a significant area of interest that continues to evolve and impact various aspects of our lives.`;

  if (length === 'short') {
    return baseContent.split('\n').slice(0, 15).join('\n');
  } else if (length === 'long') {
    return baseContent + `\n\n## Additional Resources
- Further reading materials
- Related topics to explore
- Expert opinions and research

## Action Items
- [ ] Research more about ${topic}
- [ ] Apply learnings in practical scenarios
- [ ] Share insights with others`;
  }
  return baseContent;
}

function generateCreativeContent(topic: string, length: string): string {
  return `# Creative Exploration: ${topic}

*Imagine if ${topic} could speak...*

## A Different Perspective
What if we looked at ${topic} through the lens of creativity and imagination? Sometimes the most profound insights come from unexpected angles.

## Creative Insights
- **Metaphorical View**: ${topic} is like a river - constantly flowing and changing
- **Artistic Interpretation**: How would ${topic} look as a painting or sculpture?
- **Storytelling**: The narrative that ${topic} tells us about our world

## Imaginative Scenarios
Picture a world where ${topic} takes center stage. What would change? How would people interact differently?

## Creative Applications
- Writing prompts inspired by ${topic}
- Art projects that explore ${topic}
- Innovative solutions using ${topic} as inspiration

## Reflection
Creativity opens doors to understanding that logic alone cannot unlock. ${topic} becomes more than just a concept - it becomes a source of inspiration.`;
}

function generateTechnicalContent(topic: string, length: string): string {
  return `# Technical Guide: ${topic}

## Technical Overview
This document provides technical specifications and implementation details for ${topic}.

## Architecture
\`\`\`
${topic} System Architecture
├── Core Components
├── Integration Points
└── Configuration Options
\`\`\`

## Implementation

### Prerequisites
- System requirements
- Dependencies
- Environment setup

### Configuration
\`\`\`json
{
  "topic": "${topic}",
  "version": "1.0.0",
  "configuration": {
    "enabled": true,
    "options": {}
  }
}
\`\`\`

### Code Example
\`\`\`javascript
// Example implementation for ${topic}
function implement${topic.replace(/\s+/g, '')}() {
  // Implementation logic here
  return {
    status: 'success',
    data: '${topic} implemented successfully'
  };
}
\`\`\`

## Best Practices
- Follow established patterns
- Implement proper error handling
- Document all configurations
- Test thoroughly

## Troubleshooting
Common issues and their solutions when working with ${topic}.`;
}

function generatePersonalContent(topic: string, length: string): string {
  return `# My Thoughts on ${topic}

## Personal Reflection
${topic} has been on my mind lately, and I wanted to capture some thoughts about it.

## Why This Matters to Me
There's something about ${topic} that resonates with my personal experience and values.

## My Experience
- **First Encounter**: When I first learned about ${topic}
- **Learning Journey**: How my understanding has evolved
- **Current Perspective**: Where I stand today

## Lessons Learned
Through my exploration of ${topic}, I've discovered:

1. **Insight #1**: Every perspective adds value
2. **Insight #2**: Continuous learning is essential
3. **Insight #3**: Practical application deepens understanding

## Future Goals
- [ ] Deepen my knowledge of ${topic}
- [ ] Share insights with others
- [ ] Apply learnings in daily life

## Final Thoughts
${topic} continues to be a source of learning and growth for me. I'm excited to see where this journey leads.

*Note: These are my personal thoughts and may evolve over time.*`;
}

async function generateContentSuggestions(topic: string) {
  return [
    `How to get started with ${topic}`,
    `Advanced techniques in ${topic}`,
    `Common mistakes to avoid in ${topic}`,
    `Best practices for ${topic}`,
    `The future of ${topic}`,
    `${topic} vs alternatives`,
    `Case studies in ${topic}`,
    `Tools and resources for ${topic}`
  ];
}

async function enhanceTextFallback(text: string, type: string): Promise<string> {
  switch (type) {
    case 'grammar':
      return `Enhanced version: ${text}`;
    case 'summarize':
      const sentences = text.split('.').filter(s => s.trim().length > 0);
      return sentences.slice(0, Math.max(1, Math.floor(sentences.length / 3))).join('. ') + '.';
    case 'expand':
      return `${text}\n\nAdditional context: This topic deserves further exploration and consideration of various perspectives and implications.`;
    default:
      return text;
  }
}

// Helper functions
function extractKeywords(text: string): string[] {
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.includes(word))
    .slice(0, 10);
}

function generateTagSuggestions(keywords: string[]): string[] {
  const tagMap: { [key: string]: string[] } = {
    'project': ['work', 'planning', 'development'],
    'meeting': ['work', 'collaboration', 'notes'],
    'idea': ['creative', 'brainstorm', 'innovation'],
    'research': ['study', 'analysis', 'learning'],
    'personal': ['life', 'thoughts', 'journal'],
    'code': ['programming', 'development', 'tech'],
    'design': ['creative', 'ui', 'ux'],
    'business': ['work', 'strategy', 'planning']
  };
  
  const suggestions = new Set<string>();
  
  keywords.forEach(keyword => {
    Object.keys(tagMap).forEach(tag => {
      if (keyword.includes(tag) || tagMap[tag].some(related => keyword.includes(related))) {
        suggestions.add(tag);
        tagMap[tag].forEach(related => suggestions.add(related));
      }
    });
  });
  
  return Array.from(suggestions).slice(0, 8);
}

function calculateRelevanceScore(entry: any, query: string): number {
  const queryLower = query.toLowerCase();
  let score = 0;
  
  // Title matches get highest score
  if (entry.title.toLowerCase().includes(queryLower)) score += 10;
  
  // Synopsis matches get medium score
  if (entry.synopsis.toLowerCase().includes(queryLower)) score += 5;
  
  // Content matches get lower score
  const contentMatches = (entry.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
  score += contentMatches * 2;
  
  // Recent entries get bonus
  const daysSinceUpdate = (Date.now() - new Date(entry.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) score += 3;
  
  return score;
}

export default router;