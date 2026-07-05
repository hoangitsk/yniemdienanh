import { createSlice } from "@reduxjs/toolkit";
import { lightTheme, darkTheme } from "../themes/theme";

const initialState = {
  mode: lightTheme,
};

export const theme = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setLightMode: (state) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.mode = lightTheme;
    },
    setDarkMode: (state) => {
      state.mode = darkTheme;
    },
  },
});

// Action creators are generated for each case reducer function
export const { setLightMode, setDarkMode } = theme.actions;

export default theme.reducer;
