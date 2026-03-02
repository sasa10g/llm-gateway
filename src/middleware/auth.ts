import { Request, Response, NextFunction } from 'express';
import { getTenantByApiKey, ResolvedTenant } from '../tenants/router.js';

declare global {
  namespace Express {
    interface Request {
      tenant?: ResolvedTenant;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing x-api-key header' });
    return;
  }

  const tenant = getTenantByApiKey(apiKey);
  if (!tenant) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.tenant = tenant;
  next();
}
