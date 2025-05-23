require('dotenv').config();
const mongoose = require('mongoose');

console.log("Attempting to connect with URI:", process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => {
  console.error("❌ Connection failed:", err.message);
  console.log("\nDebugging Tips:");
  console.log("1. Check your internet connection");
  console.log("2. Verify password is correct");
  console.log("3. Ensure IP is whitelisted in Atlas");
  process.exit(1);
});