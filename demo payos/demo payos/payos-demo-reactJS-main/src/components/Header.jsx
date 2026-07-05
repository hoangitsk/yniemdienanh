import {
  Box,
  Button,
  Typography,
  IconButton,
  ThemeProvider,
  Drawer,
  ListItem,
  ListItemButton,
  ListItemText,
  List,
} from "@mui/material";
import styled from "styled-components";
import Logo from "../static/images/Logo";
import { useNavigate } from "react-router-dom";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import { useDispatch, useSelector } from "react-redux";
import { setLightMode, setDarkMode } from "../redux/theme";
import TelegramIcon from "@mui/icons-material/Telegram";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";

const StyledButton = styled(Button)`
  &:hover {
    background: none;
    opacity: 0.8;
  }
`;

const Header = () => {
  const [openDrawer, setOpenDrawer] = useState(false);
  const navigate = useNavigate();
  const theme = useSelector((state) => state.theme.mode);
  const dispatch = useDispatch();
  return (
    <ThemeProvider theme={theme}>
      <Box
        component={"div"}
        className="flex flex-row justify-between w-full px-2 py-1 shadow-md"
        sx={{ backgroundColor: "background.topBar" }}
      >
        <IconButton className="md:!hidden" onClick={() => setOpenDrawer(true)}>
          <MenuIcon />
        </IconButton>

        <Box component={"div"} className="flex-row gap-2 flex">
          <LogoButton theme={theme} />
          <Box component={"div"} className="hidden md:flex">
            <StyledButton
              disableRipple
              variant="raised"
              style={{ backgroundColor: "transparent" }}
              onClick={() => (window.location.href = "https://payos.vn/")}
            >
              <Typography
                className="text-base font-thin  pt-2 normal-case hover:text-green-800	"
                sx={{ color: "color.default" }}
              >
                Docs
              </Typography>
            </StyledButton>

            <StyledButton
              disableRipple
              variant="raised"
              style={{ backgroundColor: "transparent" }}
              onClick={() =>
                (window.location.href = "https://payos.vn/docs/downloads/")
              }
            >
              <Typography className="text-base font-thin  pt-2 normal-case hover:text-green-800	">
                Downloads
              </Typography>
            </StyledButton>
            <StyledButton
              disableRipple
              variant="raised"
              style={{ backgroundColor: "transparent" }}
              onClick={() => navigate("/")}
            >
              <Typography
                className="text-base font-thin  pt-2 normal-case text-green-800"
                secondary
              >
                Sample & Demo
              </Typography>
            </StyledButton>
          </Box>
        </Box>
        <Box component={"div"} className="gap-3 flex flex-row items-center">
          <Box className="hidden md:inline-flex">
            <IconButton
              aria-label="theme"
              color="default"
              onClick={() =>
                (window.location.href = "https://t.me/+rIPftr5wgHY3ODQ9")
              }
            >
              <TelegramIcon />
            </IconButton>
          </Box>

          <Button
            variant="contained"
            className="!normal-case p-1 h-9"
            color="primary"
            onClick={() => (window.location.href = "https://my.payos.vn/login")}
            endIcon={
              <svg
                width="13.5"
                height="13.5"
                aria-hidden="true"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M21 13v10h-21v-19h12v2h-10v15h17v-8h2zm3-12h-10.988l4.035 4-6.977 7.07 2.828 2.828 6.977-7.07 4.125 4.172v-11z"
                ></path>
              </svg>
            }
          >
            Đăng nhập
          </Button>
          <Box className="hidden md:inline-flex">
            <ThemeButton theme={theme} />
          </Box>
        </Box>
        <Drawer
          anchor={"left"}
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
        >
          <Box component={"div"} className="h-full">
            <Box component={"div"} className="flex flex-row gap-2">
              <LogoButton theme={theme} />
              <IconButton
                aria-label="theme"
                color="default"
                onClick={() =>
                  (window.location.href = "https://t.me/+rIPftr5wgHY3ODQ9")
                }
              >
                <TelegramIcon />
              </IconButton>
              <ThemeButton theme={theme} />
              <IconButton onClick={() => setOpenDrawer(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
            <Box>
              <List>
                <ListItem disablePadding className="p-2">
                  <ListItemButton
                    className="!rounded-lg overflow-hidden"
                    onClick={() => (window.location.href = "https://payos.vn/")}
                  >
                    <ListItemText primary={"Docs"} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding className="p-2">
                  <ListItemButton
                    className="!rounded-lg overflow-hidden"
                    onClick={() =>
                      (window.location.href =
                        "https://payos.vn/docs/downloads/")
                    }
                  >
                    <ListItemText primary={"Downloads"} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding className="p-2">
                  <ListItemButton
                    className="!rounded-lg overflow-hidden"
                    sx={{ backgroundColor: "button.active" }}
                  >
                    <ListItemText
                      secondary={"Sample & Demo"}
                      onClick={() => setOpenDrawer(false)}
                    />
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>
          </Box>
        </Drawer>
      </Box>
    </ThemeProvider>
  );
};
const LogoButton = ({ theme }) => (
  <StyledButton
    disableRipple
    variant="raised"
    style={{ backgroundColor: "transparent" }}
    className="hover:bg-white"
    onClick={() => (window.location.href = "https://payos.vn/")}
  >
    <Logo
      height={38}
      width={100}
      fill={theme.palette.mode === "light" ? "#6655FF" : "white"}
    />
  </StyledButton>
);

const ThemeButton = ({ theme }) => {
  {
    const dispatch = useDispatch();

    if (theme.palette.mode === "light")
      return (
        <IconButton
          aria-label="theme"
          color="primary"
          onClick={() => dispatch(setDarkMode())}
        >
          <WbSunnyOutlinedIcon />
        </IconButton>
      );
    return (
      <IconButton
        aria-label="theme"
        color="primary"
        onClick={() => dispatch(setLightMode())}
      >
        <DarkModeOutlinedIcon />
      </IconButton>
    );
  }
};
export default Header;
