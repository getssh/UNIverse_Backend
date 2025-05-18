const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message'); 

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

        socket.on('chatMessage', async (data, callback) => {
    try {
        console.log('Received message on backend:', {
            chatId: data.chatId,
            sender: socket.user._id,
            content: data.content,
            replyTo: data.replyTo // Add this
        });

        // Validate input
        if (!data.chatId || (!data.content && !data.file)) {
            throw new Error('Both chatId and content/file are required');
        }

        // Verify user is part of the chat
        const chat = await Chat.findOne({
            _id: data.chatId,
            participants: socket.user._id
        });

        if (!chat) {
            throw new Error('User not authorized to send messages to this chat');
        }

        // Validate replyTo if provided
        if (data.replyTo) {
            const repliedMessage = await Message.findOne({
                _id: data.replyTo,
                chatId: data.chatId
            });
            if (!repliedMessage) {
                throw new Error('Invalid replied message or not in same chat');
            }
        }

        // Create and save message
        const message = new Message({
            chatId: data.chatId,
            sender: socket.user._id,
            content: data.content,
            replyTo: data.replyTo, // Add this
            readBy: [socket.user._id]
        });

        const savedMessage = await message.save();
        
        // Populate sender and replyTo info before sending
        const populatedMessage = await Message.populate(savedMessage, [
            {
                path: 'sender',
                select: 'name profilePicUrl'
            },
            {
                path: 'replyTo',
                select: 'content sender',
                populate: {
                    path: 'sender',
                    select: 'name profilePicUrl'
                }
            }
        ]);

        // Update chat's last message
        await Chat.findByIdAndUpdate(data.chatId, {
            lastMessage: savedMessage._id,
            updatedAt: Date.now()
        });

        // Broadcast to all in the chat room including sender
        io.to(data.chatId.toString()).emit('newMessage', populatedMessage);

        // Send acknowledgement to sender
        if (typeof callback === 'function') {
            callback({
                status: 'success',
                message: populatedMessage
            });
        }

        console.log('Message successfully processed and broadcasted');
            } catch (error) {
                console.error('Error processing message:', error);
                if (typeof callback === 'function') {
                    callback({
                        status: 'error',
                        error: error.message
                    });
                }
                socket.emit('socketError', {
                    event: 'chatMessage',
                    error: error.message
                });
            }
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
