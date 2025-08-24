import { Config } from "tailwindcss";
import sharedConfig from "@bahar/design-system/tailwind.config";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), sharedConfig],
  darkMode: "class",
  theme: {
    extend: {
      // TODO: remove this once nativewind supports calc with mixed units
      borderRadius: {
        lg: "0.75rem", // Same as --radius (0.75rem)
        md: "0.55rem", // --radius minus 2px (0.75rem - 2px)
        sm: "0.35rem", // --radius minus 4px (0.75rem - 4px)
      },
    },
  },
  plugins: [],
} satisfies Config;
