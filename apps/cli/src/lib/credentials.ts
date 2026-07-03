import { chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Credentials {
  token: string;
}

export const configDir = (): string => {
  if (process.platform === "win32") {
    return join(
      process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
      "bahar"
    );
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "bahar");
  }

  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "bahar"
  );
};

const credentialsPath = (): string => join(configDir(), "credentials.json");

export const saveCredentials = async (
  credentials: Credentials
): Promise<void> => {
  const path = credentialsPath();

  await Bun.write(path, JSON.stringify(credentials, null, 2));

  if (process.platform !== "win32") {
    await chmod(path, 0o600);
  }
};

export const loadCredentials = async (): Promise<Credentials | null> => {
  const file = Bun.file(credentialsPath());

  if (!(await file.exists())) {
    return null;
  }

  return (await file.json()) as Credentials;
};
