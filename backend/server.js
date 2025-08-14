/**
 * TaskFlow API - Main Server Entry Point
 * RESTful backend service for task management with comprehensive middleware pipeline
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Import custom middleware and routes
import { securityHeaders, errorHandler, notFoundHandler, requestLogger } from './src/middleware/index.js';
import taskRoutes from './src/routes/taskRoutes.js';
import healthRoutes from './src/routes/healthRoutes.js';
import { validateEnvironment } from './src/utils/validators.js';
import { logger } from './src/utils/logger.js';

// Load environment variables
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate environment configuration
validateEnvironment();

// Initialize Express app
const app = express();

// Server configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_PREFIX = process.env.API_PREFIX || '/api';
const API_VERSION = process.env.API_VERSION || 'v1';

// Trust proxy for production deployment
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// ===== SECURITY MIDDLEWARE =====

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: process.env.HELMET_CONTENT_SECURITY_POLICY === 'true' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    } : false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks and successful requests in development
        if (req.path === '/health' || req.path === `${API_PREFIX}/health`) {
            return true;
        }
        return process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true' && req.method === 'GET';
    }
});

app.use(`${API_PREFIX}/`, limiter);

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Per-Page']
};

app.use(cors(corsOptions));

// ===== UTILITY MIDDLEWARE =====

// Compression middleware
app.use(compression({
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024,
    level: 6,
    memLevel: 6,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Body parsing middleware
app.use(express.json({ 
    limit: '10mb',
    strict: true,
    type: ['application/json', 'application/*+json']
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 50
}));

// Request logging
const logFormat = process.env.LOG_LEVEL || 'combined';
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Create logs directory if it doesn't exist
    const logsDir = join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const accessLogStream = fs.createWriteStream(
        join(__dirname, process.env.LOG_FILE || 'logs/access.log'),
        { flags: 'a' }
    );
    app.use(morgan(logFormat, { stream: accessLogStream }));
}

// Custom request logger middleware
app.use(requestLogger);

// Custom security headers
app.use(securityHeaders);

// ===== ROUTES =====

// Health check endpoint (before API prefix)
app.use('/health', healthRoutes);

// API routes with versioning
app.use(`${API_PREFIX}/${API_VERSION}/tasks`, taskRoutes);

// API root endpoint
app.get(`${API_PREFIX}/${API_VERSION}`, (req, res) => {
    res.json({
        message: 'TaskFlow API v1.0.0',
        version: API_VERSION,
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            tasks: `${API_PREFIX}/${API_VERSION}/tasks`,
            docs: process.env.SWAGGER_ENABLED === 'true' ? `${API_PREFIX}/docs` : null
        },
        environment: NODE_ENV,
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'TaskFlow API - RESTful backend service for task management',
        version: '1.0.0',
        api: `${req.protocol}://${req.get('host')}${API_PREFIX}/${API_VERSION}`,
        health: `${req.protocol}://${req.get('host')}/health`,
        documentation: process.env.SWAGGER_ENABLED === 'true' ? 
            `${req.protocol}://${req.get('host')}${API_PREFIX}/docs` : 
            'Documentation not enabled'
    });
});

// ===== ERROR HANDLING =====

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===== SERVER STARTUP =====

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
        if (err) {
            logger.error('Error during server shutdown:', err);
            process.exit(1);
        }
        
        logger.info('Server shut down gracefully');
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Start server
const server = app.listen(PORT, HOST, () => {
    logger.info(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                              TaskFlow API                                    ║
║                                                                              ║
║  🚀 Server running on: http://${HOST}:${PORT}                                    ║
║  🌍 Environment: ${NODE_ENV.toUpperCase().padEnd(10)}                                              ║
║  📡 API Endpoint: http://${HOST}:${PORT}${API_PREFIX}/${API_VERSION}                             ║
║  🏥 Health Check: http://${HOST}:${PORT}/health                              ║
║  📊 Process ID: ${process.pid}                                                ║
║  ⏰ Started at: ${new Date().toISOString()}                               ║
║                                                                              ║
║  Ready to handle task management operations! 📝                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
    
    if (NODE_ENV === 'development') {
        logger.info('Development mode: Detailed error messages enabled');
        logger.info('CORS: Development origins allowed');
        logger.info('Rate limiting: Relaxed for development');
    }
});

// Handle server errors
server.on('error', (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

    switch (error.code) {
        case 'EACCES':
            logger.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
});

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

export default app;
