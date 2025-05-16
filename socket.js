const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chat = require('./models/Chat');

let io;

function initializeSocket(httpServer) {
    io = new Server(httpServer, {
        pingTimeout: 60000,
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            methods: ["GET", "POST"]
        }
    });

    console.log('Socket.IO server initialized');


    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
        // console.log("Socket auth token:", token);

        if (!token) {
            console.log('Socket connection attempt without token.');
            return next(new Error('Authentication error: No token provided'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('_id name email');
            if (!user) {
                console.log('Socket auth error: User from token not found.');
                return next(new Error('Authentication error: User not found'));
            }
            socket.user = user;
            // console.log(`Socket authenticated for user: ${user.email}`);
            next();
        } catch (err) {
            console.error('Socket authentication error:', err.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });


    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}, User ID: ${socket.user?._id}, Name: ${socket.user?.name}`);

        socket.emit('connected', { socketId: socket.id, userId: socket.user._id });

        socket.on('joinChat', async (chatId) => {
            if (!socket.user || !socket.user._id) {
                socket.emit('socketError', { message: 'User not authenticated for joining chat.' });
                return;
            }
            if (!chatId) {
                 socket.emit('socketError', { message: 'Chat ID is required to join room.' });
                return;
            }

            try {
                const chat = await Chat.findOne({ _id: chatId, participants: socket.user._id });
                if (!chat) {
                    console.log(`User ${socket.user._id} attempt to join unauthorized chat ${chatId}`);
                    socket.emit('socketError', { message: `Not authorized to join chat ${chatId}` });
                    return;
                }

                socket.join(chatId.toString());
                console.log(`User ${socket.user._id} (${socket.id}) joined chat room: ${chatId}`);
                socket.emit('chatJoined', { chatId: chatId, message: `You joined chat ${chatId}` });

                // notify others in the room user online status? not needed for now
                // socket.to(chatId.toString()).emit('userOnlineInChat', { userId: socket.user._id, name: socket.user.name });

            } catch (error) {
                 console.error(`Error joining chat room ${chatId}:`, error);
                 socket.emit('socketError', { message: `Error joining chat ${chatId}: ${error.message}` });
            }
        });

        socket.on('leaveChat', (chatId) => {
            if (chatId) {
                socket.leave(chatId.toString());
                console.log(`User ${socket.user?._id} (${socket.id}) left chat room: ${chatId}`);
                // notify others? not mandatory for now
                // socket.to(chatId.toString()).emit('userOfflineInChat', { userId: socket.user._id, name: socket.user.name });
            }
        });

        socket.on('typing', ({ chatId, isTyping }) => {
            if (chatId && socket.user) {
                socket.to(chatId.toString()).emit('typing', {
                    chatId,
                    user: { _id: socket.user._id, name: socket.user.name },
                    isTyping
                });
            }
        });


        socket.on('messagesRead', async ({ chatId, lastReadMessageTimestamp }) => {
            if (!chatId || !socket.user || !socket.user._id) return;
            console.log(`User ${socket.user._id} read messages in chat ${chatId} up to ${lastReadMessageTimestamp}`);

            socket.to(chatId.toString()).emit('messagesReadByOtherUser', {
                chatId,
                readerId: socket.user._id,
                readerName: socket.user.name,
                lastReadMessageTimestamp
            });
        });


        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}, User ID: ${socket.user?._id}`);
            // Todo Perform cleanup... leave all rooms, update user status to offline
            // iterate through socket.rooms and emit 'userOfflineInChat'
        });
    });

    return io;
}


function getIO() {
    if (!io) {
        throw new Error("Socket.IO not initialized!");
    }
    return io;
}

module.exports = { initializeSocket, getIO };
