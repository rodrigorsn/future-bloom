import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, signOut } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Busca transações do mês
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", format(selectedMonth, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`*, category:categories(name, icon, color), account:accounts(name, color)`)
        .eq("user_id", user!.id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .is("deleted_at", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Busca contas para saldo
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Métricas do mês
  const metrics = useMemo(() => {
    if (!transactions) return { income: 0, expense: 0, balance: 0, remaining: 0 };
    const income = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const balance = income - expense;
    const totalAccounts = accounts
      ? accounts.reduce((sum, a) => sum + Number(a.initial_balance), 0)
      : 0;
    return { income, expense, balance, remaining: totalAccounts + balance };
  }, [transactions, accounts]);

  const prevMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const nextMonth = () => setSelectedMonth(addMonths(selectedMonth, 1));

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <span className="text-lg">🗺️</span>
            </div>
            <span className="font-bold text-gray-900">MapFin</span>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-24">
        {/* Seletor de mês */}
        <div className="flex items-center justify-between py-4">
          <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-gray-100">
            ‹
          </button>
          <span className="text-base font-semibold text-gray-900">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-gray-100">
            ›
          </button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Receitas</p>
            <p className="mt-1 text-xl font-bold text-green-600">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatCurrency(metrics.income)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Despesas</p>
            <p className="mt-1 text-xl font-bold text-red-500">
              {isLoading ? <Skeleton className="h-7 w-24" /> : formatCurrency(metrics.expense)}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-600">Saldo do mês</p>
            <p className={`mt-1 text-2xl font-bold ${metrics.balance >= 0 ? "text-green-600" : "text-red-500"}`}>
              {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(metrics.balance)}
            </p>
          </div>
        </div>

        {/* Info de quanto pode gastar */}
        <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-blue-600">Total disponível nas contas</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(metrics.remaining)}
          </p>
        </div>

        {/* Lista de transações */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Transações</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : transactions?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-400">Nenhuma transação neste mês</p>
              <p className="mt-1 text-sm text-gray-400">Toque em + para adicionar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions?.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: t.category?.color + "20" }}
                  >
                    {t.category?.icon ?? "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                    <p className="text-xs text-gray-400">
                      {t.category?.name ?? "Sem categoria"} · {format(parseISO(t.date), "dd/MM")}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(Number(t.amount)))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 active:scale-95 transition-transform text-2xl"
      >
        +
      </button>

      {/* Modal de adicionar */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nova transação</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-500">Conecte o Supabase para habilitar o formulário de lançamento.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
