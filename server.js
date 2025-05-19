require('dotenv').config(); 
require('express-async-errors'); 

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db'); 
const errorHandler = require('./middleware/errorMiddleware');
const cookieParser = require('cookie-parser');
const http = require('http');
const { initializeSocket } = require('./socket');

connectDB(); 


const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const universityRoutes = require('./routes/universityRoutes');
const channelRoutes = require('./routes/channelRoutes');
const reportRoutes = require('./routes/reportRoutes');
const groupRoutes = require('./routes/groupRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const chatBotRoutes = require('./routes/chatBotRoutes');

const { setupJobScrapingCron } = require('./utils/jobScraperCron.js');


const app = express();


app.use(cors())
app.use(helmet())
app.use(express.json())
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes); 
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/chat-bot', chatBotRoutes);

const httpServer = http.createServer(app);
const io = initializeSocket(httpServer);


app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the University Platform API!' });
});


app.use(errorHandler);


const PORT = process.env.PORT || 5000;

const server = httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log('Socket.IO is listening for connections.');
});


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
  