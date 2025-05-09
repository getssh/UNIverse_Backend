const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: [true, 'Post content cannot be empty.'],
            trim: true,
            maxlength: [2000, 'Post content cannot exceed 2000 characters.']
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Post must belong to a user.'],
            index: true
        },
        group: {
            type: mongoose.Schema.ObjectId,
            ref: 'Group',
            index: true
        },
        channel: {
            type: mongoose.Schema.ObjectId,
            ref: 'Channel', 
            index: true 
        },

        files: [
            {
                url: { type: String, required: true }, 
                publicId: { type: String, required: true }
            }
        ],

        likes: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],

        reports: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'Report'
            }
        ],

        isEdited: { type: Boolean, default: false }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);


postSchema.virtual('likeCount').get(function() {
    return this.likes ? this.likes.length : 0;
});


postSchema.pre('remove', async function(next) {
  console.log(`'remove' hook: Cleaning up for post ${this._id}...`);

  const Report = mongoose.models.Report || mongoose.model('Report');
  if (Report) {
      await Report.deleteMany({ targetType: 'post', targetId: this._id });
      console.log(`Reports deleted for post ${this._id}`);
  } else {
      console.warn("Report model not found, skipping report deletion.");
  }

  const Comment = mongoose.models.Comment || mongoose.model('Comment');
  if (Comment) {
      await Comment.deleteMany({ postId: this._id });
      console.log(`Comments deleted for post ${this._id}`);
  } else {
      console.warn("Comment model not found, skipping comment deletion.");
  }

  //Todo add func to remove files associated with a post on delation (implement this after we setup storage on our server?)
  // iterate through `this.files` and delete files

  next();
});


const Post = mongoose.model('Post', postSchema);

module.exports = Post;