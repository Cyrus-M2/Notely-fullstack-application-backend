import express, { Request, Response } from 'express';
import { generateCaptcha, verifyCaptcha } from '../utils/captcha';

const router = express.Router();

// Generating the new captcha
router.get('/generate', (req: Request, res: Response): void => {
  try {
    const captcha = generateCaptcha();
    res.json({
      id: captcha.id,
      image: captcha.image
    });
  } catch (error) {
    console.error('Captcha generation error:', error);
    res.status(500).json({ message: 'Failed to generate captcha' });
  }
});

// Verifying the captcha
router.post('/verify', (req: Request, res: Response): void => {
  try {
    const { id, text } = req.body;
    
    if (!id || !text) {
      res.status(400).json({ message: 'Captcha ID and text are required' });
      return;
    }
    
    const isValid = verifyCaptcha(id, text);
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Captcha verification error:', error);
    res.status(500).json({ message: 'Failed to verify captcha' });
  }
});

export default router;