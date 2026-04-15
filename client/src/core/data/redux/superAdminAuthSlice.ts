import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface SuperAdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface SuperAdminAuthState {
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  authChecked: boolean;
}

const initialState: SuperAdminAuthState = {
  user: null,
  isAuthenticated: false,
  authChecked: false,
};

const superAdminAuthSlice = createSlice({
  name: 'superAdminAuth',
  initialState,
  reducers: {
    setSuperAdminAuth: (state, action: PayloadAction<{ user: SuperAdminUser }>) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.authChecked = true;
    },
    setSuperAdminAuthFromSession: (state, action: PayloadAction<{ user: SuperAdminUser }>) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.authChecked = true;
    },
    setSuperAdminAuthChecked: (state) => {
      state.authChecked = true;
    },
    clearSuperAdminAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.authChecked = true;
    },
    /** Sync username/email from API after profile or password update (JWT may still carry old username until re-login). */
    patchSuperAdminProfile: (
      state,
      action: PayloadAction<{ username?: string; email?: string }>
    ) => {
      if (!state.user) return;
      if (action.payload.username != null) state.user.username = action.payload.username;
      if (action.payload.email != null) state.user.email = action.payload.email;
    },
  },
});

export const {
  setSuperAdminAuth,
  setSuperAdminAuthFromSession,
  setSuperAdminAuthChecked,
  clearSuperAdminAuth,
  patchSuperAdminProfile,
} = superAdminAuthSlice.actions;

export const selectSuperAdminUser = (state: { superAdminAuth: SuperAdminAuthState }) =>
  state.superAdminAuth.user;
export const selectSuperAdminIsAuthenticated = (state: { superAdminAuth: SuperAdminAuthState }) =>
  state.superAdminAuth.isAuthenticated;
export const selectSuperAdminAuthChecked = (state: { superAdminAuth: SuperAdminAuthState }) =>
  state.superAdminAuth.authChecked;

export default superAdminAuthSlice.reducer;

