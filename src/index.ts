import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Loads .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined in environment variables');
  process.exit(1);
}
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import entryRoutes from './routes/entries';
import aiRoutes from './routes/ai';
import analyticsRoutes from './routes/analytics';
import collaborationRoutes from './routes/collaboration';

const app = express();
const PORT = process.env.PORT || 5000;

// Sets secure HTTP headers
app.use(helmet());

// Rate limiting - prevents bruteforce
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [ 'https://notely-fullstack-application-fronte.vercel.app/' ] 
    : 'http://localhost:5173',    
    // 'http://localhost:5173',
    // 'http://127.0.0.1:5173',
    // 'https://notely-fullstack-application-fronte.vercel.app/',
    // process.env.FRONTEND_URL || 'http://localhost:5173'
  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api', entryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/collaboration', collaborationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Notely API is running!', timestamp: new Date().toISOString() });
});

app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// For error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});