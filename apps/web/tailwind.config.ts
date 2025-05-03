import { Config } from "tailwindcss";
import sharedConfig from "@bahar/design-system/tailwind.config";

const config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  presets: [sharedConfig],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;

export default config;
