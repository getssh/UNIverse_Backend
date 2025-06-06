const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Group = require('../models/Group')
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const mongoose = require('mongoose');
const { checkTextContent, checkImageContent } = require('../utils/moderationService');
const { getIO } = require('../socket');


/**
 * @route   POST api/messages
 * @desc    Send a message
 * @access  Private
 */
exports.sendMessage = async (req, res, next) => {
     const { chatId, content, replyTo } = req.body; 
    const senderId = req.user.id;
    const file = req.file;

    if (!chatId) {
        return res.status(400).json({ success: false, error: 'Chat ID is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ success: false, error: 'Invalid Chat ID format.' });
    }
    if (!content && !file) {
        return res.status(400).json({ success: false, error: 'Message must have content or a file.' });
    }

    try {
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        if (!chat.participants.some(p => p.equals(senderId))) {
            return res.status(403).json({ success: false, error: 'You are not a participant of this chat.' });
        }

         if (replyTo) {
            if (!mongoose.Types.ObjectId.isValid(replyTo)) {
                return res.status(400).json({ success: false, error: 'Invalid replyTo message ID format.' });
            }
            const repliedMessage = await Message.findById(replyTo);
            if (!repliedMessage || !repliedMessage.chatId.equals(chatId)) {
                return res.status(400).json({ success: false, error: 'Invalid replied message or not in same chat.' });
            }
        }

        let fileData = null;
        if (file) {
            try {
                const resourceType = getResourceTypeFromMime(file.mimetype);
                const result = await uploadToCloudinary(
                    file.buffer,
                    file.originalname,
                    'chat_files',
                    resourceType
                );
                fileData = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    resourceType: resourceType,
                    originalName: file.originalname
                };
            } catch (uploadError) {
                console.error("Message file upload failed:", uploadError);
                return res.status(500).json({ success: false, error: `Failed to upload file: ${uploadError.message}` });
            }
        }

        let textSafe = true;
        if (content) {
          const textCheck = await checkTextContent(content);
          textSafe = textCheck.isSafe;
          if (!textSafe) {
            return res.status(403).json({ success: false, error: 'Text content is inappropriate', details: textCheck.details });
          }
        }

        if (fileData) {
          const imageCheck = await checkImageContent(fileData.url);
          if (!imageCheck.isSafe) {
            return res.status(403).json({ success: false, error: 'Image content is inappropriate', details: imageCheck.details });
          }
        }

        const messageData = {
        chatId: chatId,
        sender: senderId,
        content: content?.trim(), // Optional content
        file: fileData, // Can be null
        readBy: [senderId],
        replyTo: replyTo 
    };

    if ((!content || content.trim() === '') && fileData) {
        messageData.content = undefined;
    }


        let newMessage = await Message.create(messageData);

        newMessage = await Message.findById(newMessage._id)
            .populate('sender', 'name profilePicUrl')
            .populate('reactions.user', 'name')
            .lean();

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: newMessage._id,
            updatedAt: Date.now()
        });

        try {
            const io = getIO();
            io.to(chatId.toString()).emit('newMessage', newMessage);
            console.log(`Socket event 'newMessage' emitted to room ${chatId}`);
        } catch (socketError) {
             console.error("Socket emission error in sendMessage:", socketError.message);
        }

        res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
        next(error);
    }
};


/**
 * @route   GET api/messages/:chatId
 * @desc    Get messages for a chat
 * @access  Private
 */
exports.getMessagesForChat = async (req, res, next) => {
    const { chatId } = req.params;
    const userId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ success: false, error: 'Invalid Chat ID format.' });
    }

    try {
        const chat = await Chat.findById(chatId).select('participants');
        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        if (!chat.participants.some(p => p.equals(userId))) {
            return res.status(403).json({ success: false, error: 'Not authorized to view messages for this chat.' });
        }

         const messages = await Message.find({ chatId: chatId })
            .populate('sender', 'name profilePicUrl')
            .populate({
                path: 'replyTo',
                select: 'content sender file',
                populate: {
                    path: 'sender',
                    select: 'name profilePicUrl'
                }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalMessages = await Message.countDocuments({ chatId: chatId });
        const totalPages = Math.ceil(totalMessages / limit);

        await Message.updateMany(
            { chatId: chatId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        res.status(200).json({
            success: true,
            count: messages.length,
            pagination: { totalMessages, totalPages, currentPage: page, limit },
            data: messages.reverse()
        });
    } catch (error) {
        next(error);
    }
};


/**
 * @route   POST api/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
exports.editMessage = async (req, res, next) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
    }
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, error: 'Invalid Message ID format.' });
    }

    try {
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found.' });
        }

        if (!message.sender.equals(userId)) {
            return res.status(403).json({ success: false, error: 'Not authorized to edit this message.' });
        }

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (message.createdAt < fifteenMinutesAgo) {
           return res.status(403).json({ success: false, error: 'Message too old to edit.' });
        }

        message.content = content.trim();
        message.isEdited = true;
        await message.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name profilePicUrl')
            .populate({
                path: 'replyTo',
                select: 'content sender file',
                populate: {
                    path: 'sender',
                    select: 'name profilePicUrl'
                }
            })
            .lean();

        try {
            const io = getIO();
            io.to(message.chatId.toString()).emit('messageUpdated', populatedMessage);
            console.log(`Socket event 'messageUpdated' emitted to room ${message.chatId}`);
        } catch (socketError) {
            console.error("Socket emission error in editMessage:", socketError.message);
        }

        res.status(200).json({ success: true, data: populatedMessage });
    } catch (error) {
        next(error);
    }
};


/**
 * @route   DELETE api/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
exports.deleteMessage = async (req, res, next) => {
    const { messageId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ success: false, error: 'Invalid Message ID format.' });
    }

    try {
        const message = await Message.findById(messageId).populate('chatId', 'admins group chatType');
        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found.' });
        }

        const chat = message.chatId;
        let canDelete = false;

        if (message.sender.equals(userId)) {
            canDelete = true;
        } else if (chat && chat.chatType === 'group' && chat.group) {
            const group = await Group.findById(chat.group).select('admins');

            if (group && group.admins.some(adminId => adminId.equals(userId))) {
                canDelete = true;
            }
        } 
        
        // else if (req.user.role === 'admin') { //should system admin have access to delete any message?
        //     canDelete = true;
        // }


        if (!canDelete) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this message.' });
        }

        const chatIdForSocket = message.chatId.toString();

        await Message.findByIdAndDelete(messageId);

        try {
            const io = getIO();
            io.to(chatIdForSocket).emit('messageDeleted', {
                messageId: messageId,
                chatId: chatIdForSocket
            });
            console.log(`Socket event 'messageDeleted' emitted to room ${chatIdForSocket}`);
        } catch (socketError) {
            console.error("Socket emission error in deleteMessage:", socketError.message);
        }

        res.status(200).json({ success: true, message: 'Message deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT api/messages/read/:chatId
 * @desc    Mark messages as read
 * @access  Private
 */
exports.markMessagesAsRead = async (req, res, next) => {
    const { chatId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ success: false, error: 'Invalid Chat ID format.' });
    }

    try {
        const chat = await Chat.findById(chatId).select('participants');
        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        if (!chat.participants.some(p => p.equals(userId))) {
            return res.status(403).json({ success: false, error: 'Not authorized to mark messages in this chat.' });
        }

        const result = await Message.updateMany(
            { chatId: chatId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        //emit socket 
        try {
            const io = getIO();

            const chat = await Chat.findById(chatId).select('participants');
            if (chat && chat.participants.some(p => p.equals(userId))) {
                chat.participants.forEach(participantId => {
                    if (!participantId.equals(userId)) {
                      //todo dont send to self(sender)
                    }
                });

                 io.to(chatId.toString()).emit('chatMessagesUpdated', {
                     chatId: chatId,
                     readerId: userId,
                     readerName: userName,
                     message: `${result.modifiedCount} messages marked as read by ${userName}.`
                 });
                 console.log(`Socket event 'chatMessagesUpdated' (read status) emitted to room ${chatId}`);
            }
        } catch (socketError) {
            console.error("Socket emission error in markMessagesAsRead:", socketError.message);
        }
        
        console.log(`Marked ${result.modifiedCount} messages as read by ${userId} in chat ${chatId}`);

        res.status(200).json({ success: true, message: `${result.modifiedCount} messages marked as read.` });
    } catch (error) {
        next(error);
    }
};

//send only files that are not images pdf, docx, etc that posted on the given chat
/**
 * @route   GET api/messages/files/:chatId
 * @desc    Get files for a chat
 * @access  Private
 */
exports.getFilesForChat = async (req, res, next) => {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ success: false, error: 'Invalid Chat ID format.' });
    }

    try {
        const chat = await Chat.findById(chatId).select('participants');
        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }
        if (!chat.participants.some(p => p.equals(userId))) {
            return res.status(403).json({ success: false, error: 'Not authorized to view files in this chat.' });
        }

        const files = await Message.find({ chatId: chatId, file: { $exists: true, $ne: null } })
            .populate('sender', 'name profilePicUrl')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, data: files });
    } catch (error) {
        next(error);
    }
};

