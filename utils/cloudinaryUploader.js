const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier')
const path = require('path')
const crypto = require('crypto')

const uploadToCloudinary = (fileBuffer, originalFilename, folder, resourceType = 'auto') => {
    return new Promise((resolve, reject) => {
        const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
        const filenameWithoutExt = path.parse(originalFilename).name;
        const publicId = `${filenameWithoutExt}-${uniqueSuffix}`;

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `uploads/${folder}`,
                public_id: publicId,
                resource_type: resourceType,
            },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary Upload Error:', error);
                    return reject(new Error(`Cloudinary upload failed: ${error.message}`));
                }
                if (result) {
                    console.log(`File uploaded to Cloudinary: ${result.public_id}`);
                    resolve(result);
                } else {
                     reject(new Error('Cloudinary upload failed without error object.'));
                }

            }
        );

        streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
};

module.exports = uploadToCloudinary;