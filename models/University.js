const mongoose = require('mongoose');
const User = require('./User');
const Channel = require('./Channel');
// const Event = require('./Event');
// const Group = require('./Group');

const universitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'University name is required.'],
            unique: true,
            trim: true,
            maxlength: [150, 'University name cannot exceed 150 characters.']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'University description cannot exceed 1000 characters.']
        },
        location: {
            type: String,
            trim: true,
            maxlength: [200, 'Location cannot exceed 200 characters.']
        },
        websiteUrl: {
            type: String,
            trim: true,
            match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please provide a valid website URL.']
        },
        logoUrl: {
            type: String,
            trim: true,
            default: 'URL_TO_DEFAULT_UNIVERSITY_LOGO_PLACEHOLDER'
        },
        contactEmail: {
             type: String,
             trim: true,
             lowercase: true,
             match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid contact email address.']
        },
        contactPhone: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
);


universitySchema.index(
    { name: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 } }
);

universitySchema.index({ location: 1 });


universitySchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('University pre-findOneAndDelete hook triggered...');
    const query = this.getQuery();
    const universityId = query._id;

    if (!universityId) {
        console.warn('University ID not found in query for findOneAndDelete hook. Skipping cleanup.');
        return next();
    }

    try {
        console.log(`Initiating cleanup for university ${universityId}...`);

        const User = mongoose.models.User || mongoose.model('User');
        const Channel = mongoose.models.Channel || mongoose.model('Channel');
        // const Event = mongoose.models.Event || mongoose.model('Event');
        // const Group = mongoose.models.Group || mongoose.model('Group');

        const cleanupPromises = [];

        console.log(`Queueing unlinking of users for university ${universityId}`);
        cleanupPromises.push(
            User.updateMany({ university: universityId }, { $set: { university: null } })
                .then(result => console.log(`Unlinked ${result.modifiedCount} users.`))
        );

        console.log(`Queueing deletion of channels for university ${universityId}`);
        cleanupPromises.push(
            Channel.find({ university: universityId }).then(async (channels) => {
                if (channels.length > 0) {
                    console.log(`Found ${channels.length} channels to delete.`);
                    for (const channel of channels) {
                         await Channel.findByIdAndDelete(channel._id);
                    }
                    console.log(`Finished deleting channels.`);
                }
            })
        );

        // console.log(`Queueing deletion of events for university ${universityId}`);
        // cleanupPromises.push(
        //     Event.deleteMany({ university: universityId })
        //          .then(result => console.log(`Deleted ${result.deletedCount} events.`))
        // );

        //Todo check if we need to delete groups on delation of university
        // console.log(`Queueing deletion of groups for university ${universityId}`);
        // cleanupPromises.push(
        //     Group.find({ university: universityId }).then(async (groups) => {
        //         if (groups.length > 0) {
        //              console.log(`Found ${groups.length} groups to delete.`);
        //             for (const group of groups) {
        //                 await Group.findByIdAndDelete(group._id);
        //             }
        //              console.log(`Finished deleting groups.`);
        //         }
        //     })
        // );


        await Promise.all(cleanupPromises);
        console.log(`Cleanup tasks completed for university ${universityId}`);
        next();

    } catch (error) {
        console.error(`Error during pre-delete cleanup for university ${universityId}:`, error);
        next(error);
    }
});

const University = mongoose.model('University', universitySchema);

module.exports = University;