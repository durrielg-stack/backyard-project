-- ============================================================================
-- RLS Hardening — Tier B (F-02)
-- Drafted 2026-07-03. REVIEW ARTIFACT — not auto-applied. Run in the Supabase
-- SQL editor against the project, test between phases, keep the rollback handy.
--
-- WHAT THIS DOES / DOES NOT DO
--   * Changes ONLY row-access rules (policies). No INSERT/UPDATE/DELETE of data,
--     no DROP/ALTER of columns. Zero row-data loss. A bad policy can make rows
--     temporarily unreadable by the app, never destroys them, and is reversible
--     instantly with the rollback at the bottom.
--
-- CRITICAL CORRECTNESS NOTE
--   PostgreSQL combines multiple PERMISSIVE policies with OR. If the current
--   `USING (true)` policies are left in place, adding stricter policies does
--   NOTHING. Each phase below first DROPS every existing policy on its target
--   tables, then recreates the intended set. Both phases run inside a single
--   transaction, so other sessions never see a half-applied state.
--
-- ROLES
--   `anon`          = the public anon key (unauthenticated internet traffic)
--   `authenticated` = any signed-in staff member (real Supabase session)
--   Role granularity (owner/manager) in Phase B2 uses public.get_user_role().
--
-- ANON ACCESS IS PRESERVED ONLY WHERE REQUIRED
--   users             SELECT — login pickers list active staff before sign-in
--   restaurant_tables SELECT — public availability page (id, label, status)
--   orders            SELECT — public availability page (table_id, opened_at, closed_at)
--   Everything else becomes staff-only.
-- ============================================================================


-- ============================================================================
-- STEP 0 — DISCOVERY (run these SELECTs first; they change nothing)
-- ============================================================================
-- Current policies, so you can see exactly what will be replaced:
--   SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
--
-- Confirm the role helper exists and is SECURITY DEFINER with a fixed
-- search_path (Phase B2 depends on it; prosecdef must be true):
--   SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'get_user_role';
--
-- If get_user_role() is missing or not SECURITY DEFINER, apply Phase B1 only
-- and defer B2 until it is fixed (see db_optimization_next_steps.md #10).


-- ============================================================================
-- PHASE B1 — Close anonymous access; logged-in staff keep full access
-- Non-breaking: any operation the app performs today as a signed-in user still
-- works. This alone removes the internet-facing anon read/write of financial data.
-- ============================================================================
BEGIN;

-- 1a. Wipe existing policies on every target table, keep RLS enabled.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','restaurant_tables','orders','order_items','menu_items','inventory',
    'notifications','expense_presets','payments','daily_expenses',
    'partner_remittances','partner_remittance_splits','opex_items',
    'opex_monthly_config','budget_seed','daily_adjustments','daily_summary_seed',
    'audit_logs'
  ]
  LOOP
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 1b. Public + login tables: anon may SELECT; staff may write.
CREATE POLICY users_sel  ON public.users             FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tables_sel ON public.restaurant_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY orders_sel ON public.orders            FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY tables_all_auth ON public.restaurant_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY orders_all_auth ON public.orders            FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- (users has no write policy: user management runs through the service role,
--  which bypasses RLS, so direct client writes to users stay denied.)

-- 1c. Append-only audit log: staff insert + read; no update/delete.
CREATE POLICY audit_ins_auth ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY audit_sel_auth ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- 1d. Everything else: full CRUD for signed-in staff, nothing for anon.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'order_items','menu_items','inventory','notifications','expense_presets',
    'payments','daily_expenses','partner_remittances','partner_remittance_splits',
    'opex_items','opex_monthly_config','budget_seed','daily_adjustments','daily_summary_seed'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_all_auth', t);
  END LOOP;
END $$;

COMMIT;

-- ---- TEST BEFORE PROCEEDING TO B2 --------------------------------------------
-- 1. Signed-in POS: take an order, bill it out (incl. partial pay), open Owner
--    tabs (budget/expenses/reports). All must work.
-- 2. Public availability page (byp.theserverprojectph.cc) still renders tables.
-- 3. Anon is now blocked. This must return [] (empty), not data:
--      curl 'https://<PROJECT>.supabase.co/rest/v1/payments?select=*' \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
-- ------------------------------------------------------------------------------


-- ============================================================================
-- PHASE B2 — Least privilege by role (HIGHER TEST RISK — do after B1 is proven)
-- Depends on public.get_user_role() returning the caller's role. Re-scopes the
-- financial/admin subset; leaves order_items/inventory/notifications as staff-wide.
-- ============================================================================
BEGIN;

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'restaurant_tables','menu_items','expense_presets','payments','daily_expenses',
    'partner_remittances','partner_remittance_splits','opex_items',
    'opex_monthly_config','budget_seed','daily_adjustments','daily_summary_seed','audit_logs'
  ]
  LOOP
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- restaurant_tables: public still reads; any staff flips status; owner edits layout.
CREATE POLICY tables_sel      ON public.restaurant_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tables_upd_auth ON public.restaurant_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tables_ins_own  ON public.restaurant_tables FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'owner');
CREATE POLICY tables_del_own  ON public.restaurant_tables FOR DELETE TO authenticated USING (public.get_user_role() = 'owner');

-- menu_items: all staff read (ordering); owner writes.
CREATE POLICY menu_sel_auth ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY menu_ins_own  ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'owner');
CREATE POLICY menu_upd_own  ON public.menu_items FOR UPDATE TO authenticated USING (public.get_user_role() = 'owner') WITH CHECK (public.get_user_role() = 'owner');
CREATE POLICY menu_del_own  ON public.menu_items FOR DELETE TO authenticated USING (public.get_user_role() = 'owner');

-- expense_presets: all staff read; manager/owner write.
CREATE POLICY presets_sel_auth ON public.expense_presets FOR SELECT TO authenticated USING (true);
CREATE POLICY presets_mod_mgr  ON public.expense_presets FOR ALL TO authenticated
  USING      (public.get_user_role() = ANY (ARRAY['owner','manager']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['owner','manager']));

-- payments: staff insert at bill-out; manager/owner read for reports.
--   ⚠ VERIFY no staff-only screen reads payments before applying. If one does,
--     widen pay_sel to TO authenticated USING (true).
CREATE POLICY pay_ins_auth ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pay_sel_mgr  ON public.payments FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['owner','manager']));

-- daily_expenses: manager/owner only (matches the ExpensesView UI gate).
CREATE POLICY exp_all_mgr ON public.daily_expenses FOR ALL TO authenticated
  USING      (public.get_user_role() = ANY (ARRAY['owner','manager']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['owner','manager']));

-- Owner-only financial tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'partner_remittances','partner_remittance_splits','opex_items',
    'opex_monthly_config','budget_seed','daily_adjustments','daily_summary_seed'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (public.get_user_role() = ''owner'') '
      'WITH CHECK (public.get_user_role() = ''owner'')',
      t || '_all_own', t);
  END LOOP;
END $$;

-- audit_logs: staff still insert their own events; only owner reads.
CREATE POLICY audit_ins_auth ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY audit_sel_own  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'owner');

COMMIT;

-- ---- TEST AFTER B2 -----------------------------------------------------------
-- * Owner: all tabs work (budget, expenses, remittances, opex, reports).
-- * Manager: expenses + reports work; owner-only tables return empty.
-- * Waiter/kitchen: ordering + bill-out (payment insert) works; reading
--   payments/expenses returns empty.
-- ------------------------------------------------------------------------------


-- ============================================================================
-- ROLLBACK — restore the original wide-open state (emergency use)
-- Reverts every target table to a single permissive policy. Reversible, no
-- data touched. Run in the Supabase SQL editor if the app misbehaves.
-- ============================================================================
-- BEGIN;
-- DO $$
-- DECLARE t text; p record;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'users','restaurant_tables','orders','order_items','menu_items','inventory',
--     'notifications','expense_presets','payments','daily_expenses',
--     'partner_remittances','partner_remittance_splits','opex_items',
--     'opex_monthly_config','budget_seed','daily_adjustments','daily_summary_seed',
--     'audit_logs'
--   ]
--   LOOP
--     FOR p IN SELECT policyname FROM pg_policies
--              WHERE schemaname = 'public' AND tablename = t
--     LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t); END LOOP;
--     EXECUTE format(
--       'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated '
--       'USING (true) WITH CHECK (true)', t || '_open', t);
--   END LOOP;
-- END $$;
-- COMMIT;


-- ============================================================================
-- RESIDUAL HARDENING (deferred; each needs a small code change, so NOT here)
--   * orders anon SELECT still exposes all columns to the public. The page only
--     needs table_id/opened_at/closed_at. Replace with a column-scoped view (or
--     drop the orders read entirely and derive occupancy from
--     restaurant_tables.status) — a public-page code change, then remove
--     orders_sel for anon.
--   * users anon SELECT still leaks the full staff roster/roles (finding F-08).
--     Closing it needs a server endpoint feeding the login picker.
-- ============================================================================
