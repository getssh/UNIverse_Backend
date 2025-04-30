require('dotenv').config(); 
require('express-async-errors'); 

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db'); 
const errorHandler = require('./middleware/errorMiddleware'); 

connectDB(); 


const authRoutes = require('./routes/auth');

const app = express();


app.use(cors())
app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: false }));

// HTTP request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the University Platform API!' });
});


app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- Graceful Shutdown & Unhandled Rejection Handling ---
process.on('unhandledRejection', (err, promise) => {
    console.error(`Unhandled Rejection: ${err.message}`);
    
    server.close(() => {
        console.log('Server closed due to unhandled rejection');
        process.exit(1);
    });
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server')
    server.close(() => {
      console.log('HTTP server closed')
      
      process.exit(0)
    })
  })