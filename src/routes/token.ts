import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { issueToken } from '../store/tokens.js';
import { createConversation, setInitialContext } from '../store/conversations.js';

const router = Router();

router.post('/api/token', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    let conversationId: string | undefined = req.body?.conversationId;

    if (!conversationId) {
      conversationId = await createConversation(req.tenant!.id);
    }

    // Store initial context / chat history if provided
    const initialContext: string | undefined = req.body?.initialContext;
    const initialMessages: Array<{ role: 'user' | 'assistant'; content: string }> | undefined =
      req.body?.initialMessages;

    if (initialContext || initialMessages) {
      await setInitialContext(conversationId, {
        context: initialContext,
        messages: initialMessages,
      });
      console.log(
        `[token] initial context set for ${conversationId}: ` +
        `context=${initialContext ? initialContext.length + ' chars' : 'none'}, ` +
        `messages=${initialMessages ? initialMessages.length : 0}`,
      );
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
