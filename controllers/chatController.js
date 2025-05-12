const Chat = require('../models/Chat');
const User = require('../models/User'); 
const Group = require('../models/Group');
// const Event = require('../models/Event'); // coming soon
const mongoose = require('mongoose');


exports.getOrCreateOneOnOneChat = async (req, res, next) => {
    const { recipientId } = req.body;
    const senderId = req.user.id;

    if (!recipientId) {
        return res.status(400).json({ success: false, error: 'Recipient ID is required.' });
    }
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({ success: false, error: 'Invalid Recipient ID format.' });
    }
    if (senderId === recipientId) {
        return res.status(400).json({ success: false, error: 'Cannot create a chat with yourself.' });
    }

    const recipientExists = await User.findById(recipientId);
    if (!recipientExists) {
        return res.status(404).json({ success: false, error: 'Recipient user not found.' });
    }

    const participants = [senderId, recipientId].sort();

    try {
        let chat = await Chat.findOne({
            chatType: 'one_on_one',
            participants: { $all: participants, $size: 2 }
        })
        .populate('participants', 'name profilePicUrl email')
        .populate('lastMessage');

        if (chat) {
            return res.status(200).json({ success: true, data: chat, message: 'Chat retrieved.' });
        }

        chat = await Chat.create({
            chatType: 'one_on_one',
            participants: participants
        });

        const populatedChat = await Chat.findById(chat._id)
            .populate('participants', 'name profilePicUrl email')
            .lean();

        res.status(201).json({ success: true, data: populatedChat, message: 'Chat created.' });
    } catch (error) {
        if (error.code === 11000) {
            const existingChat = await Chat.findOne({
                chatType: 'one_on_one',
                participants: { $all: participants, $size: 2 }
            }).populate('participants', 'name profilePicUrl email').populate('lastMessage');
            if (existingChat) return res.status(200).json({ success: true, data: existingChat, message: 'Chat retrieved.' });
        }
        next(error);
    }
};


exports.getUserChats = async (req, res, next) => {
    const userId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    try {
        const chats = await Chat.find({ participants: userId })
            .populate('participants', 'name profilePicUrl email')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name profilePicUrl' }
            })
            .populate('group', 'name profilePic')
            // .populate('event', 'name') // don't think we need this, as event chat is only under each event
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const totalChats = await Chat.countDocuments({ participants: userId });
        const totalPages = Math.ceil(totalChats / limit);

        res.status(200).json({
            success: true,
            count: chats.length,
            pagination: { totalChats, totalPages, currentPage: page, limit },
            data: chats
        });
    } catch (error) {
        next(error);
    }
};

exports.getChatById = async (req, res, next) => {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ success: false, error: 'Invalid Chat ID format.' });
    }

    try {
        const chat = await Chat.findById(chatId)
            .populate('participants', 'name profilePicUrl email')
            .populate('group', 'name profilePic admins')
            // .populate('event', 'name') //later or just remove it
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name profilePicUrl' }
            })
            .lean();

        if (!chat) {
            return res.status(404).json({ success: false, error: 'Chat not found.' });
        }

        if (!chat.participants.some(p => p._id.equals(userId))) {
            return res.status(403).json({ success: false, error: 'Not authorized to access this chat.' });
        }

        res.status(200).json({ success: true, data: chat });
    } catch (error) {
        next(error);
    }
};
