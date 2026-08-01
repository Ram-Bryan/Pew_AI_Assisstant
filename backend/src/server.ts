import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler, notFoundHandler } from './shared/middleware/error';
import { logger } from './shared/utils/logger';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, '0.0.0.0', () => {
  logger.info(`Pew backend listening on :${port}`);
});
