import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // A página inicial redireciona com base no estado de autenticação.
    // Componentes inside/outsideProtected substituem esse redirect por agora.
  },
  component: HomeRedirect,
});

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (!loading) {
    if (user) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/login" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
    </div>
  );
}
