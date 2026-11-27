import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configDir,
  type Keychain,
  loadCredentials,
  saveCredentials,
  writePrivateFile,
} from "./credentials";

const memoryKeychain = (): Keychain & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  const key = ({ service, name }: { service: string; name: string }) =>
    `${service}/${name}`;

  return {
    values,
    get: async (options) => values.get(key(options)) ?? null,
    set: async (options) => {
      values.set(key(options), options.value);
    },
    delete: async (options) => values.delete(key(options)),
  };
};

const unavailableKeychain: Keychain = {
  get: () => Promise.reject(new Error("no secret service")),
  set: () => Promise.reject(new Error("no secret service")),
  delete: () => Promise.reject(new Error("no secret service")),
};

const permissions = async (path: string) =>
  (await stat(path)).mode.toString(8).slice(-3);

const credentialsFile = () => Bun.file(join(configDir(), "credentials.json"));

const restoreEnv = (name: string, value: string | undefined) => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
};

let tempHome: string;
const originalXdg = process.env.XDG_CONFIG_HOME;
const originalToken = process.env.BAHAR_TOKEN;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "bahar-cli-test-"));
  process.env.XDG_CONFIG_HOME = tempHome;
  Reflect.deleteProperty(process.env, "BAHAR_TOKEN");
});

afterEach(async () => {
  restoreEnv("XDG_CONFIG_HOME", originalXdg);
  restoreEnv("BAHAR_TOKEN", originalToken);
  await rm(tempHome, { recursive: true, force: true });
});

describe.skipIf(process.platform !== "linux")("credentials", () => {
  test("stores the token in the keychain and writes no file", async () => {
    const keychain = memoryKeychain();

    await saveCredentials({ token: "abc" }, keychain);

    expect(await loadCredentials(keychain)).toEqual({ token: "abc" });
    expect(await credentialsFile().exists()).toBe(false);
  });

  test("falls back to an owner-only file without a keychain", async () => {
    await saveCredentials({ token: "abc" }, unavailableKeychain);

    expect(await loadCredentials(unavailableKeychain)).toEqual({
      token: "abc",
    });
    expect(await permissions(join(configDir(), "credentials.json"))).toBe(
      "600"
    );
  });

  test("moves a token from an existing file into the keychain", async () => {
    await saveCredentials({ token: "old" }, unavailableKeychain);
    const keychain = memoryKeychain();

    expect(await loadCredentials(keychain)).toEqual({ token: "old" });
    expect([...keychain.values.values()]).toEqual(["old"]);
    expect(await credentialsFile().exists()).toBe(false);
  });

  test("prefers BAHAR_TOKEN over stored credentials", async () => {
    const keychain = memoryKeychain();
    await saveCredentials({ token: "stored" }, keychain);
    process.env.BAHAR_TOKEN = "from-env";

    expect(await loadCredentials(keychain)).toEqual({ token: "from-env" });
  });

  test("tightens permissions on a file that already existed", async () => {
    const path = join(configDir(), "db-info.json");
    await Bun.write(path, "{}");

    await writePrivateFile({ path, contents: "{}" });

    expect(await permissions(path)).toBe("600");
  });
});
