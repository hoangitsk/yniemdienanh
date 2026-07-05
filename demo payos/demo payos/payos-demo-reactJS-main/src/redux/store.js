import { configureStore } from "@reduxjs/toolkit";
import theme from "./theme";

export const store = configureStore({
  reducer: { theme: theme },
});
