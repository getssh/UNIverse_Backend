const errorHandler = (err, req, res, next) => {
  console.error('ERROR STACK:', err.stack); 
  console.error('ERROR MESSAGE:', err.message);

  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific Mongoose errors
  if (err.name === 'ValidationError') {
      message = Object.values(err.errors).map(val => val.message).join(', ');
      statusCode = 400; 
  }
  if (err.code === 11000) { 
      const field = Object.keys(err.keyValue)[0];
      message = `Duplicate field value entered for: ${field}. Please use another value.`;
      statusCode = 400; 
  }
  if (err.name === 'CastError') {
      message = `Resource not found. Invalid: ${err.path}`;
      statusCode = 404; 
  }

  res.status(statusCode).json({
      success: false,
      error: message,

      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;