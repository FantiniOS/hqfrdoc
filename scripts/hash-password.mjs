#!/usr/bin/env node
/**
 * Gera o hash scrypt para HQ_ADMIN_PASSWORD_HASH.
 *
 * Uso:
 *   npm run hash-password
 *   node scripts/hash-password.mjs "SuaSenhaForteAqui"
 */

import crypto from "node:crypto";
import readline from "node:readline";

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
    .toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

function askPasswordInteractive() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Digite a senha do proprietário FRdoc HQ: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const argPassword = process.argv[2];
  const password = (argPassword ?? (await askPasswordInteractive())).trim();

  if (!password || password.length < 8) {
    console.error(
      "\nErro: informe uma senha com pelo menos 8 caracteres.\nExemplo: node scripts/hash-password.mjs \"MinhaSenhaForte!2026\"\n"
    );
    process.exit(1);
  }

  const hash = hashPassword(password);
  const suggestedJwtSecret = crypto.randomBytes(48).toString("hex");
  const suggestedCronSecret = crypto.randomBytes(32).toString("hex");

  console.log("\n=== FRdoc HQ — Credenciais Geradas ===\n");
  console.log("Cole no seu .env e nas Environment Variables da Vercel:\n");
  console.log(`HQ_ADMIN_PASSWORD_HASH="${hash}"`);
  console.log("\nSugestões opcionais de segredos aleatórios (se ainda não tiver):");
  console.log(`HQ_JWT_SECRET="${suggestedJwtSecret}"`);
  console.log(`CRON_SECRET="${suggestedCronSecret}"`);
  console.log(
    "\nFormato seguro sem cifrões ($) — funciona direto no .env local e nas Environment Variables da Vercel sem escape.\n"
  );
}

main().catch((err) => {
  console.error("Falha ao gerar hash:", err);
  process.exit(1);
});
