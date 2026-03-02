import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { issueToken } from '../store/tokens.js';
import { createConversation } from '../store/conversations.js';

const router = Router();

router.post('/api/token', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let conversationId: string | undefined = req.body?.conversationId;

    if (!conversationId) {
      conversationId = await createConversation(req.tenant!.id);
    }

    const { token, expiresAt } = await issueToken(req.tenant!.id, conversationId);

    res.json({
      token,
      conversationId,
      expiresAt,
    });
  } catch (err) {
    console.error('[token] error issuing token:', err);
    res.status(500).json({ error: 'Failed to issue token' });
  }
});

export default router;
