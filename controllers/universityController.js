const University = require('../models/University');
const mongoose = require('mongoose');

exports.createUniversity = async (req, res, next) => {
    const { name, description, location, websiteUrl, logoUrl, contactEmail, contactPhone } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'University name is required.' });
    }

    const existingUniversity = await University.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (existingUniversity) {
        return res.status(409).json({ success: false, error: `University with name "${name}" already exists.` });
    }

    const universityData = {
        name: name.trim(),
        description: description?.trim(),
        location: location?.trim(),
        websiteUrl: websiteUrl?.trim(),
        logoUrl: logoUrl?.trim(),
        contactEmail: contactEmail?.trim().toLowerCase(),
        contactPhone: contactPhone?.trim()
    };

    const university = await University.create(universityData);

    console.log(`University '${university.name}' created successfully by admin ${req.user.id}`);

    res.status(201).json({
        success: true,
        data: university
    });
};

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

exports.getUniversityById = async (req, res, next) => {
    const { universityId } = req.params;

    const university = await University.findById(universityId).lean();

    if (!university) {
        return res.status(404).json({ success: false, error: `University not found with ID: ${universityId}` });
    }

    res.status(200).json({
        success: true,
        data: university
    });
};

exports.updateUniversity = async (req, res, next) => {
    const { universityId } = req.params;
    const { name, ...updateData } = req.body;

    let university = await University.findById(universityId);
    if (!university) {
        return res.status(404).json({ success: false, error: `University not found with ID: ${universityId}` });
    }

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return res.status(400).json({ success: false, error: 'University name cannot be empty.' });
        }

        if (university.name.toLowerCase() !== trimmedName.toLowerCase()) {
            const existingUniversity = await University.findOne({
                name: { $regex: `^${trimmedName}$`, $options: 'i' },
                _id: { $ne: universityId }
            });
            if (existingUniversity) {
                return res.status(409).json({ success: false, error: `University with name "${trimmedName}" already exists.` });
            }
        }

        updateData.name = trimmedName;
    }

     for (const key in updateData) {
         if (typeof updateData[key] === 'string') {
             updateData[key] = updateData[key].trim();
         }
     }

    const updatedUniversity = await University.findByIdAndUpdate(universityId, updateData, {
        new: true, 
        runValidators: true
    });

     if (!updatedUniversity) {
           return res.status(404).json({ success: false, error: `University not found during update for ID: ${universityId}` });
     }

    console.log(`University ${universityId} updated successfully by admin ${req.user.id}`);

    res.status(200).json({
        success: true,
        data: updatedUniversity
    });
};

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
