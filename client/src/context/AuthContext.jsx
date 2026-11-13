import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api';

const AuthContext = createContext(null);

// Who is logged in, shared with the whole app: { user, checking, login, register, logout }
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // While true we're still checking a saved login, so pages shouldn't redirect to /login yet
  const [checking, setChecking] = useState(() => Boolean(api.getToken()));

  useEffect(() => {
    // If any request comes back 401, drop the user → protected pages send them to /login
    api.setUnauthorizedHandler(() => setUser(null));

    if (!api.getToken()) return;
    api
      .getMe()
      .then(setUser)
      .catch(() => api.clearToken())
      .finally(() => setChecking(false));
  }, []);

  const finishLogin = ({ token, user }) => {
    api.setToken(token);
    setUser(user);
    return user;
  };

  const value = {
    user,
    checking,
    isAdmin: user?.role === 'admin',
    login: async (email, password) => finishLogin(await api.login(email, password)),
    // Creating an account doesn't log you in: the customer logs in on the next page
    register: async (data) => (await api.register(data)).user,
    // After editing "My account", show the new name/email everywhere
    updateUser: setUser,
    logout: () => {
      api.clearToken();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
