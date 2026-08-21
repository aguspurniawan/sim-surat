import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IUser, RoleName } from '../types';

interface AuthState {
  user: IUser | null;
  token: string | null;
  isAuthenticated: boolean;

  setUser: (user: IUser | null, token?: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: RoleName[]) => boolean;
}

const DEMO_USERS: Array<IUser & { password: string }> = [
  {
    id: 'usr-1',
    username: 'admin',
    password: 'admin123',
    fullName: 'Sekretariat RS',
    email: 'admin@rssbk.co.id',
    role: RoleName.SUPER_ADMIN,
    unitCode: 'IT',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-2',
    username: 'sekretariat',
    password: 'password123',
    fullName: 'Sekretariat RS',
    email: 'sekretariat@rssbk.co.id',
    role: RoleName.SEKRETARIAT,
    unitCode: 'SEK',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-3',
    username: 'direktur',
    password: 'password123',
    fullName: 'dr. H. Budi Santoso, Sp.A (Direktur)',
    email: 'direktur@rssbk.co.id',
    role: RoleName.PIMPINAN,
    unitCode: 'ADM',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-4',
    username: 'staff',
    password: 'password123',
    fullName: 'Staff Administrasi',
    email: 'staff@rssbk.co.id',
    role: RoleName.STAFF,
    unitCode: 'ADM',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user, token) => {
        set({
          user,
          token: token ?? get().token,
          isAuthenticated: !!user,
        });
      },

      login: async (
        username: string,
        password: string
      ) => {
        if (!username?.trim() || !password) {
          throw new Error(
            'Username dan kata sandi wajib diisi.'
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 900)
        );

        const cleanUsername =
          username.trim().toLowerCase();

        const match = DEMO_USERS.find(
          (u) =>
            u.username.toLowerCase() ===
            cleanUsername
        );

        if (
          !match ||
          match.password !== password
        ) {
          throw new Error(
            'Username atau kata sandi salah. Periksa kembali kredensial Anda.'
          );
        }

        if (!match.isActive) {
          throw new Error(
            'Akun Anda dinonaktifkan. Hubungi administrator sistem.'
          );
        }

        const {
          password: _password,
          ...authenticatedUser
        } = match;

        set({
          user: authenticatedUser,
          token: 'demo-jwt-token',
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('token');

        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      hasRole: (roles: RoleName[]) => {
        const currentUser = get().user;

        if (!currentUser) {
          return false;
        }

        if (
          currentUser.role ===
          RoleName.SUPER_ADMIN
        ) {
          return true;
        }

        return roles.includes(
          currentUser.role
        );
      },
    }),
    {
      name: 'rssbk-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated:
          state.isAuthenticated,
      }),
    }
  )
);