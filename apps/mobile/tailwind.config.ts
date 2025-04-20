import { Config } from "tailwindcss";
import sharedConfig from "@bahar/tailwind-config/tailwind.config";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), sharedConfig],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
