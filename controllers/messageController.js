const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Group = require('../models/Group')
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const mongoose = require('mongoose');
const { checkTextContent, checkImageContent } = require('../utils/moderationService');


exports.sendMessage = async (req, res, next) => {
    const { chatId, content } = req.body;
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
            content: content?.trim(),
            file: fileData,
            readBy: [senderId]
        };
        let newMessage = await Message.create(messageData);

        newMessage = await Message.findById(newMessage._id)
            .populate('sender', 'name profilePicUrl')
            .populate('reactions.user', 'name')
            .lean();

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: newMessage._id,
            updatedAt: Date.now()
        });

        res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
        next(error);
    }
};


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
            .populate('reactions.user', 'name')
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
            .lean();

        res.status(200).json({ success: true, data: populatedMessage });
    } catch (error) {
        next(error);
    }
};


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

        await Message.findByIdAndDelete(messageId);

        res.status(200).json({ success: true, message: 'Message deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

exports.markMessagesAsRead = async (req, res, next) => {
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
            return res.status(403).json({ success: false, error: 'Not authorized to mark messages in this chat.' });
        }

        const result = await Message.updateMany(
            { chatId: chatId, readBy: { $ne: userId } },
            { $addToSet: { readBy: userId } }
        );

        console.log(`Marked ${result.modifiedCount} messages as read by ${userId} in chat ${chatId}`);

        res.status(200).json({ success: true, message: `${result.modifiedCount} messages marked as read.` });
    } catch (error) {
        next(error);
    }
};

