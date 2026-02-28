import { Polar } from "@polar-sh/sdk";
import { config } from "../utils/config";

export const polarClient = new Polar({
  accessToken: config.POLAR_ACCESS_TOKEN,
  server: config.NODE_ENV === "development" ? "sandbox" : "production",
});
