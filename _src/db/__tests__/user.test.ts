import { UserModel, UserNotFoundError, AuthenticationError } from '../models/user';

// Mock bcrypt to make tests deterministic and fast
jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed_password')),
  compare: jest.fn((plaintext, hash) => Promise.resolve(plaintext === 'correct_password'))
}));

describe('UserModel', () => {
  let testUser: { id: string; username: string };

  beforeEach(async () => {
    // Create a test user before each test with unique username to avoid conflicts
    testUser = await UserModel.create('testuser_user', 'password123');
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      // Act
      const user = await UserModel.create('newuser', 'password123');
      
      // Assert
      expect(user).toBeDefined();
      expect(user.username).toBe('newuser');
    });

    it('should generate a UUID for new users', async () => {
      // Act
      const user = await UserModel.create('uuiduser', 'password123');
      
      // Assert
      expect(user.id).toBeDefined();
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('findByUsername', () => {
    it('should find a user by username', async () => {
      // Act
      const user = await UserModel.findByUsername('testuser_user');
      
      // Assert
      expect(user).toBeDefined();
      expect(user?.username).toBe('testuser_user');
    });

    it('should return null if user not found', async () => {
      // Act
      const user = await UserModel.findByUsername('nonexistentuser');
      
      // Assert
      expect(user).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find a user by ID', async () => {
      // Act
      const user = await UserModel.findById(testUser.id);
      
      // Assert
      expect(user).toBeDefined();
      expect(user.id).toBe(testUser.id);
    });

    it('should throw UserNotFoundError if user not found', async () => {
      // Act & Assert
      // Using an actual valid-looking UUID format
      await expect(UserModel.findById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      // First create a user that we can verify
      await UserModel.create('password_test_user', 'correct_password');
      
      // Get the full user record including password_hash
      const fullUser = await UserModel.findByUsername('password_test_user');
      
      // Act
      const result = await UserModel.verifyPassword(fullUser!, 'correct_password');
      
      // Assert
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      // First create a user that we can verify
      await UserModel.create('password_test_user2', 'correct_password');
      
      // Get the full user record including password_hash  
      const fullUser = await UserModel.findByUsername('password_test_user2');
      
      // Act 
      // The mock bcrypt.compare will return false for anything except 'correct_password'
      const result = await UserModel.verifyPassword(fullUser!, 'wrong_password');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should update password and password_changed_at timestamp', async () => {
      // Initial timestamp
      const user = await UserModel.findById(testUser.id);
      const initialPasswordChangedAt = new Date(user.password_changed_at).getTime();
      
      // Wait a bit to ensure timestamps will be different
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Act
      const updatedUser = await UserModel.changePassword(testUser.id, 'newpassword');
      
      // Assert
      expect(updatedUser).toBeDefined();
      
      // Get latest user data
      const afterUser = await UserModel.findById(testUser.id);
      const newPasswordChangedAt = new Date(afterUser.password_changed_at).getTime();
      
      // Assert password_changed_at has been updated
      expect(newPasswordChangedAt).toBeGreaterThan(initialPasswordChangedAt);
    });

    it('should throw UserNotFoundError if user not found', async () => {
      // Act & Assert
      await expect(UserModel.changePassword('00000000-0000-0000-0000-000000000000', 'newpass')).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('authenticate', () => {
    it('should authenticate user with correct credentials', async () => {
      // Create a special test user for this test
      await UserModel.create('auth_test_user', 'password');
      
      // Mock the verifyPassword method to return true
      jest.spyOn(UserModel, 'verifyPassword').mockResolvedValue(true);
      
      // Act
      const user = await UserModel.authenticate('auth_test_user', 'correct_password');
      
      // Assert
      expect(user).toBeDefined();
      expect(user?.username).toBe('auth_test_user');
    });

    it('should return null with incorrect credentials', async () => {
      // Create a special test user for this test
      await UserModel.create('auth_test_user2', 'password');
      
      // Mock the verifyPassword method to return false
      jest.spyOn(UserModel, 'verifyPassword').mockResolvedValue(false);
      
      // Act
      const user = await UserModel.authenticate('auth_test_user2', 'wrong_password');
      
      // Assert
      expect(user).toBeNull();
    });

    it('should return null if user not found', async () => {
      // Act
      const user = await UserModel.authenticate('nonexistentuser', 'password');
      
      // Assert
      expect(user).toBeNull();
    });
  });

  describe('toDTO', () => {
    it('should convert User to UserDTO by removing sensitive information', async () => {
      // Arrange
      const user = await UserModel.findByUsername('testuser_user');
      
      // Act
      const userDTO = UserModel.toDTO(user!);
      
      // Assert
      expect(userDTO).toBeDefined();
      expect(userDTO.username).toBe('testuser_user');
      expect(userDTO.id).toBe(user!.id);
      expect((userDTO as any).password_hash).toBeUndefined();
    });
  });
});