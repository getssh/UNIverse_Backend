const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authController = require('../../controllers/authController');
const User = require('../../models/User');
const University = require('../../models/University');

jest.mock('../../utils/emailSender');
jest.mock('../../utils/cloudinaryUploader');
jest.mock('../../utils/ocrUtils');

let mongoServer;
let testUniversity;

const setupTestUniversity = async () => {
  return await University.create({
    name: 'Test University',
    location: 'Test Location',
    website: 'https://testuniversity.edu',
    description: 'Test University Description'
  });
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await University.deleteMany({});
  testUniversity = await setupTestUniversity();
  jest.clearAllMocks();
});

describe('Auth Controller', () => {
  describe('registerUser', () => {
    let mockRequest;

    beforeEach(() => {
      mockRequest = {
        body: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'student',
          university: testUniversity._id.toString(),
          department: 'Computer Science',
          faculty: 'Engineering',
          studyLevel: 'undergraduate',
          gender: 'male',
          phoneNumber: '1234567890'
        },
        files: {
          profilePic: [{
            buffer: Buffer.from('test'),
            originalname: 'test.jpg'
          }],
          idCard: [{
            buffer: Buffer.from('test'),
            originalname: 'test.jpg'
          }]
        }
      };
    });

    const mockResponse = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      res.cookie = jest.fn().mockReturnValue(res);
      return res;
    };

    it('should register a new user successfully', async () => {
      const res = mockResponse();
      const next = jest.fn();

      require('../../utils/cloudinaryUploader').mockImplementation(() => ({
        secure_url: 'https://test.com/image.jpg',
        public_id: 'test_id'
      }));

      require('../../utils/ocrUtils').analyzeIdCardWithOCR.mockResolvedValue('student id card');

      await authController.registerUser(mockRequest, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.any(String)
      }));
    });

    it('should return error if required fields are missing', async () => {
      const res = mockResponse();
      const next = jest.fn();

      const invalidRequest = {
        body: {
          name: 'Test User'
        },
        files: mockRequest.files
      };

      await authController.registerUser(invalidRequest, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });
  });

  describe('loginUser', () => {
    const mockRequest = {
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    };

    const mockResponse = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      res.cookie = jest.fn().mockReturnValue(res);
      return res;
    };

    beforeEach(async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'student',
        university: testUniversity._id,
        department: 'Computer Science',
        faculty: 'Engineering',
        studyLevel: 'undergraduate',
        gender: 'male',
        phoneNumber: '1234567890',
        isEmailVerified: true,
        accountStatus: 'active',
        profilePicUrl: {
          url: 'https://test.com/profile.jpg',
          publicId: 'test_profile_id'
        }
      });
    });

    it('should login user successfully', async () => {
      const res = mockResponse();
      const next = jest.fn();

      await authController.loginUser(mockRequest, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        token: expect.any(String),
        user: expect.objectContaining({
          email: 'test@example.com',
          role: 'student'
        })
      }));
    });

    it('should return error for invalid credentials', async () => {
      const res = mockResponse();
      const next = jest.fn();

      const invalidRequest = {
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      };

      await authController.loginUser(invalidRequest, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Invalid credentials'
      }));
    });
  });

  describe('verifyEmail', () => {
    const mockResponse = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      res.redirect = jest.fn().mockReturnValue(res);
      return res;
    };

    it('should verify email successfully', async () => {
      const res = mockResponse();
      const next = jest.fn();

      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'student',
        university: testUniversity._id,
        department: 'Computer Science',
        faculty: 'Engineering',
        studyLevel: 'undergraduate',
        gender: 'male',
        phoneNumber: '1234567890',
        verificationToken: 'hashed_token',
        verificationTokenExpires: Date.now() + 3600000,
        profilePicUrl: {
          url: 'https://test.com/profile.jpg',
          publicId: 'test_profile_id'
        }
      });

      const mockRequest = {
        params: {
          token: 'valid_token'
        }
      };

      jest.spyOn(require('crypto'), 'createHash').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashed_token')
      });

      await authController.verifyEmail(mockRequest, res, next);

      expect(res.redirect).toHaveBeenCalled();
    });

    it('should return error for invalid token', async () => {
      const res = mockResponse();
      const next = jest.fn();

      const mockRequest = {
        params: {
          token: 'invalid_token'
        }
      };

      await authController.verifyEmail(mockRequest, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });
  });
});
