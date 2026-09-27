import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Resumo do mês — MapFin" },
      { name: "description", content: "Acompanhe receitas, despesas e quanto ainda pode gastar no mês." },
      { property: "og:title", content: "Resumo do mês — MapFin" },
      { property: "og:description", content: "Acompanhe receitas, despesas e quanto ainda pode gastar no mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", format(selectedMonth, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`*, category:categories(name, icon, color), item:items(name, icon, color)`)
        .eq("user_id", user.id)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .is("deleted_at", null)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    if (!transactions) return { income: 0, expense: 0, balance: 0, remaining: 0 };
    const income = transactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = income - expense;
    const totalLimits = [...categories, ...items].reduce(
      (sum, entry) => sum + Number(entry.monthly_limit ?? 0),
      0,
    );
    return { income, expense, balance, remaining: totalLimits > 0 ? totalLimits - expense : balance };
  }, [transactions, categories, items]);

  const prevMonth = () => setSelectedMonth(subMonths(selectedMonth, 1));
  const nextMonth = () => setSelectedMonth(addMonths(selectedMonth, 1));

  if (!user) return <Navigate to="/login" replace />;

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={signOut}
          >
            <LogOut aria-hidden="true" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-24">
        {/* Seletor de mês */}
        <div className="flex items-center justify-between py-4">
          <Button type="button" variant="ghost" size="icon" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="text-base font-semibold text-gray-900">
            {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight aria-hidden="true" />
          </Button>
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
          <p className="text-xs text-blue-600">Quanto ainda posso gastar</p>
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
                  <span className={`text-sm font-semibold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                    {t.type === "income" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <Button
        type="button"
        size="icon"
        onClick={() => setShowAdd(true)}
        className="fixed bottom-6 left-1/2 z-20 h-14 w-14 -translate-x-1/2 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 sm:left-auto sm:right-6 sm:translate-x-0"
        aria-label="Adicionar lançamento"
      >
        <Plus aria-hidden="true" />
      </Button>

      <QuickEntryDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        userId={user.id}
        categories={categories}
        items={items}
        itemsLoading={itemsLoading}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }}
        onSuggestionsCreated={async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["categories"] }),
            queryClient.invalidateQueries({ queryKey: ["items"] }),
          ]);
        }}
      />
    </div>
  );
}

type Category = { id: string; name: string; type: "income" | "expense" };
type Item = { id: string; category_id: string; name: string; icon: string };

function QuickEntryDialog({
  open,
  onOpenChange,
  userId,
  categories,
  items,
  itemsLoading,
  onSaved,
  onSuggestionsCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  categories: Category[];
  items: Item[];
  itemsLoading: boolean;
  onSaved: () => Promise<void>;
  onSuggestionsCreated: () => Promise<void>;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [itemId, setItemId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingSuggestions, setCreatingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => amountRef.current?.focus(), 50);
  }, [open]);

  const selectedItem = items.find((item) => item.id === itemId);
  const selectedCategory = categories.find((category) => category.id === selectedItem?.category_id);

  const reset = () => {
    setAmount("");
    setItemId("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setDescription("");
    setError(null);
  };

  const createSuggestions = async () => {
    setCreatingSuggestions(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("create_suggested_categories_and_items");
    setCreatingSuggestions(false);
    if (rpcError) {
      setError("Não foi possível criar as sugestões. Tente novamente.");
      return;
    }
    await onSuggestionsCreated();
    toast.success("Categorias e itens sugeridos criados.");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!selectedItem || !selectedCategory) {
      setError("Escolha um item para o gasto.");
      return;
    }

    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      category_id: selectedCategory.id,
      item_id: selectedItem.id,
      type: "expense",
      description: description.trim() || selectedItem.name,
      amount: numericAmount,
      date,
      payment_method: "pix",
      status: "paid",
      paid_at: new Date().toISOString(),
      origin: "manual",
    });
    setSaving(false);

    if (insertError) {
      setError("Não foi possível salvar o lançamento. Revise os dados e tente novamente.");
      return;
    }

    await onSaved();
    reset();
    onOpenChange(false);
    toast.success("Gasto salvo.");
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) reset(); onOpenChange(nextOpen); }}>
      <DialogContent className="top-auto bottom-0 translate-y-0 rounded-t-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Novo gasto</DialogTitle>
          <DialogDescription>Registre o essencial agora. Os detalhes são opcionais.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              ref={amountRef}
              id="amount"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={amount}
              onChange={(event) => setAmount(formatBRLInput(event.target.value))}
              className="h-14 text-2xl font-semibold"
              aria-describedby={error ? "quick-entry-error" : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item">Item</Label>
            {itemsLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : items.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">Crie uma base inicial para começar.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={createSuggestions} disabled={creatingSuggestions}>
                  {creatingSuggestions ? "Criando..." : "Usar categorias sugeridas"}
                </Button>
              </div>
            ) : (
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger id="item" className="h-11">
                  <SelectValue placeholder="Escolha onde gastou" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.icon} {item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Data e descrição</summary>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição opcional</Label>
                <Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: almoço de domingo" />
              </div>
            </div>
          </details>

          {error && <p id="quick-entry-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-12 w-full bg-amber-500 text-white hover:bg-amber-600" disabled={saving || items.length === 0}>
            {saving ? "Salvando..." : "Salvar gasto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatBRLInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
