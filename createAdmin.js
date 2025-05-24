require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const University = require('./models/University');

async function createAdmin() {
  // Validate environment variables
  if (!process.env.MONGO_URI) {
    console.error('❌ Error: MONGO_URI is not defined in .env file');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');

    // Admin details - customize these as needed
    const adminData = {
      name: 'System Admin',
      email: 'taberihun02@gmail.com',
      password: 'SecureAdmin123!',
      role: 'admin',
      university: "682f9591d21bd9a1327b78cc", 
      gender: 'male',
      department: 'Administration',
      isEmailVerified: true,
      accountStatus: 'active',
      verified: true
    };

    // Verify university exists
    const university = await University.findById(adminData.university);
    if (!university) {
      console.error(`❌ Error: University with ID ${adminData.university} not found`);
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log(`⚠️  Admin with email ${adminData.email} already exists`);
      console.log('To update this user, please use the admin panel');
      return;
    }

    // Start a session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create new admin
      const admin = new User(adminData);
      await admin.save({ session });

      // Add admin to university's admin list if not already there
      if (!university.universityAdmins.includes(admin._id)) {
        university.universityAdmins.push(admin._id);
        await university.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      console.log('\n🎉 Admin created successfully!');
      console.log('--------------------------------');
      console.log(`Name: ${admin.name}`);
      console.log(`Email: ${admin.email}`);
      console.log(`Password: ${adminData.password}`);
      console.log(`University: ${university.name} (Admin assigned)`);
      console.log('--------------------------------');
      console.log('⚠️  IMPORTANT: Change this password immediately after first login');

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
    if (error.name === 'ValidationError') {
      Object.values(error.errors).forEach(err => {
        console.error(`- ${err.path}: ${err.message}`);
      });
    }
  } finally {
    await mongoose.disconnect().catch(err => {
      console.error('Error disconnecting:', err.message);
    });
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdmin();