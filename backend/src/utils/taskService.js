/**
 * Task Service - Business logic and data management for tasks
 * Provides CRUD operations and task-related functionality
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';

/**
 * In-memory task store
 * In production, this would be replaced with a database
 */
class TaskStore {
    constructor() {
        this.tasks = new Map();
        this.initialized = false;
        this.init();
    }

    /**
     * Initialize the store with sample data
     */
    init() {
        if (this.initialized) return;

        // Add some sample tasks for development
        const sampleTasks = [
            {
                title: 'Setup Project Structure',
                description: 'Create the basic folder structure and configuration files',
                status: 'completed',
                priority: 'high',
                dueDate: '2024-01-15T10:00:00.000Z',
                tags: ['setup', 'project'],
                assignee: 'Developer',
                createdAt: '2024-01-10T08:00:00.000Z',
                updatedAt: '2024-01-12T14:30:00.000Z'
            },
            {
                title: 'Implement User Authentication',
                description: 'Add JWT-based authentication system',
                status: 'in-progress',
                priority: 'high',
                dueDate: '2024-01-20T17:00:00.000Z',
                tags: ['auth', 'security'],
                assignee: 'Backend Developer',
                createdAt: '2024-01-12T09:00:00.000Z',
                updatedAt: '2024-01-14T11:00:00.000Z'
            },
            {
                title: 'Design Database Schema',
                description: 'Create the database schema for the application',
                status: 'pending',
                priority: 'medium',
                dueDate: '2024-01-25T12:00:00.000Z',
                tags: ['database', 'design'],
                assignee: 'Database Architect',
                createdAt: '2024-01-13T10:30:00.000Z',
                updatedAt: '2024-01-13T10:30:00.000Z'
            },
            {
                title: 'Write Unit Tests',
                description: 'Create comprehensive unit tests for all modules',
                status: 'pending',
                priority: 'medium',
                dueDate: '2024-01-30T16:00:00.000Z',
                tags: ['testing', 'quality'],
                assignee: 'QA Engineer',
                createdAt: '2024-01-14T14:00:00.000Z',
                updatedAt: '2024-01-14T14:00:00.000Z'
            }
        ];

        sampleTasks.forEach(task => {
            const id = uuidv4();
            this.tasks.set(id, { ...task, id });
        });

        this.initialized = true;
        logger.info(`TaskStore initialized with ${this.tasks.size} sample tasks`);
    }

    /**
     * Get all tasks with optional filtering and pagination
     * @param {Object} options - Query options
     * @returns {Object} Tasks and pagination info
     */
    getAllTasks(options = {}) {
        const {
            page = 1,
            limit = 10,
            status,
            priority,
            assignee,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            dueDateFrom,
            dueDateTo
        } = options;

        let tasksArray = Array.from(this.tasks.values());

        // Apply filters
        if (status) {
            tasksArray = tasksArray.filter(task => task.status === status);
        }

        if (priority) {
            tasksArray = tasksArray.filter(task => task.priority === priority);
        }

        if (assignee) {
            tasksArray = tasksArray.filter(task => 
                task.assignee && task.assignee.toLowerCase().includes(assignee.toLowerCase())
            );
        }

        if (search) {
            const searchLower = search.toLowerCase();
            tasksArray = tasksArray.filter(task => 
                task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }

        if (dueDateFrom) {
            tasksArray = tasksArray.filter(task => 
                task.dueDate && new Date(task.dueDate) >= dueDateFrom
            );
        }

        if (dueDateTo) {
            tasksArray = tasksArray.filter(task => 
                task.dueDate && new Date(task.dueDate) <= dueDateTo
            );
        }

        // Sort tasks
        tasksArray.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            // Handle date sorting
            if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'dueDate') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            // Handle string sorting
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) {
                return sortOrder === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortOrder === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // Apply pagination
        const total = tasksArray.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTasks = tasksArray.slice(startIndex, endIndex);

        return {
            data: paginatedTasks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: endIndex < total,
                hasPreviousPage: page > 1
            }
        };
    }

    /**
     * Get task by ID
     * @param {string} id - Task ID
     * @returns {Object|null} Task object or null if not found
     */
    getTaskById(id) {
        return this.tasks.get(id) || null;
    }

    /**
     * Create new task
     * @param {Object} taskData - Task data
     * @returns {Object} Created task
     */
    createTask(taskData) {
        const id = uuidv4();
        const now = new Date().toISOString();
        
        const task = {
            id,
            ...taskData,
            status: taskData.status || 'pending',
            priority: taskData.priority || 'medium',
            createdAt: now,
            updatedAt: now
        };

        this.tasks.set(id, task);
        logger.info('Task created', { taskId: id, title: task.title });
        
        return task;
    }

    /**
     * Update task by ID
     * @param {string} id - Task ID
     * @param {Object} updateData - Update data
     * @returns {Object|null} Updated task or null if not found
     */
    updateTask(id, updateData) {
        const existingTask = this.tasks.get(id);
        
        if (!existingTask) {
            return null;
        }

        const updatedTask = {
            ...existingTask,
            ...updateData,
            id, // Ensure ID doesn't change
            createdAt: existingTask.createdAt, // Preserve creation date
            updatedAt: new Date().toISOString()
        };

        this.tasks.set(id, updatedTask);
        logger.info('Task updated', { taskId: id, title: updatedTask.title });
        
        return updatedTask;
    }

    /**
     * Delete task by ID
     * @param {string} id - Task ID
     * @returns {Object|null} Deleted task or null if not found
     */
    deleteTask(id) {
        const task = this.tasks.get(id);
        
        if (!task) {
            return null;
        }

        this.tasks.delete(id);
        logger.info('Task deleted', { taskId: id, title: task.title });
        
        return task;
    }

    /**
     * Get task statistics
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const allTasks = Array.from(this.tasks.values());
        const total = allTasks.length;

        const byStatus = {
            pending: allTasks.filter(task => task.status === 'pending').length,
            'in-progress': allTasks.filter(task => task.status === 'in-progress').length,
            completed: allTasks.filter(task => task.status === 'completed').length,
            cancelled: allTasks.filter(task => task.status === 'cancelled').length
        };

        const byPriority = {
            low: allTasks.filter(task => task.priority === 'low').length,
            medium: allTasks.filter(task => task.priority === 'medium').length,
            high: allTasks.filter(task => task.priority === 'high').length,
            urgent: allTasks.filter(task => task.priority === 'urgent').length
        };

        const completed = byStatus.completed;
        const active = total - completed - byStatus.cancelled;
        const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

        // Overdue tasks
        const now = new Date();
        const overdue = allTasks.filter(task => 
            task.dueDate && 
            new Date(task.dueDate) < now && 
            task.status !== 'completed' && 
            task.status !== 'cancelled'
        ).length;

        // Tasks due soon (within 7 days)
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const dueSoon = allTasks.filter(task => 
            task.dueDate && 
            new Date(task.dueDate) <= weekFromNow && 
            new Date(task.dueDate) >= now &&
            task.status !== 'completed' && 
            task.status !== 'cancelled'
        ).length;

        return {
            total,
            active,
            completed,
            completionRate: parseFloat(completionRate),
            overdue,
            dueSoon,
            byStatus,
            byPriority,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Get tasks by assignee
     * @param {string} assignee - Assignee name
     * @returns {Array} Array of tasks
     */
    getTasksByAssignee(assignee) {
        return Array.from(this.tasks.values())
            .filter(task => task.assignee && task.assignee.toLowerCase().includes(assignee.toLowerCase()));
    }

    /**
     * Get tasks by status
     * @param {string} status - Task status
     * @returns {Array} Array of tasks
     */
    getTasksByStatus(status) {
        return Array.from(this.tasks.values())
            .filter(task => task.status === status);
    }

    /**
     * Get tasks by priority
     * @param {string} priority - Task priority
     * @returns {Array} Array of tasks
     */
    getTasksByPriority(priority) {
        return Array.from(this.tasks.values())
            .filter(task => task.priority === priority);
    }

    /**
     * Search tasks by text
     * @param {string} searchText - Text to search for
     * @returns {Array} Array of matching tasks
     */
    searchTasks(searchText) {
        const searchLower = searchText.toLowerCase();
        return Array.from(this.tasks.values())
            .filter(task => 
                task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchLower))) ||
                (task.assignee && task.assignee.toLowerCase().includes(searchLower))
            );
    }

    /**
     * Clear all tasks (for testing purposes)
     */
    clearAll() {
        this.tasks.clear();
        logger.info('All tasks cleared');
    }

    /**
     * Get task count
     * @returns {number} Total number of tasks
     */
    getTaskCount() {
        return this.tasks.size;
    }
}

// Create and export singleton instance
const taskStore = new TaskStore();

export { taskStore, TaskStore };
export default taskStore;
