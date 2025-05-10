const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true
        },
        chatType: {
            type: String,
            required: true,
            enum: ['one_on_one', 'group', 'event_chat'],
            default: 'one_on_one'
        },
        participants: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User',
                required: true
            }
        ],
        group: {
            type: mongoose.Schema.ObjectId,
            ref: 'Group',
            required: function() { return this.chatType === 'group'; }
        },
        event: {
            type: mongoose.Schema.ObjectId,
            ref: 'Event',
            required: function() { return this.chatType === 'event_chat'; }
        },

        lastMessage: {
            type: mongoose.Schema.ObjectId,
            ref: 'Message'
        },
    },
    {
        timestamps: true
    }
);


chatSchema.index({ participants: 1 });
chatSchema.index({ group: 1 }, { unique: true, sparse: true });
chatSchema.index({ event: 1 }, { unique: true, sparse: true });
chatSchema.index({ updatedAt: -1 });

chatSchema.index({ participants: 1, chatType: 1 }, {
    unique: true,
    partialFilterExpression: { chatType: 'one_on_one', 'participants.1': { $exists: true } }
});

chatSchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('Chat pre-findOneAndDelete hook triggered');
    const query = this.getQuery();
    const chatId = query._id;

    if (!chatId) return next();

    try {
        const Message = mongoose.models.Message || mongoose.model('Message');
        const Report = mongoose.models.Report || mongoose.model('Report');

        const messagesToDelete = await Message.find({ chatId: chatId }).select('file');
        const cloudinary = require('../config/cloudinary');
        const cloudinaryPromises = [];

        for (const msg of messagesToDelete) {
            if (msg.file && msg.file.publicId) {
                console.log(`Queueing Cloudinary deletion for file ${msg.file.publicId} from message ${msg._id}`);
                cloudinaryPromises.push(
                    cloudinary.uploader.destroy(msg.file.publicId, { resource_type: msg.file.resourceType || 'auto' })
                );
            }

            if (Report) {
                 cleanupPromises.push(Report.deleteMany({ targetType: 'Message', targetId: msg._id }));
            }
        }
        await Promise.all(cloudinaryPromises);
        console.log(`Cloudinary files for chat ${chatId} deleted.`);

        await Message.deleteMany({ chatId: chatId });
        console.log(`Messages for chat ${chatId} deleted.`);

        next();
    } catch (error) {
        console.error(`Error in chat pre-delete hook for ${chatId}:`, error);
        next(error);
    }
});


const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
