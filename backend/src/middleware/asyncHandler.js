/**
 * Async Handler Middleware - Wrapper for async route handlers
 * Automatically catches and forwards errors from async functions
 */

/**
 * Wraps async route handlers to catch errors automatically
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Wrapper for multiple async functions in sequence
 * @param {...Function} fns - Async functions to wrap
 * @returns {Array} Array of wrapped middleware functions
 */
export const asyncHandlers = (...fns) => {
    return fns.map(fn => asyncHandler(fn));
};

export default asyncHandler;
