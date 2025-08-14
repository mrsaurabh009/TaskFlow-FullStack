/**
 * API Client Utility - HTTP client for external API communication
 * Provides a consistent interface for making HTTP requests with error handling and retries
 */

import { logger } from './logger.js';

/**
 * HTTP Client class with built-in error handling and retry logic
 */
class APIClient {
    constructor(baseURL = '', options = {}) {
        this.baseURL = baseURL;
        this.defaultOptions = {
            timeout: 10000,
            retries: 3,
            retryDelay: 1000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-API/1.0.0',
                ...options.headers
            },
            ...options
        };
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async request(url, options = {}) {
        const fullUrl = this.baseURL + url;
        const requestOptions = {
            ...this.defaultOptions,
            ...options,
            headers: {
                ...this.defaultOptions.headers,
                ...options.headers
            }
        };

        let lastError;
        const maxRetries = requestOptions.retries || 0;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    requestOptions.timeout
                );

                const response = await fetch(fullUrl, {
                    ...requestOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new HTTPError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        response.status,
                        response
                    );
                }

                return response;
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (error.name === 'AbortError') {
                    throw new TimeoutError('Request timeout', requestOptions.timeout);
                }
                
                if (error instanceof HTTPError && error.status < 500) {
                    // Don't retry client errors (4xx)
                    throw error;
                }

                // Log retry attempts
                if (attempt < maxRetries) {
                    logger.warn(`Request failed, retrying (${attempt + 1}/${maxRetries}):`, {
                        url: fullUrl,
                        error: error.message,
                        attempt: attempt + 1
                    });
                    
                    await this.delay(requestOptions.retryDelay * Math.pow(2, attempt));
                } else {
                    logger.error('Request failed after all retries:', {
                        url: fullUrl,
                        error: error.message,
                        attempts: maxRetries + 1
                    });
                }
            }
        }

        throw lastError;
    }

    /**
     * GET request
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async get(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'GET'
        });
    }

    /**
     * POST request
     * @param {string} url - Request URL
     * @param {Object} data - Request body data
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     * @param {string} url - Request URL
     * @param {Object} data - Request body data
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH request
     * @param {string} url - Request URL
     * @param {Object} data - Request body data
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async patch(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} Response promise
     */
    async delete(url, options = {}) {
        return this.request(url, {
            ...options,
            method: 'DELETE'
        });
    }

    /**
     * GET request returning JSON data
     * @param {string} url - Request URL
     * @param {Object} options - Request options
     * @returns {Promise} JSON data promise
     */
    async getJSON(url, options = {}) {
        const response = await this.get(url, options);
        return response.json();
    }

    /**
     * POST request returning JSON data
     * @param {string} url - Request URL
     * @param {Object} data - Request body data
     * @param {Object} options - Request options
     * @returns {Promise} JSON data promise
     */
    async postJSON(url, data, options = {}) {
        const response = await this.post(url, data, options);
        return response.json();
    }

    /**
     * PUT request returning JSON data
     * @param {string} url - Request URL
     * @param {Object} data - Request body data
     * @param {Object} options - Request options
     * @returns {Promise} JSON data promise
     */
    async putJSON(url, data, options = {}) {
        const response = await this.put(url, data, options);
        return response.json();
    }

    /**
     * PATCH request returning JSON data
     * @param {string} url - Request URL
     * @param {Object} data - Request body data
     * @param {Object} options - Request options
     * @returns {Promise} JSON data promise
     */
    async patchJSON(url, data, options = {}) {
        const response = await this.patch(url, data, options);
        return response.json();
    }

    /**
     * Delay utility for retry logic
     * @param {number} ms - Delay in milliseconds
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Set default header
     * @param {string} name - Header name
     * @param {string} value - Header value
     */
    setHeader(name, value) {
        this.defaultOptions.headers[name] = value;
    }

    /**
     * Remove default header
     * @param {string} name - Header name
     */
    removeHeader(name) {
        delete this.defaultOptions.headers[name];
    }

    /**
     * Set base URL
     * @param {string} baseURL - New base URL
     */
    setBaseURL(baseURL) {
        this.baseURL = baseURL;
    }

    /**
     * Set default timeout
     * @param {number} timeout - Timeout in milliseconds
     */
    setTimeout(timeout) {
        this.defaultOptions.timeout = timeout;
    }

    /**
     * Set retry configuration
     * @param {number} retries - Number of retries
     * @param {number} retryDelay - Delay between retries in milliseconds
     */
    setRetryConfig(retries, retryDelay = 1000) {
        this.defaultOptions.retries = retries;
        this.defaultOptions.retryDelay = retryDelay;
    }
}

/**
 * Custom HTTP Error class
 */
class HTTPError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'HTTPError';
        this.status = status;
        this.response = response;
    }
}

/**
 * Custom Timeout Error class
 */
class TimeoutError extends Error {
    constructor(message, timeout) {
        super(message);
        this.name = 'TimeoutError';
        this.timeout = timeout;
    }
}

/**
 * Create a configured API client instance
 * @param {string} baseURL - Base URL for API requests
 * @param {Object} options - Client configuration options
 * @returns {APIClient} Configured API client
 */
export const createAPIClient = (baseURL = '', options = {}) => {
    return new APIClient(baseURL, options);
};

/**
 * Default API client instance
 */
export const apiClient = new APIClient('', {
    timeout: 10000,
    retries: 3,
    retryDelay: 1000
});

/**
 * Health check utility
 * @param {string} baseURL - API base URL
 * @param {Object} options - Request options
 * @returns {Promise} Health check result
 */
export const healthCheck = async (baseURL, options = {}) => {
    const client = new APIClient(baseURL, {
        timeout: 5000,
        retries: 1,
        ...options
    });

    try {
        const startTime = Date.now();
        const response = await client.getJSON('/health');
        const responseTime = Date.now() - startTime;

        return {
            status: 'healthy',
            responseTime,
            data: response,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

/**
 * Batch request utility
 * @param {Array} requests - Array of request configurations
 * @param {Object} options - Batch options
 * @returns {Promise} Batch results
 */
export const batchRequests = async (requests, options = {}) => {
    const { concurrency = 5, failFast = false } = options;
    const results = [];
    const errors = [];

    // Process requests in batches
    for (let i = 0; i < requests.length; i += concurrency) {
        const batch = requests.slice(i, i + concurrency);
        const batchPromises = batch.map(async (request, index) => {
            try {
                const client = request.client || apiClient;
                const method = request.method || 'get';
                const result = await client[method](request.url, request.data, request.options);
                
                return {
                    index: i + index,
                    success: true,
                    data: result,
                    request
                };
            } catch (error) {
                const errorResult = {
                    index: i + index,
                    success: false,
                    error: error.message,
                    request
                };

                if (failFast) {
                    throw errorResult;
                }

                return errorResult;
            }
        });

        try {
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Collect errors
            const batchErrors = batchResults.filter(result => !result.success);
            errors.push(...batchErrors);
        } catch (error) {
            if (failFast) {
                throw error;
            }
        }
    }

    return {
        results,
        errors,
        totalRequests: requests.length,
        successCount: results.filter(r => r.success).length,
        errorCount: errors.length
    };
};

export {
    APIClient,
    HTTPError,
    TimeoutError
};

export default {
    createAPIClient,
    apiClient,
    healthCheck,
    batchRequests,
    APIClient,
    HTTPError,
    TimeoutError
};
