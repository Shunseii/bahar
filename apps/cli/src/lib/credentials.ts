import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Credentials {
  token: string;
}

export type Keychain = Pick<typeof Bun.secrets, "get" | "set" | "delete">;

const KEYCHAIN_ENTRY = { service: "app.bahar.cli", name: "api-token" };

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

/**
 * Writes a file only the current user can read. The mode is set at creation so
 * the file is never briefly world-readable; chmod covers a file that already
 * existed with looser permissions.
 */
export const writePrivateFile = async ({
  path,
  contents,
}: {
  path: string;
  contents: string;
}): Promise<void> => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, contents, { mode: 0o600 });

  if (process.platform !== "win32") {
    await chmod(path, 0o600);
  }
};

const readCredentialsFile = async (): Promise<Credentials | null> => {
  const file = Bun.file(credentialsPath());

  if (!(await file.exists())) {
    return null;
  }

  return (await file.json()) as Credentials;
};

const deleteCredentialsFile = () => rm(credentialsPath(), { force: true });

/**
 * Stores the token in the OS keychain. Where there is none (SSH sessions,
 * containers, CI), falls back to a credentials file only the user can read.
 */
export const saveCredentials = async (
  credentials: Credentials,
  keychain: Keychain = Bun.secrets
): Promise<void> => {
  try {
    await keychain.set({ ...KEYCHAIN_ENTRY, value: credentials.token });
    await deleteCredentialsFile();
  } catch {
    await writePrivateFile({
      path: credentialsPath(),
      contents: JSON.stringify(credentials, null, 2),
    });
  }
};

/**
 * Reads the token from BAHAR_TOKEN, then the OS keychain, then the credentials
 * file. A token found in the file is moved into the keychain when one is
 * available, so logins from before the keychain was used migrate on first run.
 */
export const loadCredentials = async (
  keychain: Keychain = Bun.secrets
): Promise<Credentials | null> => {
  const envToken = process.env.BAHAR_TOKEN;
  if (envToken) {
    return { token: envToken };
  }

  let keychainAvailable = true;
  try {
    const token = await keychain.get(KEYCHAIN_ENTRY);
    if (token) {
      return { token };
    }
  } catch {
    keychainAvailable = false;
  }

  const credentials = await readCredentialsFile();

  if (credentials && keychainAvailable) {
    await saveCredentials(credentials, keychain);
  }

  return credentials;
};
