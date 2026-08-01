import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { verifyRequestSchema } from './types';
import type { VerifyRequest } from './types';
import * as service from './service';

export const appsRouter = Router();

appsRouter.post('/verify', validate(verifyRequestSchema), async (req, res, next) => {
  try {
    res.json(await service.verifyCredential(req.body as VerifyRequest));
  } catch (err) {
    next(err);
  }
});
