import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';

/**
 * Mock localStorage
 */
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

/**
 * Mock axios
 */
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    request: vi.fn(),
  },
}));

/**
 * Mock react-router-dom
 */
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
  };
});

/**
 * Clean up after each test
 */
afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

/**
 * Test fixtures - mock data
 */
export const MOCK_USER = {
  id: '1',
  email: 'admin@edificios.com',
  name: 'Admin User',
  role: {
    id: '1',
    name: 'ADMIN',
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const MOCK_OWNER_USER = {
  id: '2',
  email: 'owner@edificios.com',
  name: 'Owner User',
  role: {
    id: '2',
    name: 'PROPIETARIO',
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBlZGlmaWNpb3MuY29tIn0.8zZk7kH0Z6z0J1Z0J1Z0J1Z0J1Z0J1Z0J1Z0J1Z0';

export const MOCK_LOGIN_RESPONSE = {
  access_token: MOCK_TOKEN,
  token_type: 'bearer',
  user: MOCK_USER,
};

export const MOCK_OWNER_LOGIN_RESPONSE = {
  access_token: MOCK_TOKEN,
  token_type: 'bearer',
  user: MOCK_OWNER_USER,
};
