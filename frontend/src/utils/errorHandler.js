/**
 * @fileoverview Error categorization and handling utilities
 * @module utils/errorHandler
 */

/**
 * Error categories for client-side error handling
 * @enum {string}
 */
export const ErrorCategory = {
  NETWORK: 'network',  // Connection issues
  SERVER: 'server',    // Server-side errors (500 range)
  VALIDATION: 'validation', // Bad request, validation errors (400 range)
  AUTH: 'auth',        // Authentication/authorization issues (401, 403)
  NOT_FOUND: 'not_found', // Resource not found (404)
  TIMEOUT: 'timeout',  // Request timeout
  UNKNOWN: 'unknown'   // Uncategorized errors
}

/**
 * Categorizes an error based on its properties and message
 * @function categorizeError
 * @param {Error} error - The error object to categorize
 * @returns {Object} Categorized error with type, message, and recovery suggestion
 */
export function categorizeError(error) {
  const result = {
    category: ErrorCategory.UNKNOWN,
    message: error.message || 'An unknown error occurred',
    recoverable: false,
    recoverySuggestion: null
  }

  // Network connectivity issues
  if (
    error.name === 'TypeError' && 
    (error.message.includes('NetworkError') || 
     error.message.includes('Failed to fetch') ||
     error.message.includes('Network request failed'))
  ) {
    result.category = ErrorCategory.NETWORK
    result.message = 'Network connection issue'
    result.recoverable = true
    result.recoverySuggestion = 'Check your internet connection and try again'
    return result
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    result.category = ErrorCategory.TIMEOUT
    result.message = 'Request timed out'
    result.recoverable = true
    result.recoverySuggestion = 'The server is taking too long to respond. Try again later.'
    return result
  }

  // Server errors (HTTP 5xx)
  if (error.status >= 500 || error.message.includes('500') || error.message.includes('503')) {
    result.category = ErrorCategory.SERVER
    result.message = 'Server error'
    result.recoverable = false
    result.recoverySuggestion = 'The server encountered an error. Please try again later.'
    return result
  }

  // Not found errors (HTTP 404)
  if (error.status === 404 || error.message.includes('404') || error.message.includes('not found')) {
    result.category = ErrorCategory.NOT_FOUND
    result.message = 'Resource not found'
    result.recoverable = false
    result.recoverySuggestion = 'The requested resource does not exist or was removed.'
    return result
  }

  // Auth errors (HTTP 401, 403)
  if (error.status === 401 || error.status === 403 || 
      error.message.includes('401') || error.message.includes('403') ||
      error.message.includes('unauthorized') || error.message.includes('forbidden')) {
    result.category = ErrorCategory.AUTH
    result.message = 'Authentication error'
    result.recoverable = true
    result.recoverySuggestion = 'Your session may have expired. Try refreshing the page.'
    return result
  }

  // Validation errors (HTTP 400)
  if (error.status === 400 || error.message.includes('400') || 
      error.message.includes('validation') || error.message.includes('invalid')) {
    result.category = ErrorCategory.VALIDATION
    result.message = 'Invalid request'
    result.recoverable = true
    result.recoverySuggestion = 'Please check your input and try again.'
    return result
  }

  // For any other error types, keep the original message but mark as unknown category
  return result
}

/**
 * Gets a user-friendly error message based on error category
 * @function getUserFriendlyMessage
 * @param {Object} categorizedError - Error categorized by categorizeError
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyMessage(categorizedError) {
  const { category, message, recoverySuggestion } = categorizedError

  switch (category) {
    case ErrorCategory.NETWORK:
      return `Connection issue: ${recoverySuggestion}`
    case ErrorCategory.SERVER:
      return `Server error: ${recoverySuggestion}`
    case ErrorCategory.TIMEOUT:
      return `Request timed out: ${recoverySuggestion}`
    case ErrorCategory.NOT_FOUND:
      return `Not found: ${recoverySuggestion}`
    case ErrorCategory.AUTH:
      return `Authentication error: ${recoverySuggestion}`
    case ErrorCategory.VALIDATION:
      return `Invalid request: ${message}`
    default:
      return message
  }
}