import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { User, UserSettings } from "@shared/types/user";
import api from "@/services/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    user: null,
    token: localStorage.getItem("token"),
    isLoading: true,

    login: async (email, password) => {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.data.token);
      set((state) => {
        state.user = data.data.user;
        state.token = data.data.token;
      });
    },

    signup: async (username, email, password) => {
      const { data } = await api.post("/auth/signup", { username, email, password });
      localStorage.setItem("token", data.data.token);
      set((state) => {
        state.user = data.data.user;
        state.token = data.data.token;
      });
    },

    logout: async () => {
      try {
        await api.post("/auth/logout");
      } catch {
        // ignore — clear local state regardless
      }
      localStorage.removeItem("token");
      set((state) => {
        state.user = null;
        state.token = null;
      });
    },

    updateSettings: async (settings) => {
      const { data } = await api.patch("/user/settings", settings);
      set((state) => {
        if (state.user) {
          state.user.settings = { ...state.user.settings, ...data.data.settings };
        }
      });
    },

    checkAuth: async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          set((state) => { state.isLoading = false; });
          return;
        }
        const { data } = await api.get("/auth/me");
        set((state) => {
          state.user = data.data;
          state.isLoading = false;
        });
      } catch {
        localStorage.removeItem("token");
        set((state) => {
          state.user = null;
          state.token = null;
          state.isLoading = false;
        });
      }
    },
  }))
);
