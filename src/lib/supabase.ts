import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://placeholder.supabase.co";
const supabaseAnonKey = "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          color: string;
          type: "expense" | "income";
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["categories"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "checking" | "savings" | "wallet" | "credit" | "investment";
          color: string;
          initial_balance: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["accounts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          category_id: string | null;
          description: string;
          amount: number;
          date: string;
          is_recurrent: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["transactions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
    };
  };
};
