import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(email);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fcfbf8] px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500">
            <span className="text-2xl">🗺️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">MapFin</h1>
          <p className="mt-1 text-sm text-gray-500">Controle financeiro pessoal</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {sent ? (
            <div className="text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <span className="text-2xl">✉️</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Verifique seu e-mail</h2>
              <p className="mt-2 text-sm text-gray-500">
                Enviamos um link mágico para <strong>{email}</strong>. Clique no link para
                entrar na sua conta.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-amber-600 hover:text-amber-700"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-semibold text-gray-900">Entrar</h2>
              <p className="mb-4 text-sm text-gray-500">
                Digite seu e-mail e enviaremos um link mágico para você entrar.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar link mágico"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Sem senha. Sem cadastro. Seu e-mail é sua chave.
        </p>
      </div>
    </div>
  );
}
