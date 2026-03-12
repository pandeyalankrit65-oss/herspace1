import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

// In-memory stores (replace with DB later)
const reports: any[] = [];
const sosEvents: any[] = [];

// Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'starling-safe-server' });
});

// Reports
app.post('/api/reports', (req: Request, res: Response) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  const report = { id: reports.length + 1, createdAt: now, ...body };
  reports.push(report);
  res.status(201).json({ success: true, report });
});

app.get('/api/reports', (_req: Request, res: Response) => {
  res.json({ reports });
});

// SOS
app.post('/api/sos', (req: Request, res: Response) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  const sos = { id: sosEvents.length + 1, createdAt: now, status: 'triggered', ...body };
  sosEvents.push(sos);
  console.log('[SOS] Received SOS event:', sos);
  res.status(201).json({ success: true, sos });
});

app.get('/api/sos', (_req: Request, res: Response) => {
  res.json({ sosEvents });
});

// Chat - simple supportive assistant
type ChatMessage = { role: 'user' | 'assistant'; content: string };
app.post('/api/chat', (req: Request, res: Response) => {
  const messages: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const lastUser = [...messages].reverse().find(m => m.role === 'user');

  const supportive = [
    "Thank you for sharing that with me. Your feelings are valid. Would you like to talk about how this is affecting you right now?",
    "I'm here with you. We can take this one step at a time. Would grounding or gentle support feel better?",
    "That sounds really heavy. You deserve safety and care. Would you like options or just a listening ear?",
    "You are not alone. It's okay to feel what you feel. How can I best support you in this moment?",
    "Let's breathe together. In for 4, hold for 4, out for 6. When you're ready, tell me what feels most important."
  ];

  let reply = supportive[Math.floor(Math.random() * supportive.length)];
  if (lastUser?.content) {
    const text = lastUser.content.toLowerCase();
    if (text.includes('panic') || text.includes('anxiety')) {
      reply = "I'm here. Let's try a short grounding: look around and name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Would you like to try together?";
    } else if (text.includes('unsafe') || text.includes('danger')) {
      reply = "Your safety matters. If you're in immediate danger, please use SOS or local emergency services. I can also help you plan next steps—what feels safest right now?";
    } else if (text.includes('help')) {
      reply = "I can offer supportive listening, grounding, and resources. Would you like coping tools, or to talk through what happened?";
    }
  }

  const assistant: ChatMessage = { role: 'assistant', content: reply };
  res.json({ message: assistant });
});

app.listen(PORT, () => {
  console.log(`Starling Safe server listening on http://localhost:${PORT}`);
});
