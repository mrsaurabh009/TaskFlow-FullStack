/**
 * Task Routes - RESTful API endpoints for task management
 * Implements all CRUD operations with proper HTTP methods and status codes
 */

import { Router } from 'express';
import {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    getTaskStatistics
} from '../controllers/taskController.js';
import { validateTask, validateUpdateTask, validateQueryParams } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// GET /api/v1/tasks - Get all tasks
router.get('/', 
    validateQueryParams,
    asyncHandler(getAllTasks)
);

// GET /api/v1/tasks/stats - Get task statistics  
router.get('/stats', 
    asyncHandler(getTaskStatistics)
);

// GET /api/v1/tasks/:id - Get task by ID
router.get('/:id', 
    asyncHandler(getTaskById)
);

// POST /api/v1/tasks - Create new task
router.post('/', 
    validateTask,
    asyncHandler(createTask)
);

// PUT /api/v1/tasks/:id - Update task
router.put('/:id', 
    validateUpdateTask,
    asyncHandler(updateTask)
);

// PATCH /api/v1/tasks/:id - Partially update task
router.patch('/:id', 
    validateUpdateTask,
    asyncHandler(updateTask)
);

// DELETE /api/v1/tasks/:id - Delete task
router.delete('/:id', 
    asyncHandler(deleteTask)
);

// Export router
export default router;
