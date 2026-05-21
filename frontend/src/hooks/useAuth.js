import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export function useAuth() {
  return useContext(AuthContext);
}

// Re-export for backward compatibility
export { AuthProvider } from './AuthProvider';
export { AuthContext };
