import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import swapRoutes from './routes/swap';
import bridgeRoutes from './routes/bridge';
import tokenRoutes from './routes/token';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.server.corsOrigin }));
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      swap: 'available',
      bridge: 'available',
      token: 'available',
    },
  });
});

app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    name: 'Circle Swap Bridge Token Backend',
    version: '1.0.0',
    description: 'Backend API for Circle Web3 swap, bridge, and token operations',
    endpoints: {
      swap: '/api/v1/swap',
      bridge: '/api/v1/bridge',
      token: '/api/v1/token',
    },
    documentation: 'https://developers.circle.com',
  });
});

app.use('/api/v1/swap', swapRoutes);
app.use('/api/v1/bridge', bridgeRoutes);
app.use('/api/v1/token', tokenRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`);
  console.error(err.stack);
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.server.nodeEnv === 'development' ? err.message : 'Internal server error',
    },
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

const server = app.listen(config.server.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Circle Swap Bridge Token Backend                         ║
║  Running on http://localhost:${config.server.port}                    ║
║  Environment: ${config.server.nodeEnv}                                     ║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║  • POST /api/v1/swap/estimate     - Estimate swap output  ║
║  • POST /api/v1/swap/execute      - Execute swap          ║
║  • POST /api/v1/bridge/execute    - Execute bridge        ║
║  • POST /api/v1/bridge/retry      - Retry failed bridge   ║
║  • POST /api/v1/token/erc20/deploy - Deploy ERC-20        ║
║  • POST /api/v1/token/template/deploy - Deploy template   ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;