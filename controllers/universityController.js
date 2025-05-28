/**
 * @fileoverview Controller functions for managing university-related operations including CRUD operations,
 * university admin management, and logo handling.
 */

const University = require('../models/University');
const User = require('../models/User'); 
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');

/**
 * Creates a new university with optional logo and admin assignments
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing university data
 * @param {string} req.body.name - Name of the university (required)
 * @param {string} [req.body.description] - Description of the university
 * @param {string} [req.body.location] - Location of the university
 * @param {string} [req.body.websiteUrl] - University's website URL
 * @param {string} [req.body.contactEmail] - University's contact email
 * @param {string} [req.body.contactPhone] - University's contact phone number
 * @param {Array<string>} [req.body.universityAdmins] - Array of user IDs to be assigned as university admins
 * @param {string} [req.body.status] - University status
 * @param {Object} [req.file] - Logo file uploaded for the university
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with created university data or error message
 * @throws {Error} If university creation fails or logo upload fails
 */
exports.createUniversity = async (req, res, next) => {
  const {
      name, description, location, websiteUrl, contactEmail, contactPhone,
      universityAdmins = [],
      status
  } = req.body;
  const logoFile = req.file;
  const systemAdminId = req.user.id;

  if (!name) {
      return res.status(400).json({ success: false, error: 'University name is required.' });
  }

  const existingUniversity = await University.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
  if (existingUniversity) {
      return res.status(409).json({ success: false, error: `University with name "${name}" already exists.` });
  }

  const validAdminIds = [];
  if (universityAdmins && universityAdmins.length > 0) {
      for (const adminId of universityAdmins) {
          if (mongoose.Types.ObjectId.isValid(adminId)) {
              const adminUserExists = await User.findById(adminId).select('_id');
              if (adminUserExists) {
                  validAdminIds.push(adminId);
              } else {
                  console.warn(`User ID ${adminId} provided for universityAdmins not found.`);
              }
          } else {
               console.warn(`Invalid ObjectId format for universityAdmin: ${adminId}`);
          }
      }
  }
  // add the system admin creating the university as a universityAdmin by default???
  // if (!validAdminIds.includes(systemAdminId)) {
  //     validAdminIds.push(systemAdminId);
  // }


  let logoData = {};
  if (logoFile) {
      try {
          const resourceType = getResourceTypeFromMime(logoFile.mimetype);
          if (resourceType !== 'image') {
              return res.status(400).json({ success: false, error: 'University logo must be an image file.' });
          }
          const result = await uploadToCloudinary(
              logoFile.buffer, logoFile.originalname, 'university_logos', 'image'
          );
          logoData = { url: result.secure_url, publicId: result.public_id };
      } catch (uploadError) {
          console.error("University logo upload failed:", uploadError);
          return res.status(500).json({ success: false, error: `Failed to upload logo: ${uploadError.message}` });
      }
  }

  const universityData = {
      name: name.trim(),
      description: description?.trim(),
      location: location?.trim(),
      websiteUrl: websiteUrl?.trim(),
      logo: logoData.url ? logoData : undefined,
      contactEmail: contactEmail?.trim().toLowerCase(),
      contactPhone: contactPhone?.trim(),
      universityAdmins: [...new Set(validAdminIds)],
      status: status || (University.schema.path('status').defaultValue)
  };

  const university = await University.create(universityData);
  console.log(`University '${university.name}' created successfully by system admin ${systemAdminId}`);

  const populatedUniversity = await University.findById(university._id)
                                          .populate('universityAdmins', 'name email profilePicUrl')
                                          .lean();

  res.status(201).json({ success: true, data: populatedUniversity });
};
  

/**
 * Retrieves a paginated list of universities with optional search filtering
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of universities per page
 * @param {string} [req.query.search] - Search term to filter universities by name
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with paginated universities data
 * @throws {Error} If university retrieval fails
 */
exports.getUniversities = async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: 'i' };
    }

    const universities = await University.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const totalUniversities = await University.countDocuments(filter);
    const totalPages = Math.ceil(totalUniversities / limit);

    res.status(200).json({
        success: true,
        count: universities.length,
        pagination: { totalUniversities, totalPages, currentPage: page, limit },
        data: universities
    });
};

/**
 * Retrieves a single university by its ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.universityId - ID of the university to retrieve
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with university data or error message
 * @throws {Error} If university retrieval fails
 */
exports.getUniversityById = async (req, res, next) => {
  const { universityId } = req.params;
  const university = await University.findById(universityId)
                                   .populate('universityAdmins', 'name email profilePicUrl')
                                   .lean();
  if (!university) {
      return res.status(404).json({ success: false, error: `University not found with ID: ${universityId}` });
  }

  university.adminCount = university.universityAdmins ? university.universityAdmins.length : 0;
  res.status(200).json({ success: true, data: university });
};

/**
 * Updates an existing university's information
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.universityId - ID of the university to update
 * @param {Object} req.body - Request body containing update data
 * @param {string} [req.body.name] - Updated university name
 * @param {string} [req.body.description] - Updated university description
 * @param {string} [req.body.location] - Updated university location
 * @param {string} [req.body.websiteUrl] - Updated university website URL
 * @param {string} [req.body.contactEmail] - Updated university contact email
 * @param {string} [req.body.contactPhone] - Updated university contact phone
 * @param {string} [req.body.status] - Updated university status
 * @param {Array<string>} [req.body.universityAdmins] - Updated list of university admin IDs
 * @param {Object} [req.file] - New logo file for the university
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated university data or error message
 * @throws {Error} If university update fails or logo upload fails
 */
exports.updateUniversity = async (req, res, next) => {
  const { universityId } = req.params;
  const requestBody = { ...req.body };
  const logoFile = req.file;
  const systemAdminId = req.user.id;


  let university = await University.findById(universityId);
  if (!university) {
      return res.status(404).json({ success: false, error: `University not found with ID: ${universityId}` });
  }

  const updateData = {};
  const allowedFields = ['name', 'description', 'location', 'websiteUrl', 'contactEmail', 'contactPhone', 'status'];
  for (const key of allowedFields) {
      if (requestBody[key] !== undefined) {
          updateData[key] = typeof requestBody[key] === 'string' ? requestBody[key].trim() : requestBody[key];
      }
  }

  if (updateData.name && university.name.toLowerCase() !== updateData.name.toLowerCase()) {
      const existing = await University.findOne({ name: { $regex: `^${updateData.name}$`, $options: 'i' }, _id: { $ne: universityId } });
      if (existing) {
          return res.status(409).json({ success: false, error: `University with name "${updateData.name}" already exists.` });
      }
  }

  if (requestBody.universityAdmins && Array.isArray(requestBody.universityAdmins)) {
      const validNewAdminIds = [];
      for (const adminId of requestBody.universityAdmins) {
          if (mongoose.Types.ObjectId.isValid(adminId)) {
              const adminUserExists = await User.findById(adminId).select('_id');
              if (adminUserExists) validNewAdminIds.push(adminId);
              else console.warn(`User ID ${adminId} for universityAdmins not found during update.`);
          } else console.warn(`Invalid ObjectId format for universityAdmin in update: ${adminId}`);
      }
      updateData.universityAdmins = [...new Set(validNewAdminIds)];
  }

  let oldLogoPublicId = university.logo?.publicId;
  if (logoFile) {
      try {
          const result = await uploadToCloudinary(logoFile.buffer, logoFile.originalname, 'university_logos', 'image');
          updateData.logo = { url: result.secure_url, publicId: result.public_id };
      } catch (uploadError) { console.error("University logo upload failed:", uploadError); }
  } else if (requestBody.logo === null || requestBody.logo === '') {
      updateData.logo = { url: University.schema.path('logo.url').defaultValue, publicId: null };
  }

  if (Object.keys(updateData).length === 0 && !logoFile && requestBody.logo !== null && requestBody.logo !== '') {
      return res.status(400).json({ success: false, error: 'No update data provided.' });
  }

  const updatedUniversity = await University.findByIdAndUpdate(universityId, { $set: updateData }, {
      new: true,
      runValidators: true
  }).populate('universityAdmins', 'name email profilePicUrl');


  if (!updatedUniversity) {
      return res.status(404).json({ success: false, error: `University not found during update.` });
  }

  if (updateData.logo && oldLogoPublicId && oldLogoPublicId !== updateData.logo.publicId) {
      cloudinary.uploader.destroy(oldLogoPublicId).catch(err => console.error("Cloudinary old logo delete error:", err));
  }

  console.log(`University ${universityId} updated successfully by system admin ${systemAdminId}`);
  res.status(200).json({ success: true, data: updatedUniversity });
};


/**
 * Deletes a university by its ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.universityId - ID of the university to delete
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with success message or error
 * @throws {Error} If university deletion fails
 */
exports.deleteUniversity = async (req, res, next) => {
    const { universityId } = req.params;

    const university = await University.findById(universityId);
    if (!university) {
        return res.status(404).json({ success: false, error: `University not found with ID: ${universityId}` });
    }

    await University.findByIdAndDelete(universityId);

    console.log(`University ${universityId} deleted successfully by admin ${req.user.id}`);

    res.status(200).json({ success: true, message: 'University deleted successfully.' });
};
