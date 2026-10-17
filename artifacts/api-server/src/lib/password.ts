import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const dummyPasswordSalt = Buffer.alloc(PASSWORD_SALT_BYTES, 0x5a);
const dummyPasswordHash = Buffer.alloc(PASSWORD_HASH_BYTES, 0xa5);

async function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_HASH_BYTES,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = await derivePassword(password, salt);
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function parseStoredPassword(encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, costText, blockText, parallelText, saltHex, hashHex] = parts;
  if (
    Number(costText) !== SCRYPT_COST
    || Number(blockText) !== SCRYPT_BLOCK_SIZE
    || Number(parallelText) !== SCRYPT_PARALLELIZATION
    || !/^[0-9a-f]{32}$/i.test(saltHex)
    || !/^[0-9a-f]{128}$/i.test(hashHex)
  ) {
    return null;
  }
  return {
    salt: Buffer.from(saltHex, "hex"),
    hash: Buffer.from(hashHex, "hex"),
  };
}

export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  const parsed = encoded ? parseStoredPassword(encoded) : null;
  const actual = await derivePassword(password, parsed?.salt ?? dummyPasswordSalt);
  return parsed !== null && timingSafeEqual(actual, parsed?.hash ?? dummyPasswordHash);
}
