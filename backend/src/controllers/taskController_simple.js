/**
 * Task Controller - Simple version for quick setup
 */

import { logger } from '../utils/logger.js';
import { taskStore } from '../utils/taskService.js';
import { TaskNotFoundError, APIError } from '../utils/errors.js';

/**
 * Get all tasks
 */
export const getAllTasks = async (req, res, next) => {
    try {
        const options = req.validatedQuery || {};
        const result = taskStore.getAllTasks(options);

        res.status(200).json({
            success: true,
            message: 'Tasks retrieved successfully',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get task by ID
 */
export const getTaskById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const task = taskStore.getTaskById(id);

        if (!task) {
            throw new TaskNotFoundError(id);
        }

        res.status(200).json({
            success: true,
            message: 'Task retrieved successfully',
            data: task
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new task
 */
export const createTask = async (req, res, next) => {
    try {
        const taskData = req.validatedData || req.body;
        const newTask = taskStore.createTask(taskData);

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: newTask
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update task
 */
export const updateTask = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.validatedData || req.body;

        const updatedTask = taskStore.updateTask(id, updateData);

        if (!updatedTask) {
            throw new TaskNotFoundError(id);
        }

        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            data: updatedTask
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete task
 */
export const deleteTask = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedTask = taskStore.deleteTask(id);

        if (!deletedTask) {
            throw new TaskNotFoundError(id);
        }

        res.status(200).json({
            success: true,
            message: 'Task deleted successfully',
            data: deletedTask
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get statistics
 */
export const getTaskStatistics = async (req, res, next) => {
    try {
        const stats = taskStore.getStatistics();

        res.status(200).json({
            success: true,
            message: 'Statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

export { taskStore };
