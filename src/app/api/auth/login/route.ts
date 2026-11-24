import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  signSessionToken,
} from "@/lib/auth";
import { verifyOwnerCredentials } from "@/lib/auth-server";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Informe o usuário."),
  password: z.string().min(1, "Informe a senha."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Credenciais inválidas." },
        { status: 400 }
      );
    }

    const result = await verifyOwnerCredentials(
      parsed.data.username,
      parsed.data.password
    );

    if (!result.ok) {
      if (result.reason === "misconfigured") {
        return NextResponse.json(
          {
            error:
              "Ambiente de autenticação não configurado (verifique HQ_ADMIN_USER, HQ_ADMIN_PASSWORD_HASH e HQ_JWT_SECRET).",
          },
          { status: 500 }
        );
      }

      // Pequeno atraso para dificultar tentativas automatizadas
      await new Promise((resolve) => setTimeout(resolve, 250));
      return NextResponse.json(
        { error: "Usuário ou senha incorretos." },
        { status: 401 }
      );
    }

    const token = await signSessionToken(result.username);
    const response = NextResponse.json(
      { ok: true, user: result.username },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (err) {
    console.error("[auth/login] Erro inesperado:", err);
    return NextResponse.json(
      { error: "Não foi possível processar o login. Verifique HQ_JWT_SECRET." },
      { status: 500 }
    );
  }
}
