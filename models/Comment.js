const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: [true, 'Comment content cannot be empty.'],
            trim: true,
            maxlength: [500, 'Comment cannot exceed 1000 characters.']
        },
        postId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Post',
            required: [true, 'Comment must belong to a post.'],
            index: true
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Comment must have an author.'],
            index: true
        },

        parentCommentId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Comment',
            default: null,
            index: true
        },

        likes: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],

        isEdited: {
            type: Boolean,
            default: false
        },
        reports: [
             {
                 type: mongoose.Schema.ObjectId,
                 ref: 'Report'
             }
        ]
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

commentSchema.virtual('likeCount').get(function() {
    return this.likes ? this.likes.length : 0;
});


commentSchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('Comment pre-findOneAndDelete hook triggered...');
    const query = this.getQuery();
    const commentId = query._id;

    if (!commentId) {
        console.warn('Comment ID not found in query for findOneAndDelete hook. Skipping cleanup.');
        return next();
    }

    try {
         console.log(`Initiating cleanup for comment ${commentId}...`);
        const Comment = mongoose.model('Comment');
         const Report = mongoose.models.Report || mongoose.model('Report');

        const cleanupPromises = [];

        console.log(`Queueing deletion of replies for comment ${commentId}`);
         cleanupPromises.push(
             Comment.find({ parentCommentId: commentId }).then(async (replies) => {
                 if (replies.length > 0) {
                     console.log(`Found ${replies.length} replies to delete for comment ${commentId}`);
                     for (const reply of replies) {
                         await Comment.findByIdAndDelete(reply._id);
                     }
                     console.log(`Finished deleting replies for comment ${commentId}`);
                 }
             })
         );


        if (Report) {
             console.log(`Queueing deletion of reports for comment ${commentId}`);
             cleanupPromises.push(Report.deleteMany({ targetType: 'comment', targetId: commentId }));
        } else {
             console.warn("Report model not found, skipping report deletion for comment.");
        }

        await Promise.all(cleanupPromises);
         console.log(`Cleanup tasks completed for comment ${commentId}`);
        next();

    } catch (error) {
        console.error(`Error during pre-delete cleanup for comment ${commentId}:`, error);
        next(error);
    }
});


const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;