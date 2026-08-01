import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { modelListRequestSchema } from './types';
import type { ModelListRequest } from './types';
import * as service from './service';

export const providersRouter = Router();

providersRouter.post('/models', validate(modelListRequestSchema), async (req, res, next) => {
  try {
    const models = await service.listModels(req.body as ModelListRequest);
    res.json({ models });
  } catch (err) {
    next(err);
  }
});
