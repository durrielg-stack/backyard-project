-- ============================================================================
-- RLS Hardening — Tier B (F-02)   STATUS: APPLIED TO PRODUCTION 2026-07-03
--
-- IMPORTANT: This file documents what was ACTUALLY applied to the live database
-- (project yspwtobicmqsysbrkfjk). The live policies already had a partial role
-- model targeting the `public` role (which includes anonymous users), so the fix
-- was done surgically with ALTER POLICY — preserving each policy's conditions and
-- only changing its audience/qual — rather than the drop-and-replace originally
-- drafted. Access-control only; no row data was modified.
--
-- Roles in use: owner, manager, waiter, kitchen (no `staff` role active).
-- Anon access after B1 is limited to three SELECTs the app needs:
--   users_read, tables_read_all (public availability page), orders_read_auth.
-- ============================================================================


-- ============================================================================
-- PHASE B1 — Close anonymous access (APPLIED). Flip every policy from `public`
-- to `authenticated`, keeping conditions intact; leave the three anon reads.
-- ============================================================================
-- users:  keep users_read anon-readable (login picker); writes signed-in only
ALTER POLICY users_insert            ON public.users                     TO authenticated;
ALTER POLICY users_update            ON public.users                     TO authenticated;
-- restaurant_tables: keep tables_read_all anon-readable (public page)
ALTER POLICY tables_write_all        ON public.restaurant_tables         TO authenticated;
-- orders: keep orders_read_auth anon-readable (public page)
ALTER POLICY orders_insert_staff     ON public.orders                    TO authenticated;
ALTER POLICY orders_update_staff     ON public.orders                    TO authenticated;
ALTER POLICY orders_delete_mgr       ON public.orders                    TO authenticated;
-- order_items (fully signed-in only)
ALTER POLICY oi_read_auth            ON public.order_items               TO authenticated;
ALTER POLICY oi_insert_staff         ON public.order_items               TO authenticated;
ALTER POLICY oi_update_staff         ON public.order_items               TO authenticated;
ALTER POLICY oi_delete_mgr           ON public.order_items               TO authenticated;
-- menu_items
ALTER POLICY menu_read               ON public.menu_items                TO authenticated;
ALTER POLICY menu_write_all          ON public.menu_items                TO authenticated;
-- payments
ALTER POLICY pay_read_auth           ON public.payments                  TO authenticated;
ALTER POLICY pay_insert_staff        ON public.payments                  TO authenticated;
ALTER POLICY pay_update_mgr          ON public.payments                  TO authenticated;
ALTER POLICY pay_delete_mgr          ON public.payments                  TO authenticated;
-- inventory / notifications
ALTER POLICY inv_all                 ON public.inventory                 TO authenticated;
ALTER POLICY "service role full access" ON public.notifications          TO authenticated;
-- financial / owner tables
ALTER POLICY allow_all_authenticated ON public.daily_expenses            TO authenticated;
ALTER POLICY remittances_all         ON public.partner_remittances       TO authenticated;
ALTER POLICY splits_all              ON public.partner_remittance_splits TO authenticated;
ALTER POLICY allow_all               ON public.opex_items                TO authenticated;
ALTER POLICY allow_all               ON public.opex_monthly_config       TO authenticated;
ALTER POLICY allow_all               ON public.budget_seed               TO authenticated;
ALTER POLICY allow_all               ON public.daily_adjustments         TO authenticated;
ALTER POLICY allow_all               ON public.daily_summary_seed        TO authenticated;
ALTER POLICY open                    ON public.expense_presets           TO authenticated;
-- audit_logs
ALTER POLICY audit_logs_insert       ON public.audit_logs                TO authenticated;
ALTER POLICY audit_logs_read         ON public.audit_logs                TO authenticated;
-- unused/dead tables (0 rows) that were still anon-open
ALTER POLICY budget_all              ON public.budget_daily              TO authenticated;
ALTER POLICY sales_insert_sys        ON public.sales                     TO authenticated;
ALTER POLICY sales_read_mgr          ON public.sales                     TO authenticated;
ALTER POLICY si_insert_sys           ON public.sales_items               TO authenticated;
ALTER POLICY si_read_mgr             ON public.sales_items               TO authenticated;


-- ============================================================================
-- PHASE B2 — Least privilege by role (APPLIED). Uses get_user_role(), which is
-- SELECT role FROM public.users WHERE id = auth.uid()  (SECURITY DEFINER).
-- Mirrors the app's screen permissions exactly.
--   owner + manager : payments (read), daily_expenses, expense_presets
--   owner only      : remittances, OPEX, budget seed, adjustments, summary seed, menu edits
--   all staff       : orders/order_items/inventory (unchanged), payment INSERT at bill-out
-- ============================================================================
ALTER POLICY pay_read_auth ON public.payments
  USING (get_user_role() = ANY (ARRAY['owner','manager']));
ALTER POLICY allow_all_authenticated ON public.daily_expenses
  USING (get_user_role() = ANY (ARRAY['owner','manager'])) WITH CHECK (get_user_role() = ANY (ARRAY['owner','manager']));
ALTER POLICY open ON public.expense_presets
  USING (get_user_role() = ANY (ARRAY['owner','manager'])) WITH CHECK (get_user_role() = ANY (ARRAY['owner','manager']));
ALTER POLICY menu_write_all ON public.menu_items
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY remittances_all ON public.partner_remittances
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY splits_all ON public.partner_remittance_splits
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY allow_all ON public.opex_items
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY allow_all ON public.opex_monthly_config
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY allow_all ON public.budget_seed
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY allow_all ON public.daily_adjustments
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');
ALTER POLICY allow_all ON public.daily_summary_seed
  USING (get_user_role() = 'owner') WITH CHECK (get_user_role() = 'owner');


-- ============================================================================
-- VERIFICATION (as run 2026-07-03) — simulate each role's JWT:
--   BEGIN;
--   SET LOCAL request.jwt.claims = '{"sub":"<user_id>"}';
--   SET LOCAL ROLE authenticated;
--   SELECT get_user_role(), (SELECT count(*) FROM public.payments), ... ;
--   ROLLBACK;
-- Results: owner sees all; manager sees payments+expenses+orders but 0 for
-- remittances/opex/budget; waiter sees 0 financial, full orders/order_items.
-- Anonymous sees only restaurant_tables, orders, users.
-- ============================================================================


-- ============================================================================
-- ROLLBACK (emergency only) — reverses to the pre-Tier-B wide-open state.
-- ============================================================================
-- -- Undo B2 (re-open financial tables to any signed-in user):
-- ALTER POLICY pay_read_auth ON public.payments USING (true);
-- ALTER POLICY allow_all_authenticated ON public.daily_expenses USING (true) WITH CHECK (true);
-- ALTER POLICY open ON public.expense_presets USING (true) WITH CHECK (true);
-- ALTER POLICY menu_write_all ON public.menu_items USING (true) WITH CHECK (true);
-- ALTER POLICY remittances_all ON public.partner_remittances USING (true) WITH CHECK (true);
-- ALTER POLICY splits_all ON public.partner_remittance_splits USING (true) WITH CHECK (true);
-- ALTER POLICY allow_all ON public.opex_items USING (true) WITH CHECK (true);
-- ALTER POLICY allow_all ON public.opex_monthly_config USING (true) WITH CHECK (true);
-- ALTER POLICY allow_all ON public.budget_seed USING (true) WITH CHECK (true);
-- ALTER POLICY allow_all ON public.daily_adjustments USING (true) WITH CHECK (true);
-- ALTER POLICY allow_all ON public.daily_summary_seed USING (true) WITH CHECK (true);
-- -- Undo B1 (re-open to anon — only if the public page or login breaks): set the
-- -- affected policy back TO public, e.g.:
-- --   ALTER POLICY <policyname> ON public.<table> TO public;


-- ============================================================================
-- RESIDUAL HARDENING (deferred; each needs a small code change)
--   * orders anon SELECT still exposes all columns to the public page, which only
--     needs table_id/opened_at/closed_at. Replace with a column-scoped view, or
--     derive occupancy from restaurant_tables.status and drop the anon orders read.
--   * users anon SELECT still leaks the full staff roster/roles (finding F-08).
--     Closing it needs a server endpoint feeding the login picker.
-- ============================================================================
