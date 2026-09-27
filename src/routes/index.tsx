import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MapFin — Controle financeiro pessoal" },
      { name: "description", content: "Acesse seu controle financeiro pessoal MapFin." },
      { property: "og:title", content: "MapFin — Controle financeiro pessoal" },
      { property: "og:description", content: "Acesse seu controle financeiro pessoal MapFin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomeRedirect,
});

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (!loading) {
    return <Navigate to={user ? "/dashboard" : "/login"} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
    </div>
  );
}
