import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'not_found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : err instanceof ZodError ? 400 : 500;
  const message = err instanceof Error ? err.message : 'internal_error';
  if (status >= 500) logger.error('Unhandled error', err);
  res.status(status).json({ error: message });
}
