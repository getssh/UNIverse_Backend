require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const emailToUse = 'admin3@gmail.com';
    const existingUser = await User.findOne({ email: emailToUse });

    if (existingUser) {
      console.log(`❌ User with email ${emailToUse} already exists`);
      return;
    }

    const admin = new User({
      name: 'four Admin',
      email: emailToUse,
      password: 'admin123',  // ✅ plain password; will be hashed by pre-save hook
      role: 'admin',
      university: "6820dbc5981df302da754641",
      isEmailVerified: true,
      accountStatus: 'active'
    });

    await admin.save();
    console.log('✅ New admin created successfully!');
    console.log(`Email: ${emailToUse}\nPassword: admin123`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
