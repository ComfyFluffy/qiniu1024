import "~/styles/globals.css";

import { Inter } from "next/font/google";
import { headers } from "next/headers";

import { TRPCReactProvider } from "~/trpc/react";
import { Box, Stack } from "@mui/joy";
import { ThemeRegistry } from "./_components/theme-registry";
import { Flex } from "./_components/flex";
import { AppBar } from "./_components/app-bar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Create T3 App",
  description: "Generated by create-t3-app",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable}`}>
        <TRPCReactProvider headers={headers()}>
          <ThemeRegistry>
            <Stack
              sx={{
                height: "100vh",
              }}
            >
              <AppBar />
              <Flex
                sx={{
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                  }}
                >
                  {children}
                </Box>
              </Flex>
            </Stack>
          </ThemeRegistry>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
