const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
    {
        reportedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, "Reported by is required"],
            index: true
        },
        targetType: {
            type: String,
            required: [true, 'Target type is required (e.g., Post, Group).'],
            enum: ['Post', 'Group', 'User', 'Comment', 'Channel'],
            index: true
        },
        targetId: {
            type: mongoose.Schema.ObjectId,
            required: [true, 'Target ID is required.'],
            refPath: 'targetType'
        },
        reason: {
            type: String,
            required: [true, 'Please provide a reason for the report.'],
            trim: true,
            maxlength: [500, 'Reason cannot exceed 500 characters.']
        },
        resolved: {
            type: Boolean,
            default: false,
            index: true
        },
        resolvedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        resolvedAt: {
            type: Date
        },
        actionTaken: {
            type: String,
            enum: [
                'content_removed',
                'user_warned',
                'user_banned',
                'account_deactivated',
                'no_action_needed',
                'other'
            ]
        },
        adminNotes: {
             type: String,
             trim: true,
             maxlength: [1000, 'Admin notes cannot exceed 1000 characters.']
        }
    },
    {
        timestamps: true
    }
);


reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ resolvedBy: 1 });


reportSchema.pre('save', function(next) {
    if (this.isModified('resolved') && this.resolved) {
        if (!this.resolvedAt) {
             this.resolvedAt = Date.now();
        }
        // Maybe require resolvedBy if resolved is true?
        // if (!this.resolvedBy) {
        //     next(new Error('resolvedBy is required when marking a report as resolved.'));
        // }
    }

    if (this.isModified('resolved') && !this.resolved) {
        this.resolvedAt = undefined;
        this.resolvedBy = undefined;
        this.actionTaken = undefined;
        this.adminNotes = undefined;
    }
    next();
});

reportSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();

    if (update.$set && update.$set.resolved === true) {
        if (!update.$set.resolvedAt) {
            this.updateOne({}, { $set: { resolvedAt: Date.now() } });
        }
    }

     if (update.$set && update.$set.resolved === false) {
         this.updateOne({}, { $unset: { resolvedAt: "", resolvedBy: "", actionTaken: "", adminNotes: "" } });
     }

    next();
});


const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
