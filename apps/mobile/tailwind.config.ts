import { Config } from "tailwindcss";
import webConfig from "../web/tailwind.config";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), webConfig],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
