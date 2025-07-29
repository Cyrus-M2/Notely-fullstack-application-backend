interface CaptchaData {
  id: string;
  text: string;
  image: string; 
  expiresAt: Date;
}

// In-memory storage for captchas (in production, use Redis or database)
const captchaStore = new Map<string, CaptchaData>();

// Clean expired captchas every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [id, data] of captchaStore.entries()) {
    if (data.expiresAt < now) {
      captchaStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

export function generateCaptcha(): { id: string; image: string } {
  const id = Math.random().toString(36).substring(2, 15);
  const text = generateRandomText(5);
  const image = createSimpleCaptchaImage(text);
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minutes expiry
  
  captchaStore.set(id, {
    id,
    text,
    image,
    expiresAt
  });
  
  return { id, image };
}

export function verifyCaptcha(id: string, userInput: string): boolean {
  const captchaData = captchaStore.get(id);
  
  console.log('Verifying captcha:', { id, userInput, found: !!captchaData });
  
  if (!captchaData) {
    console.log('Captcha not found or expired');
    return false; // Captcha not found or expired
  }
  
  if (captchaData.expiresAt < new Date()) {
    captchaStore.delete(id);
    console.log('Captcha expired');
    return false;
  }
  
  const isValid = captchaData.text.toLowerCase() === userInput.toLowerCase();
  
  console.log('Captcha validation:', { 
    expected: captchaData.text, 
    received: userInput, 
    isValid 
  });
  
  if (isValid) {
    captchaStore.delete(id);
  }
  
  return isValid;
}

function generateRandomText(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createSimpleCaptchaImage(text: string): string {
  // Create a simple SVG-based captcha that works without canvas
  const width = 150;
  const height = 50;
  
  // Generate random colors and positions for each character
  const chars = text.split('').map((char, i) => {
    const x = 20 + (i * 25);
    const y = 30 + (Math.random() - 0.5) * 10;
    const rotation = (Math.random() - 0.5) * 20;
    const color = `rgb(${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100)})`;
    
    return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial" font-size="24" font-weight="bold" transform="rotate(${rotation} ${x} ${y})">${char}</text>`;
  }).join('');
  
  // Add some noise lines
  const noiseLines = Array.from({ length: 5 }, () => {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    const color = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
    
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`;
  }).join('');
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      ${noiseLines}
      ${chars}
    </svg>
  `;
  
  // Convert SVG to base64 data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}