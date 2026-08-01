import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './shared/middleware/error';
import { logger } from './shared/utils/logger';
import { appsRouter } from './domains/apps/routes';
import { providersRouter } from './domains/providers/routes';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/apps', appsRouter);
app.use('/api/providers', providersRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, '0.0.0.0', () => {
  logger.info(`Pew backend listening on :${port}`);
});
