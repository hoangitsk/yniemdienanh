import { Provider } from "react-redux";
import { store } from "./redux/store";
import DemoPayOS from "./pages/DemoPayOS";
import Result from "./pages/Result";
import { Box, Drawer, ThemeProvider } from "@mui/material";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useSelector } from "react-redux";
import Payment from "./pages/Payment";
function App() {
  return (
    <Provider store={store}>
      <Routes />
    </Provider>
  );
}
const router = createBrowserRouter([
  {
    path: "/",
    element: <DemoPayOS />,
  },
  {
    path: "/payment",
    element: <Payment />,
  },
  {
    path: "/result",
    element: <Result />,
  },
]);

const Routes = () => {
  const theme = useSelector((state) => state.theme.mode);
  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          bgcolor: "background.default",
          color: "text.primary",
          minHeight: "100vh",
        }}
        component={"div"}
      >
        <RouterProvider router={router} />
      </Box>
    </ThemeProvider>
  );
};

export default App;
