class ApiError extends Error {
  constructor(message = 'Something went wrong', statusCode = 500, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
