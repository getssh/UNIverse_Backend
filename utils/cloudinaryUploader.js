const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier')
const path = require('path')
const crypto = require('crypto')

/**
 * Uploads a file to Cloudinary.
 * @param {Buffer} fileBuffer - The file buffer to upload.
 * @param {string} originalFilename - The original filename of the file.
 * @param {string} folder - The folder to upload the file to.
 * @param {string} resourceType - The resource type of the file.
 * @returns {Promise<object>} The result of the upload.
 */
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