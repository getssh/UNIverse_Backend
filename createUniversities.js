const mongoose = require('mongoose');
const University = require('./models/University'); // Adjust path as needed
require('dotenv').config();

// Sample university data
const universities = [
  {
    name: "Addis Ababa University",
    description: "Premier higher education institution in Ethiopia, established in 1950.",
    location: "Addis Ababa, Ethiopia",
    websiteUrl: "https://www.aau.edu.et",
    contactEmail: "info@aau.edu.et",
    contactPhone: "+251111239975",
    status: "active"
  },
  {
    name: "Hawassa University",
    description: "Comprehensive university located in Hawassa, Southern Ethiopia.",
    location: "Hawassa, Ethiopia",
    websiteUrl: "https://www.hu.edu.et",
    contactEmail: "info@hu.edu.et",
    contactPhone: "+251462205064",
    status: "active"
  },
  {
    name: "Bahir Dar University",
    description: "Leading university in the Amhara region with strong engineering programs.",
    location: "Bahir Dar, Ethiopia",
    websiteUrl: "https://www.bdu.edu.et",
    contactEmail: "info@bdu.edu.et",
    contactPhone: "+251582205064",
    status: "active"
  },
  // Add more universities as needed
  {
    name: "Mekelle University",
    description: "Prominent university in northern Ethiopia with diverse academic programs.",
    location: "Mekelle, Ethiopia",
    websiteUrl: "https://www.mu.edu.et",
    contactEmail: "info@mu.edu.et",
    contactPhone: "+251344405064",
    status: "active"
  },
  {
    name: "Jimma University",
    description: "Recognized for its medical and health science programs.",
    location: "Jimma, Ethiopia",
    websiteUrl: "https://www.ju.edu.et",
    contactEmail: "info@ju.edu.et",
    contactPhone: "+251471110064",
    status: "active"
  }
];

async function createUniversities() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB')
    const created = await University.insertMany(universities);
    console.log(`Successfully created ${created.length} universities:`);
    created.forEach(u => console.log(`- ${u.name} (${u._id})`));

  } catch (error) {
    console.error('Error creating universities:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createUniversities();