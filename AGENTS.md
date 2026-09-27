<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Lovable Cloud is the sole source of truth for authentication and financial data; never persist financial records in browser storage.
- Financial amounts are stored as positive `numeric(12,2)` values and their direction is represented by `transaction_type`.
- Expense transactions require an item, and database validation enforces category, item, account, and user ownership consistency.
