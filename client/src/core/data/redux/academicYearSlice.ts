import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

const STORAGE_KEY = 'preskool_selected_academic_year_id';

function getStoredId(): number | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

interface AcademicYearState {
  selectedId: number | null;
}

const initialState: AcademicYearState = {
  selectedId: getStoredId(),
};

const academicYearSlice = createSlice({
  name: 'academicYear',
  initialState,
  reducers: {
    setSelectedAcademicYear: (state, action: PayloadAction<number | null>) => {
      state.selectedId = action.payload;
      try {
        if (action.payload != null) {
          localStorage.setItem(STORAGE_KEY, String(action.payload));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    },
  },
});

export const { setSelectedAcademicYear } = academicYearSlice.actions;
export const selectSelectedAcademicYearId = (state: { academicYear: AcademicYearState }) =>
  state.academicYear.selectedId;
export default academicYearSlice.reducer;
