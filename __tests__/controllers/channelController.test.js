const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const channelController = require('../../controllers/channelController');
const Channel = require('../../models/Channel');
const User = require('../../models/User');
const University = require('../../models/University');

jest.mock('../../utils/cloudinaryUploader');
jest.mock('../../utils/fileUtils');
jest.mock('../../config/cloudinary');

// Mock cloudinary itself for the destroy method
jest.mock('cloudinary', () => ({
  v2: {
    uploader: {
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
    config: jest.fn(),
  },
}));

let mongoServer;
let testUniversity;
let testUserAdmin;
let testUserMember;

const setupTestUniversity = async (suffix = '') => {
  return await University.create({
    name: `Test University ${suffix}`,
    location: 'Test Location',
    website: 'https://testuniversity.edu',
    description: 'Test University Description',
  });
};

const setupTestUser = async (universityId, role = 'admin', emailSuffix = '') => {
  const timestamp = Date.now();
  return await User.create({
    name: `Test User ${role}${emailSuffix}`,
    email: `${role}${emailSuffix}${timestamp}@test.com`,
    password: 'password123',
    role: role,
    university: universityId,
    department: 'Computer Science',
    faculty: 'Engineering',
    studyLevel: 'undergraduate',
    gender: 'male',
    phoneNumber: '1234567890',
    isEmailVerified: true,
    accountStatus: 'active',
    profilePicUrl: {
      url: 'https://res.cloudinary.com/test/profile.jpg',
      publicId: 'profile_test_id'
    },
  });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    replSet: { storageEngine: 'wiredTiger' }, // Enable replica set for transactions
  });
  await mongoose.connect(mongoServer.getUri());

  testUniversity = await setupTestUniversity('main');
  testUserAdmin = await setupTestUser(testUniversity._id, 'admin', 'admin');
  testUserMember = await setupTestUser(testUniversity._id, 'student', 'member');
}, 30000); // Increased timeout to 30 seconds for setup

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Channel.deleteMany({});
  // No need to delete Users or Universities as they are created once in beforeAll
  jest.clearAllMocks();
});

describe('Channel Controller', () => {
  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('createChannel', () => {
    it('should create a new public channel successfully with a profile pic', async () => {
      const req = {
        user: { id: testUserAdmin._id, university: testUniversity._id },
        body: {
          name: 'Test Public Channel',
          description: 'A public channel for testing.',
          university: testUniversity._id,
          channelType: 'general',
          isPublic: true,
        },
        file: {
          buffer: Buffer.from('test_image_data'),
          originalname: 'test_image.jpg',
          mimetype: 'image/jpeg',
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      require('../../utils/cloudinaryUploader').mockResolvedValue({
        secure_url: 'http://test.com/new_channel_pic.jpg',
        public_id: 'new_channel_pic_id',
      });
      require('../../utils/fileUtils').getResourceTypeFromMime.mockReturnValue('image');

      await channelController.createChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          _id: expect.any(String),
          id: expect.any(String),
          admin: expect.objectContaining({
            _id: "684d64d5e14e720949e921cb",
            name: expect.any(String),
            profilePicUrl: expect.objectContaining({
              publicId: expect.any(String),
              url: expect.any(String),
            }),
          }),
          channelType: "general",
          createdAt: expect.any(String),
          description: expect.any(String),
          isPublic: true,
          memberCount: expect.any(Number),
          members: expect.arrayContaining(["684d64d5e14e720949e921cb"]),
          name: "Test Public Channel",
          profilePic: expect.objectContaining({
            publicId: "new_channel_pic_id",
            url: "http://test.com/new_channel_pic.jpg",
          }),
          university: expect.objectContaining({
            _id: expect.any(String),
            name: expect.any(String),
          }),
          updatedAt: expect.any(String),
          __v: expect.any(Number),
        }),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
      const req = {
        user: { id: testUserAdmin._id, university: testUniversity._id },
        body: {
          // name is missing
          description: 'A channel.',
          university: testUniversity._id,
          channelType: 'general',
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.createChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if university does not exist', async () => {
      const nonExistentUniversityId = new mongoose.Types.ObjectId();
      const req = {
        user: { id: testUserAdmin._id, university: nonExistentUniversityId },
        body: {
          name: 'Invalid University Channel',
          university: nonExistentUniversityId,
          channelType: 'general',
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.createChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('University not found'),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 409 if channel name already exists in the university', async () => {
      const existingChannelName = 'Existing Channel';
      await Channel.create({
        name: existingChannelName,
        university: testUniversity._id,
        channelType: 'general',
        admin: testUserAdmin._id,
        members: [testUserAdmin._id],
      });

      const req = {
        user: { id: testUserAdmin._id, university: testUniversity._id },
        body: {
          name: existingChannelName,
          university: testUniversity._id,
          channelType: 'general',
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.createChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('already exists'),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 if profile pic is not an image', async () => {
      const req = {
        user: { id: testUserAdmin._id, university: testUniversity._id },
        body: {
          name: 'Bad Image Channel',
          university: testUniversity._id,
          channelType: 'general',
        },
        file: {
          buffer: Buffer.from('test_document_data'),
          originalname: 'test_document.pdf',
          mimetype: 'application/pdf',
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      require('../../utils/fileUtils').getResourceTypeFromMime.mockReturnValue('document');

      await channelController.createChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('must be an image file'),
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getChannels', () => {
    let publicChannel;
    let privateChannel;
    let otherUniversityPublicChannel;
    let adminUser;
    let memberUser;

    beforeEach(async () => {
      // Create test data
      adminUser = testUserAdmin; 
      memberUser = testUserMember; 

      publicChannel = await Channel.create({
        name: 'General Public Channel',
        description: 'A public channel for everyone.',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id,
        members: [adminUser._id, memberUser._id],
      });

      privateChannel = await Channel.create({
        name: 'Private Department Channel',
        description: 'A private channel for department members.',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: false,
        admin: adminUser._id,
        members: [adminUser._id],
      });

      const otherUniversity = await University.create({
        name: 'Other University',
        location: 'Other Location',
        website: 'https://otheruni.edu',
        description: 'Another University',
      });

      otherUniversityPublicChannel = await Channel.create({
        name: 'Other Uni Public Channel',
        description: 'A public channel from another university.',
        university: otherUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id, 
        members: [adminUser._id],
      });
    }, 10000); // Added timeout for beforeEach

    // it('should return empty array if no channels match filter', async () => {
    //   const req = {
    //     user: { id: adminUser._id, university: testUniversity._id.toString() },
    //     query: { channelType: 'nonexistent' },
    //   };
    //   const res = mockResponse();
    //   const next = jest.fn();

    //   await channelController.getChannels(req, res, next);

    //   expect(res.status).toHaveBeenCalledWith(200);
    //   expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    //     success: true,
    //     data: [],
    //     count: 0,
    //     pagination: expect.objectContaining({ totalChannels: 0 }),
    //   }));
    //   expect(next).not.toHaveBeenCalled();
    // });

    it('should return 400 for invalid universityId format', async () => {
      const req = {
        user: { id: adminUser._id, university: testUniversity._id.toString() },
        query: { universityId: 'invalid_id_format' },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid University ID format'),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid channel type filter', async () => {
      const req = {
        user: { id: adminUser._id, university: testUniversity._id.toString() },
        query: { channelType: 'unallowedType' },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid channel type filter'),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should correctly populate admin and university fields', async () => {
      const req = {
        user: { id: adminUser._id, university: testUniversity._id.toString() },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: publicChannel.name,
            admin: expect.objectContaining({
              name: adminUser.name,
              profilePicUrl: expect.any(Object),
            }),
            university: expect.objectContaining({
              name: testUniversity.name,
            }),
          }),
        ]),
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getChannelById', () => {
    let channelToRetrieve;
    let privateChannelSameUni;
    let privateChannelOtherUni;
    let adminUser;
    let memberUser;
    let otherUniUser;

    beforeEach(async () => {
      adminUser = testUserAdmin;
      memberUser = testUserMember;
      const otherUniversity = await University.create({
        name: 'Other University for GetById',
        location: 'Other Location GetById',
        website: 'https://otherunigetbyid.edu',
        description: 'Another University GetById',
      });
      otherUniUser = await setupTestUser(otherUniversity._id, 'student', 'otheruni');

      channelToRetrieve = await Channel.create({
        name: 'Retrieve Me Channel',
        description: 'A channel to retrieve by ID.',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id,
        members: [adminUser._id, memberUser._id],
      });

      privateChannelSameUni = await Channel.create({
        name: 'Private Same Uni Channel',
        description: 'A private channel in the same university.',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: false,
        admin: adminUser._id,
        members: [adminUser._id],
      });

      privateChannelOtherUni = await Channel.create({
        name: 'Private Other Uni Channel',
        description: 'A private channel in another university.',
        university: otherUniversity._id,
        channelType: 'general',
        isPublic: false,
        admin: otherUniUser._id,
        members: [otherUniUser._id],
      });
    });

    it('should retrieve a public channel by ID successfully', async () => {
      const req = {
        params: { channelId: channelToRetrieve._id },
        user: { id: memberUser._id, university: testUniversity._id }, 
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannelById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: channelToRetrieve.name,
          _id: channelToRetrieve._id,
          university: expect.objectContaining({ _id: testUniversity._id }),
          admin: expect.objectContaining({ _id: adminUser._id }),
          isPublic: true,
          memberCount: 2,
        }),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should retrieve a private channel if user is a member', async () => {
      const req = {
        params: { channelId: privateChannelSameUni._id },
        user: { id: adminUser._id, university: testUniversity._id }, 
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannelById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          name: privateChannelSameUni.name,
          _id: privateChannelSameUni._id,
          isPublic: false,
        }),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not a member of a private channel', async () => {
      const req = {
        params: { channelId: privateChannelSameUni._id },
        user: { id: otherUniUser._id, university: otherUniUser.university }, 
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannelById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'You are not authorized to view this private channel.',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if channel not found', async () => {
      const nonExistentChannelId = new mongoose.Types.ObjectId();
      const req = {
        params: { channelId: nonExistentChannelId },
        user: { id: adminUser._id, university: testUniversity._id },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannelById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: `Channel not found with ID: ${nonExistentChannelId}`,
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getUserChannels', () => {
    let user1;
    let user2;
    let uni1;
    let uni2;
    let channel1;
    let channel2;
    let channel3;
    let channel4;

    beforeEach(async () => {
      uni1 = await setupTestUniversity('userChannels1');
      uni2 = await setupTestUniversity('userChannels2');

      user1 = await setupTestUser(uni1._id, 'student', 'user1');
      user2 = await setupTestUser(uni2._id, 'student', 'user2');

      channel1 = await Channel.create({ 
        name: 'User1 Public Uni1',
        university: uni1._id,
        channelType: 'general',
        isPublic: true,
        admin: user1._id,
        members: [user1._id],
      });

      channel2 = await Channel.create({ 
        name: 'User1 Private Uni1',
        university: uni1._id,
        channelType: 'general',
        isPublic: false,
        admin: user1._id,
        members: [user1._id],
      });

      channel3 = await Channel.create({ 
        name: 'Not Member Public Uni1',
        university: uni1._id,
        channelType: 'general',
        isPublic: true,
        admin: user2._id,
        members: [user2._id],
      });

      channel4 = await Channel.create({ 
        name: 'Not Member Public Uni2',
        university: uni2._id,
        channelType: 'general',
        isPublic: true,
        admin: user2._id,
        members: [user2._id],
      });
    }, 10000); 

    it('should return empty array if user is not a member of any channel', async () => {
      const newUser = await setupTestUser(uni1._id, 'student', 'no_channels');
      const req = {
        user: { id: newUser._id, university: uni1._id.toString() },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getUserChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [],
        count: 0,
        pagination: expect.objectContaining({ totalChannels: 0 }),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should correctly populate admin and university fields', async () => {
      const req = {
        user: { id: user1._id, university: uni1._id.toString() },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getUserChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: channel1.name,
            admin: expect.objectContaining({
              name: user1.name,
              profilePicUrl: expect.any(Object),
            }),
            university: expect.objectContaining({
              name: uni1.name,
            }),
          }),
        ]),
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getNonMemberChannels', () => {
    let user1;
    let user2;
    let uni1;
    let uni2;
    let channel1;
    let channel2;
    let channel3;
    let channel4;

    beforeEach(async () => {
      uni1 = await setupTestUniversity('nonMember1');
      uni2 = await setupTestUniversity('nonMember2');

      user1 = await setupTestUser(uni1._id, 'student', 'user1_nm');
      user2 = await setupTestUser(uni2._id, 'student', 'user2_nm');

      channel1 = await Channel.create({
        name: 'User1 Member Public Uni1',
        university: uni1._id,
        channelType: 'general',
        isPublic: true,
        admin: user1._id,
        members: [user1._id],
      });

      channel2 = await Channel.create({ 
        name: 'User1 Member Private Uni1',
        university: uni1._id,
        channelType: 'general',
        isPublic: false,
        admin: user1._id,
        members: [user1._id],
      });

      channel3 = await Channel.create({ 
        name: 'User1 NonMember Public Uni1',
        university: uni1._id,
        channelType: 'general',
        isPublic: true,
        admin: user2._id,
        members: [user2._id],
      });

      channel4 = await Channel.create({ 
        name: 'User1 NonMember Public Uni2',
        university: uni2._id,
        channelType: 'general',
        isPublic: true,
        admin: user2._id,
        members: [user2._id],
      });

      await Channel.create({
        name: 'User1 NonMember Private Uni1',
        university: uni1._id,
        channelType: 'course',
        isPublic: false,
        admin: user2._id,
        members: [user2._id],
      });

      
      await Channel.create({
        name: 'User1 NonMember Private Uni2',
        university: uni2._id,
        channelType: 'course',
        isPublic: false,
        admin: user2._id,
        members: [user2._id],
      });
    }, 10000); 

  });

  describe('updateChannel', () => {
    let channelToUpdate;
    let adminUser;
    let otherUser;

    beforeEach(async () => {
      adminUser = testUserAdmin;
      otherUser = testUserMember; 

      channelToUpdate = await Channel.create({
        name: 'Original Channel Name',
        description: 'Original description.',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id,
        members: [adminUser._id],
        profilePic: { url: 'http://original.pic/url.jpg', publicId: 'original_pic_id' },
      });
    });

    it('should return 404 if channel not found', async () => {
      const nonExistentChannelId = new mongoose.Types.ObjectId();
      const req = {
        params: { channelId: nonExistentChannelId },
        user: { id: adminUser._id },
        body: { name: 'Non Existent Update' },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.updateChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: `Channel not found with ID: ${nonExistentChannelId}`,
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 if profile pic is not an image during update', async () => {
      const req = {
        params: { channelId: channelToUpdate._id },
        user: { id: adminUser._id },
        body: {},
        file: {
          buffer: Buffer.from('invalid_data'),
          originalname: 'invalid.pdf',
          mimetype: 'application/pdf',
        },
      };
      const res = mockResponse();
      const next = jest.fn();

      require('../../utils/fileUtils').getResourceTypeFromMime.mockReturnValue('document');

      await channelController.updateChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('must be an image file'),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 if admin is not a member of the channel', async () => {
      const req = {
        params: { channelId: channelToUpdate._id },
        user: { id: adminUser._id },
        body: { admin: otherUser._id },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.updateChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Admin must be a member of the channel',
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('deleteChannel', () => {
    let channelToDelete;
    let adminUser;

    beforeEach(async () => {
      adminUser = testUserAdmin;
      channelToDelete = await Channel.create({
        name: 'Channel to Delete',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id,
        members: [adminUser._id],
      });
    });

    it('should delete a channel successfully', async () => {
      const req = {
        params: { channelId: channelToDelete._id },
        user: { id: adminUser._id }, 
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.deleteChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Channel deleted successfully.',
      }));
      const deletedChannel = await Channel.findById(channelToDelete._id);
      expect(deletedChannel).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if channel not found during deletion', async () => {
      const nonExistentChannelId = new mongoose.Types.ObjectId();
      const req = {
        params: { channelId: nonExistentChannelId },
        user: { id: adminUser._id },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.deleteChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: `Channel not found with ID: ${nonExistentChannelId}`,
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('joinChannel', () => {
    let publicChannel;
    let privateChannel;
    let memberUser;

    beforeEach(async () => {
      memberUser = testUserMember;
      publicChannel = await Channel.create({
        name: 'Public Join Channel',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: testUserAdmin._id,
        members: [testUserAdmin._id],
      });
      privateChannel = await Channel.create({
        name: 'Private Join Channel',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: false,
        admin: testUserAdmin._id,
        members: [testUserAdmin._id],
      });
    });

    it('should allow a user to join a public channel', async () => {
      const req = {
        params: { channelId: publicChannel._id },
        user: { id: memberUser._id, university: testUniversity._id.toString() },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.joinChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Successfully joined channel.',
      }));
      const updatedChannel = await Channel.findById(publicChannel._id);
      expect(updatedChannel.members).toContainEqual(memberUser._id);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow a user to join a private channel in the same university', async () => {
      const req = {
        params: { channelId: privateChannel._id },
        user: { id: memberUser._id, university: testUniversity._id.toString() },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.joinChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Successfully joined channel.',
      }));
      const updatedChannel = await Channel.findById(privateChannel._id);
      expect(updatedChannel.members).toContainEqual(memberUser._id);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user tries to join a private channel outside their university', async () => {
      const otherUniversity = await University.create({ name: 'Other Uni for Join' });
      const otherUniPrivateChannel = await Channel.create({
        name: 'Other Uni Private Channel',
        university: otherUniversity._id,
        channelType: 'general',
        isPublic: false,
        admin: testUserAdmin._id,
        members: [testUserAdmin._id],
      });

      const req = {
        params: { channelId: otherUniPrivateChannel._id },
        user: { id: memberUser._id, university: testUniversity._id.toString() }, 
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.joinChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Cannot join private channels outside your university.',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if channel not found during join', async () => {
      const nonExistentChannelId = new mongoose.Types.ObjectId();
      const req = {
        params: { channelId: nonExistentChannelId },
        user: { id: memberUser._id, university: testUniversity._id.toString() },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.joinChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: `Channel not found with ID: ${nonExistentChannelId}`,
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('leaveChannel', () => {
    let channelToLeave;
    let adminUser;
    let memberUser;

    beforeEach(async () => {
      adminUser = testUserAdmin;
      memberUser = testUserMember;
      channelToLeave = await Channel.create({
        name: 'Channel to Leave',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id,
        members: [adminUser._id, memberUser._id],
      });
    });

    it('should allow a user to leave a channel successfully', async () => {
      const req = {
        params: { channelId: channelToLeave._id },
        user: { id: memberUser._id },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.leaveChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Successfully left channel.',
      }));
      const updatedChannel = await Channel.findById(channelToLeave._id);
      expect(updatedChannel.members).not.toContainEqual(memberUser._id);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 if channel admin tries to leave directly', async () => {
      const req = {
        params: { channelId: channelToLeave._id },
        user: { id: adminUser._id }, 
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.leaveChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Channel admin cannot leave the channel directly. Transfer admin role first.',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if channel not found during leave', async () => {
      const nonExistentChannelId = new mongoose.Types.ObjectId();
      const req = {
        params: { channelId: nonExistentChannelId },
        user: { id: memberUser._id },
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.leaveChannel(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: `Channel not found with ID: ${nonExistentChannelId}`,
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getChannelMembers', () => {
    let testChannel;
    let adminUser;
    let memberUser;
    let nonMemberUser;

    beforeEach(async () => {
      adminUser = testUserAdmin;
      memberUser = testUserMember;
      nonMemberUser = await setupTestUser(testUniversity._id, 'student', 'nonmember');

      testChannel = await Channel.create({
        name: 'Test Members Channel',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: true,
        admin: adminUser._id,
        members: [adminUser._id, memberUser._id],
      });
    });

    it('should return 403 if user is not admin, not a member, and channel is private', async () => {
      const privateTestChannel = await Channel.create({
        name: 'Private Test Members Channel',
        university: testUniversity._id,
        channelType: 'general',
        isPublic: false,
        admin: adminUser._id,
        members: [adminUser._id],
      });

      const req = {
        params: { channelId: privateTestChannel._id },
        user: { id: nonMemberUser._id, role: 'student' },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannelMembers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Not authorized to view members of this channel.',
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if channel not found', async () => {
      const nonExistentChannelId = new mongoose.Types.ObjectId();
      const req = {
        params: { channelId: nonExistentChannelId },
        user: { id: adminUser._id, role: 'admin' },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.getChannelMembers(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: `Channel not found with ID: ${nonExistentChannelId}`,
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('searchChannels', () => {
    let user1;
    let uni1;
    let channel1;
    let channel2;
    let channel3;
    let privateChannel;

    beforeEach(async () => {
      uni1 = await setupTestUniversity('search');
      user1 = await setupTestUser(uni1._id, 'student', 'searchuser');

      channel1 = await Channel.create({
        name: 'Public Channel One',
        description: 'This is the first public channel.',
        university: uni1._id,
        channelType: 'general',
        isPublic: true,
        admin: user1._id,
        members: [user1._id],
      });

      channel2 = await Channel.create({
        name: 'Another Public Channel',
        description: 'A second public channel here.',
        university: uni1._id,
        channelType: 'general',
        isPublic: true,
        admin: user1._id,
        members: [],
      });

      channel3 = await Channel.create({
        name: 'Test Channel for Search',
        description: 'Contains keywords for search.',
        university: uni1._id,
        channelType: 'course',
        isPublic: true,
        admin: user1._id,
        members: [],
      });

      privateChannel = await Channel.create({
        name: 'Secret Private Channel',
        description: 'This is a private channel.',
        university: uni1._id,
        channelType: 'general',
        isPublic: false,
        admin: user1._id,
        members: [user1._id],
      });
    }, 10000);

    it('should return 400 if search query is missing or not a string', async () => {
      const req = {
        params: {},
        user: { id: user1._id },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.searchChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Search query must be a non-empty string'),
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return empty array if no search results', async () => {
      const req = {
        params: { query: 'nonexistentquery' },
        user: { id: user1._id },
        query: {},
      };
      const res = mockResponse();
      const next = jest.fn();

      await channelController.searchChannels(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [],
        count: 0,
        pagination: expect.objectContaining({ totalChannels: 0 }),
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
