/**
 * TaskFlow API Test Suite - Comprehensive testing for all endpoints
 * Tests all CRUD operations, validation, error handling, and middleware
 */

import request from 'supertest';
import app from '../server.js';

// Test data
const validTask = {
    title: 'Test Task',
    description: 'This is a test task',
    status: 'pending',
    priority: 'medium',
    dueDate: '2024-12-31T23:59:59.999Z',
    tags: ['test', 'sample'],
    assignee: 'John Doe'
};

const invalidTask = {
    title: '', // Invalid: empty title
    status: 'invalid-status', // Invalid status
    priority: 'super-urgent', // Invalid priority
    dueDate: 'not-a-date', // Invalid date
    tags: 'should-be-array' // Invalid tags format
};

describe('TaskFlow API Test Suite', () => {
    let createdTaskId;

    // Health Check Endpoints
    describe('Health Check Endpoints', () => {
        test('GET /health - Basic health check', async () => {
            const response = await request(app)
                .get('/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('environment');
            expect(response.body).toHaveProperty('service', 'TaskFlow API');
        });

        test('GET /health/detailed - Detailed health check', async () => {
            const response = await request(app)
                .get('/health/detailed')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('cpu');
            expect(response.body).toHaveProperty('system');
            expect(response.body).toHaveProperty('data');
        });

        test('GET /health/ready - Readiness probe', async () => {
            const response = await request(app)
                .get('/health/ready')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'ready');
            expect(response.body).toHaveProperty('checks');
            expect(response.body.checks).toHaveProperty('server', true);
            expect(response.body.checks).toHaveProperty('memory');
            expect(response.body.checks).toHaveProperty('taskStore');
        });

        test('GET /health/live - Liveness probe', async () => {
            const response = await request(app)
                .get('/health/live')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('status', 'alive');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('pid');
            expect(response.body).toHaveProperty('uptime');
        });

        test('GET /health/version - Version information', async () => {
            const response = await request(app)
                .get('/health/version')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('api');
            expect(response.body).toHaveProperty('runtime');
            expect(response.body).toHaveProperty('build');
            expect(response.body.api).toHaveProperty('name', 'TaskFlow API');
        });

        test('GET /health/metrics - Prometheus metrics', async () => {
            const response = await request(app)
                .get('/health/metrics')
                .expect('Content-Type', /text/)
                .expect(200);

            expect(response.text).toContain('# HELP nodejs_memory_heap_used_bytes');
            expect(response.text).toContain('# TYPE nodejs_memory_heap_used_bytes gauge');
            expect(response.text).toContain('taskflow_tasks_total');
        });
    });

    // API Root Endpoints
    describe('API Root Endpoints', () => {
        test('GET / - Root endpoint', async () => {
            const response = await request(app)
                .get('/')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('api');
            expect(response.body).toHaveProperty('health');
        });

        test('GET /api/v1 - API version root', async () => {
            const response = await request(app)
                .get('/api/v1')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('endpoints');
            expect(response.body).toHaveProperty('environment');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    // Task CRUD Operations
    describe('Task CRUD Operations', () => {
        describe('POST /api/v1/tasks - Create Task', () => {
            test('Should create a new task with valid data', async () => {
                const response = await request(app)
                    .post('/api/v1/tasks')
                    .send(validTask)
                    .expect('Content-Type', /json/)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message', 'Task created successfully');
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('id');
                expect(response.body.data).toHaveProperty('title', validTask.title);
                expect(response.body.data).toHaveProperty('description', validTask.description);
                expect(response.body.data).toHaveProperty('status', validTask.status);
                expect(response.body.data).toHaveProperty('priority', validTask.priority);
                expect(response.body.data).toHaveProperty('createdAt');
                expect(response.body.data).toHaveProperty('updatedAt');

                createdTaskId = response.body.data.id;
            });

            test('Should reject task with invalid data', async () => {
                const response = await request(app)
                    .post('/api/v1/tasks')
                    .send(invalidTask)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
                expect(Array.isArray(response.body.errors)).toBe(true);
                expect(response.body.errors.length).toBeGreaterThan(0);
            });

            test('Should reject task with missing title', async () => {
                const taskWithoutTitle = { ...validTask };
                delete taskWithoutTitle.title;

                const response = await request(app)
                    .post('/api/v1/tasks')
                    .send(taskWithoutTitle)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
            });

            test('Should handle empty request body', async () => {
                const response = await request(app)
                    .post('/api/v1/tasks')
                    .send({})
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
            });
        });

        describe('GET /api/v1/tasks - Get All Tasks', () => {
            test('Should get all tasks with default pagination', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body).toHaveProperty('pagination');
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.pagination).toHaveProperty('page');
                expect(response.body.pagination).toHaveProperty('limit');
                expect(response.body.pagination).toHaveProperty('total');
                expect(response.body.pagination).toHaveProperty('totalPages');
            });

            test('Should support pagination parameters', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks?page=1&limit=5')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body.pagination.page).toBe(1);
                expect(response.body.pagination.limit).toBe(5);
            });

            test('Should support status filtering', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks?status=pending')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                // All returned tasks should have status 'pending'
                response.body.data.forEach(task => {
                    expect(task.status).toBe('pending');
                });
            });

            test('Should support priority filtering', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks?priority=medium')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
            });

            test('Should support sorting', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks?sortBy=title&sortOrder=asc')
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
            });

            test('Should reject invalid query parameters', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks?status=invalid-status')
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
            });
        });

        describe('GET /api/v1/tasks/:id - Get Single Task', () => {
            test('Should get a task by valid ID', async () => {
                const response = await request(app)
                    .get(`/api/v1/tasks/${createdTaskId}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('id', createdTaskId);
                expect(response.body.data).toHaveProperty('title', validTask.title);
            });

            test('Should return 404 for non-existent task', async () => {
                const response = await request(app)
                    .get('/api/v1/tasks/non-existent-id')
                    .expect('Content-Type', /json/)
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('message', 'Task not found');
            });
        });

        describe('PUT /api/v1/tasks/:id - Update Task', () => {
            test('Should update a task with valid data', async () => {
                const updateData = {
                    title: 'Updated Task Title',
                    description: 'Updated description',
                    status: 'in-progress',
                    priority: 'high'
                };

                const response = await request(app)
                    .put(`/api/v1/tasks/${createdTaskId}`)
                    .send(updateData)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message', 'Task updated successfully');
                expect(response.body.data).toHaveProperty('id', createdTaskId);
                expect(response.body.data).toHaveProperty('title', updateData.title);
                expect(response.body.data).toHaveProperty('status', updateData.status);
                expect(response.body.data).toHaveProperty('priority', updateData.priority);
            });

            test('Should reject update with invalid data', async () => {
                const invalidUpdateData = {
                    status: 'invalid-status',
                    priority: 'super-urgent'
                };

                const response = await request(app)
                    .put(`/api/v1/tasks/${createdTaskId}`)
                    .send(invalidUpdateData)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
            });

            test('Should return 404 for non-existent task update', async () => {
                const updateData = { title: 'Updated Title' };

                const response = await request(app)
                    .put('/api/v1/tasks/non-existent-id')
                    .send(updateData)
                    .expect('Content-Type', /json/)
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('message', 'Task not found');
            });
        });

        describe('PATCH /api/v1/tasks/:id - Partial Update Task', () => {
            test('Should partially update a task', async () => {
                const patchData = {
                    status: 'completed'
                };

                const response = await request(app)
                    .patch(`/api/v1/tasks/${createdTaskId}`)
                    .send(patchData)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message', 'Task updated successfully');
                expect(response.body.data).toHaveProperty('status', 'completed');
                expect(response.body.data).toHaveProperty('id', createdTaskId);
            });

            test('Should reject partial update with invalid data', async () => {
                const invalidPatchData = {
                    priority: 'invalid-priority'
                };

                const response = await request(app)
                    .patch(`/api/v1/tasks/${createdTaskId}`)
                    .send(invalidPatchData)
                    .expect('Content-Type', /json/)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
            });
        });

        describe('DELETE /api/v1/tasks/:id - Delete Task', () => {
            test('Should delete an existing task', async () => {
                const response = await request(app)
                    .delete(`/api/v1/tasks/${createdTaskId}`)
                    .expect('Content-Type', /json/)
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message', 'Task deleted successfully');
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('id', createdTaskId);
            });

            test('Should return 404 for non-existent task deletion', async () => {
                const response = await request(app)
                    .delete('/api/v1/tasks/non-existent-id')
                    .expect('Content-Type', /json/)
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('message', 'Task not found');
            });

            test('Should confirm task is deleted', async () => {
                const response = await request(app)
                    .get(`/api/v1/tasks/${createdTaskId}`)
                    .expect('Content-Type', /json/)
                    .expect(404);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('message', 'Task not found');
            });
        });
    });

    // Statistics Endpoint
    describe('GET /api/v1/tasks/stats - Task Statistics', () => {
        beforeAll(async () => {
            // Create some test tasks for statistics
            const testTasks = [
                { title: 'Stats Test 1', status: 'pending', priority: 'low' },
                { title: 'Stats Test 2', status: 'completed', priority: 'high' },
                { title: 'Stats Test 3', status: 'in-progress', priority: 'medium' }
            ];

            for (const task of testTasks) {
                await request(app)
                    .post('/api/v1/tasks')
                    .send(task);
            }
        });

        test('Should get task statistics', async () => {
            const response = await request(app)
                .get('/api/v1/tasks/stats')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('total');
            expect(response.body.data).toHaveProperty('byStatus');
            expect(response.body.data).toHaveProperty('byPriority');
            expect(response.body.data).toHaveProperty('completed');
            expect(response.body.data).toHaveProperty('active');
            expect(response.body.data).toHaveProperty('completionRate');
        });
    });

    // Error Handling
    describe('Error Handling', () => {
        test('Should handle 404 for unknown routes', async () => {
            const response = await request(app)
                .get('/api/v1/unknown-endpoint')
                .expect('Content-Type', /json/)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('error', 'Not Found');
        });

        test('Should handle invalid JSON in request body', async () => {
            const response = await request(app)
                .post('/api/v1/tasks')
                .set('Content-Type', 'application/json')
                .send('{ invalid json }')
                .expect('Content-Type', /json/)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
        });

        test('Should handle unsupported HTTP methods', async () => {
            const response = await request(app)
                .patch('/api/v1/tasks')  // PATCH on collection endpoint
                .expect('Content-Type', /json/)
                .expect(405);

            expect(response.body).toHaveProperty('success', false);
        });
    });

    // Security Headers
    describe('Security Headers', () => {
        test('Should include security headers', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            // Check for common security headers
            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers).toHaveProperty('x-xss-protection');
        });

        test('Should include CORS headers', async () => {
            const response = await request(app)
                .options('/api/v1/tasks')
                .expect(204);

            expect(response.headers).toHaveProperty('access-control-allow-origin');
            expect(response.headers).toHaveProperty('access-control-allow-methods');
            expect(response.headers).toHaveProperty('access-control-allow-headers');
        });
    });

    // Rate Limiting
    describe('Rate Limiting', () => {
        test('Should include rate limit headers', async () => {
            const response = await request(app)
                .get('/api/v1/tasks')
                .expect(200);

            expect(response.headers).toHaveProperty('x-ratelimit-limit');
            expect(response.headers).toHaveProperty('x-ratelimit-remaining');
            expect(response.headers).toHaveProperty('x-ratelimit-reset');
        });
    });
});

// Performance Tests
describe('Performance Tests', () => {
    test('Should handle concurrent requests', async () => {
        const concurrentRequests = 10;
        const promises = [];

        for (let i = 0; i < concurrentRequests; i++) {
            promises.push(
                request(app)
                    .get('/health')
                    .expect(200)
            );
        }

        const results = await Promise.all(promises);
        expect(results).toHaveLength(concurrentRequests);
        results.forEach(result => {
            expect(result.status).toBe(200);
        });
    });

    test('Should respond within reasonable time', async () => {
        const startTime = Date.now();
        
        await request(app)
            .get('/api/v1/tasks')
            .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
});

// Cleanup
afterAll(async () => {
    // Clean up any remaining test data
    // This would typically involve database cleanup
    // For in-memory storage, this happens automatically
});
