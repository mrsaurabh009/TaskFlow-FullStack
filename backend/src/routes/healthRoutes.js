/**
 * Health Check Routes - Server monitoring and status endpoints
 * Provides health checks, metrics, and system information
 */

import { Router } from 'express';
import os from 'os';
import { taskStore } from '../controllers/taskController.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * @route   GET /health
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', (req, res) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            service: 'TaskFlow API'
        };

        res.status(200).json(healthData);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with system metrics
 * @access  Public
 */
router.get('/detailed', (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: {
                process: process.uptime(),
                system: os.uptime()
            },
            version: {
                api: process.env.npm_package_version || '1.0.0',
                node: process.version,
                platform: process.platform,
                arch: process.arch
            },
            environment: process.env.NODE_ENV || 'development',
            service: 'TaskFlow API',
            memory: {
                used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
                rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            system: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
                freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
                loadavg: os.loadavg()
            },
            data: {
                totalTasks: taskStore ? taskStore.getAllTasks().length : 0,
                statistics: taskStore ? taskStore.getStatistics() : null
            }
        };

        res.status(200).json(healthData);
    } catch (error) {
        logger.error('Detailed health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Detailed health check failed'
        });
    }
});

/**
 * @route   GET /health/ready
 * @desc    Readiness probe for container orchestration
 * @access  Public
 */
router.get('/ready', (req, res) => {
    try {
        // Check if critical services are available
        const checks = {
            server: true,
            memory: process.memoryUsage().heapUsed < (1024 * 1024 * 500), // Less than 500MB
            taskStore: taskStore !== null
        };
        
        const allChecksPass = Object.values(checks).every(check => check === true);
        
        if (allChecksPass) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                checks
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                checks
            });
        }
    } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: 'Readiness check failed'
        });
    }
});

/**
 * @route   GET /health/live
 * @desc    Liveness probe for container orchestration
 * @access  Public
 */
router.get('/live', (req, res) => {
    try {
        // Simple liveness check - if we can respond, we're alive
        res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            pid: process.pid,
            uptime: process.uptime()
        });
    } catch (error) {
        logger.error('Liveness check failed:', error);
        res.status(503).json({
            status: 'dead',
            timestamp: new Date().toISOString(),
            error: 'Liveness check failed'
        });
    }
});

/**
 * @route   GET /health/metrics
 * @desc    Prometheus-style metrics endpoint
 * @access  Public
 */
router.get('/metrics', (req, res) => {
    try {
        const memUsage = process.memoryUsage();
        const stats = taskStore ? taskStore.getStatistics() : {};
        
        // Basic Prometheus-style metrics
        const metrics = `
# HELP nodejs_memory_heap_used_bytes Node.js heap memory used
# TYPE nodejs_memory_heap_used_bytes gauge
nodejs_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP nodejs_memory_heap_total_bytes Node.js heap memory total
# TYPE nodejs_memory_heap_total_bytes gauge
nodejs_memory_heap_total_bytes ${memUsage.heapTotal}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}

# HELP taskflow_tasks_total Total number of tasks
# TYPE taskflow_tasks_total gauge
taskflow_tasks_total ${stats.total || 0}

# HELP taskflow_tasks_active Number of active tasks
# TYPE taskflow_tasks_active gauge
taskflow_tasks_active ${stats.active || 0}

# HELP taskflow_tasks_completed Number of completed tasks
# TYPE taskflow_tasks_completed gauge
taskflow_tasks_completed ${stats.completed || 0}

# HELP taskflow_requests_total Total number of requests (placeholder)
# TYPE taskflow_requests_total counter
taskflow_requests_total 0
        `.trim();

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.status(200).send(metrics);
    } catch (error) {
        logger.error('Metrics endpoint failed:', error);
        res.status(503).send('# Metrics collection failed');
    }
});

/**
 * @route   GET /health/version
 * @desc    Version information endpoint
 * @access  Public
 */
router.get('/version', (req, res) => {
    try {
        const versionInfo = {
            api: {
                name: 'TaskFlow API',
                version: process.env.npm_package_version || '1.0.0',
                description: 'RESTful backend service for task management'
            },
            runtime: {
                node: process.version,
                platform: process.platform,
                arch: process.arch
            },
            build: {
                timestamp: serverStartTime,
                environment: process.env.NODE_ENV || 'development'
            },
            dependencies: {
                express: process.env.npm_package_dependencies_express || 'unknown',
                cors: process.env.npm_package_dependencies_cors || 'unknown'
            }
        };

        res.status(200).json(versionInfo);
    } catch (error) {
        logger.error('Version endpoint failed:', error);
        res.status(503).json({
            error: 'Version information unavailable'
        });
    }
});

export default router;
