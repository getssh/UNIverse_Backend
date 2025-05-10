const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
    emoji: {
        type: String,
        required: true,
        enum: ['👍', '❤️', '😂', '😮', '😢', '😠']
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
}, { _id: false });

const messageSchema = new mongoose.Schema(
    {
        chatId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Chat',
            required: [true, 'Message must belong to a chat.'],
            index: true
        },
        sender: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Message must have a sender.'],
            index: true
        },
        content: {
            type: String,
            trim: true,
            required: function() { return !this.fileUrl; }
        },
        file: {
            url: { type: String },
            publicId: { type: String },
            resourceType: { type: String, enum: ['image', 'video', 'raw', 'auto'] },
            originalName: { type: String }
        },
        likes: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],
        reactions: [reactionSchema],
        isPinned: {
            type: Boolean,
            default: false
        },
        isEdited: {
            type: Boolean,
            default: false
        },
        readBy: [{ type: mongoose.Schema.ObjectId, ref: 'User' }]
    },
    {
        timestamps: true
    }
);


messageSchema.virtual('likeCount').get(function() {
    return this.likes ? this.likes.length : 0;
});


messageSchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('Message pre-findOneAndDelete hook triggered...');
    const query = this.getQuery();
    const messageId = query._id;

    if (!messageId) return next();

    try {
        const messageToDelete = await mongoose.model('Message').findById(messageId).select('file');
        if (messageToDelete && messageToDelete.file && messageToDelete.file.publicId) {
            console.log(`Deleting Cloudinary file ${messageToDelete.file.publicId} for message ${messageId}`);
            const cloudinary = require('../config/cloudinary');
            await cloudinary.uploader.destroy(messageToDelete.file.publicId, { resource_type: messageToDelete.file.resourceType || 'auto' });
        }

        const Report = mongoose.models.Report || mongoose.model('Report');
        if (Report) {
            await Report.deleteMany({ targetType: 'Message', targetId: messageId });
        }
        next();
    } catch (error) {
        console.error(`Error in message pre-delete hook for ${messageId}:`, error);
        next(error);
    }
});


const Message = mongoose.model('Message', messageSchema);
module.exports = Message;