import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();
const RECOVERY_AAD_PREFIX = "OANIX:vault-recovery:v1:";
const RECENT_OTP_SECONDS = 10 * 60;
const VAULT_BOOTSTRAP_KEY = "vault-bootstrap-v1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function hexToBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("Hex inválido.");
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let different = 0;
  for (let index = 0; index < left.length; index += 1) different |= left[index] ^ right[index];
  return different === 0;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token inválido.");
  const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
}

function requireRecentOtp(token: string) {
  const payload = decodeJwtPayload(token);
  const amr = Array.isArray(payload.amr) ? payload.amr : [];
  const latest = amr
    .filter((entry): entry is { method: string; timestamp: number } => Boolean(
      entry && typeof entry === "object" &&
      typeof (entry as { method?: unknown }).method === "string" &&
      typeof (entry as { timestamp?: unknown }).timestamp === "number"
    ))
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const now = Math.floor(Date.now() / 1000);
  if (!latest || latest.method !== "otp" || now - latest.timestamp > RECENT_OTP_SECONDS || latest.timestamp > now + 60) {
    throw new Error("La recuperación requiere un código de correo verificado recientemente.");
  }
}

async function importRecoveryRoot(secret: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", secret, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptVaultKey(root: CryptoKey, userId: string, vaultKey: Uint8Array): Promise<string> {
  if (vaultKey.byteLength !== 32) throw new Error("Clave de bóveda inválida.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`${RECOVERY_AAD_PREFIX}${userId}`) },
    root,
    vaultKey,
  );
  return JSON.stringify({ version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) });
}

async function decryptVaultKey(root: CryptoKey, userId: string, envelopeText: string): Promise<Uint8Array> {
  const envelope = JSON.parse(envelopeText) as { version?: unknown; iv?: unknown; ciphertext?: unknown };
  if (envelope.version !== 1 || typeof envelope.iv !== "string" || typeof envelope.ciphertext !== "string") {
    throw new Error("Envoltura de recuperación inválida.");
  }
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  if (iv.byteLength !== 12) throw new Error("Envoltura de recuperación inválida.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`${RECOVERY_AAD_PREFIX}${userId}`) },
    root,
    ciphertext,
  );
  const vaultKey = new Uint8Array(plain);
  if (vaultKey.byteLength !== 32) throw new Error("Clave de bóveda recuperada inválida.");
  return vaultKey;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
    });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "Falta autenticación." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json({ error: "Sesión inválida." }, 401);

  let body: { action?: unknown; vaultKey?: unknown; generation?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const { data: rootRow, error: rootError } = await admin
    .from("oanix_recovery_root")
    .select("secret")
    .eq("singleton", true)
    .single();
  if (rootError || typeof rootRow?.secret !== "string") return json({ error: "Recuperación no disponible." }, 503);

  let secretBytes: Uint8Array;
  try {
    secretBytes = rootRow.secret.startsWith("\\x")
      ? hexToBytes(rootRow.secret.slice(2))
      : base64ToBytes(rootRow.secret);
  } catch {
    return json({ error: "Configuración de recuperación inválida." }, 503);
  }
  if (secretBytes.byteLength !== 32) {
    secretBytes.fill(0);
    return json({ error: "Configuración de recuperación inválida." }, 503);
  }
  const rootKey = await importRecoveryRoot(secretBytes);
  secretBytes.fill(0);

  if (body.action === "status") {
    const { data } = await admin
      .from("vault_recovery_envelopes")
      .select("generation")
      .eq("user_id", user.id)
      .maybeSingle();
    return json({ prepared: Boolean(data), generation: data?.generation ?? null });
  }

  if (body.action === "register") {
    if (typeof body.vaultKey !== "string") return json({ error: "Falta la clave de bóveda." }, 400);
    const generation = typeof body.generation === "number" && Number.isSafeInteger(body.generation) && body.generation > 0
      ? body.generation
      : 1;
    const vaultKey = base64ToBytes(body.vaultKey);
    if (vaultKey.byteLength !== 32) {
      vaultKey.fill(0);
      return json({ error: "Clave de bóveda inválida." }, 400);
    }

    try {
      const { data: existing, error: existingError } = await admin
        .from("vault_recovery_envelopes")
        .select("generation,ciphertext")
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingError) return json({ error: "No se pudo comprobar la recuperación existente." }, 500);

      if (existing) {
        let previous: Uint8Array | null = null;
        try {
          previous = await decryptVaultKey(rootKey, user.id, existing.ciphertext);
          if (!constantTimeEqual(previous, vaultKey)) {
            return json({ error: "La clave presentada no coincide con la bóveda ya protegida para recuperación." }, 409);
          }
        } finally {
          previous?.fill(0);
        }
        if (generation < existing.generation) {
          return json({ error: "Este dispositivo usa una generación de seguridad antigua." }, 409);
        }
      } else {
        const { data: bootstrap } = await admin
          .from("sync_records")
          .select("record_key")
          .eq("user_id", user.id)
          .eq("record_key", VAULT_BOOTSTRAP_KEY)
          .eq("deleted", false)
          .maybeSingle();
        if (!bootstrap) return json({ error: "Primero sincroniza esta bóveda con tu cuenta." }, 409);
      }

      const ciphertext = await encryptVaultKey(rootKey, user.id, vaultKey);
      const { error } = await admin.from("vault_recovery_envelopes").upsert({
        user_id: user.id,
        generation,
        ciphertext,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) return json({ error: "No se pudo actualizar la recuperación." }, 500);
      return json({ ok: true, generation });
    } finally {
      vaultKey.fill(0);
    }
  }

  if (body.action === "recover") {
    try {
      requireRecentOtp(token);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "OTP requerido." }, 403);
    }
    const { data: envelope, error } = await admin
      .from("vault_recovery_envelopes")
      .select("generation,ciphertext")
      .eq("user_id", user.id)
      .single();
    if (error || !envelope) return json({ error: "Esta bóveda todavía no tiene recuperación por correo preparada." }, 404);
    let vaultKey: Uint8Array | null = null;
    try {
      vaultKey = await decryptVaultKey(rootKey, user.id, envelope.ciphertext);
      return json({ vaultKey: bytesToBase64(vaultKey), generation: envelope.generation });
    } finally {
      vaultKey?.fill(0);
    }
  }

  return json({ error: "Acción desconocida." }, 400);
});