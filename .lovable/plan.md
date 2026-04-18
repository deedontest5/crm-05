

## Performance Investigation: Findings & Plan

I deep-checked the app and found several concrete causes of slow page loads. None are bundle-size issues (lazy loading + chunking is already in place). The real bottlenecks are **excessive serial network requests**, **fetching full tables when only counts are needed**, and **wasteful polling/refetching**.

### Root Causes Found

**1. CampaignDashboard fetches 3 entire tables on every visit (`CampaignDashboard.tsx` lines 104–156)**
- Pulls all rows from `campaign_accounts`, `campaign_contacts`, `campaign_communications` to compute counts client-side.
- For a CRM with thousands of records, this is the #1 reason `/campaigns` and `/` are slow.
- Fix: Replace with a single Supabase RPC (or 3 `head:true, count:exact` queries) that returns aggregates server-side.

**2. CampaignDetail issues 7+ parallel queries on mount (`useCampaigns.tsx` lines 340–447)**
- campaign, strategy, accounts, contacts, communications, email-templates, phone-scripts, materials — all fired on page open even though most tabs aren't visible.
- Fix: Only fetch the data needed for the **active tab**. Lazy-load tab content (Setup, Outreach, Analytics, Action Items) so their queries don't run until the tab is opened.

**3. CampaignAnalytics & CampaignOverview each refetch the same 4 tables (`CampaignAnalytics.tsx` 51–85, `CampaignOverview.tsx`)**
- Same query keys are used, so the cache helps, but each component still subscribes and triggers re-renders.
- Fix: Hoist queries into the parent (`CampaignDetail`) and pass via props — eliminates duplicate subscriptions.

**4. `setInterval` polling every 60s in CampaignCommunications (`CampaignCommunications.tsx` line 74)**
- Calls the `check-email-replies` edge function and invalidates queries every minute, even when the user is on another tab.
- Fix: Only poll when the Outreach tab is mounted AND the document is visible (`document.visibilityState === 'visible'`). Increase interval to 2 minutes.

**5. DealsPage loads ALL deals at once with no pagination (`DealsPage.tsx` lines 35–61)**
- Loops `range(0,999)` until exhausted — slow for large datasets, blocks first paint.
- Plus an always-on real-time subscription that re-renders on every change.
- Fix: For Kanban view limit to ~500 most recent + load more on scroll. For List view use server-side pagination (already exists in `fetchPaginatedData`).

**6. CampaignDashboardWidget on Dashboard fetches campaigns + ALL campaign_contacts (`CampaignDashboardWidget.tsx` lines 17–58)**
- Same anti-pattern as #1: fetches every contact row to compute response rates.
- Fix: Use grouped count query or RPC.

**7. Accounts page has an extra `useEffect` querying ALL `account_owner` values (`Accounts.tsx` lines 32–41)**
- Fires on every refresh trigger; no cache.
- Fix: Wrap in `useQuery` with `staleTime: 5min`.

**8. Vite manualChunks misses `@hello-pangea/dnd`, `date-fns`, `@tanstack/react-query`**
- These are large and bundled into the main entry.
- Fix: Add explicit chunks for `dnd`, `query`, `dates`.

### Plan of Changes

**Backend (1 migration)**
- Create RPC `get_campaign_aggregates()` returning per-campaign account/contact/communication counts and channel/status breakdown in one query.
- Create RPC `get_campaign_widget_stats()` for the Dashboard widget.

**Frontend**
1. **`CampaignDashboard.tsx`** — replace 3 full-table fetches with `get_campaign_aggregates` RPC.
2. **`CampaignDashboardWidget.tsx`** — use `get_campaign_widget_stats` RPC.
3. **`CampaignDetail.tsx`** — lazy-load tab components (`React.lazy` + `Suspense`) so Setup/Monitoring/Action-Items code & queries don't run until clicked.
4. **`useCampaigns.tsx` (`useCampaignDetail`)** — gate `accountsQuery`, `contactsQuery`, `communicationsQuery`, `emailTemplatesQuery`, `phoneScriptsQuery`, `materialsQuery` behind an `enabledTabs` parameter so non-visible tabs don't fetch.
5. **`CampaignAnalytics.tsx` / `CampaignOverview.tsx`** — accept data via props from parent instead of duplicating queries.
6. **`CampaignCommunications.tsx`** — gate polling: skip when `document.hidden`, increase interval to 120s, only run when component mounted.
7. **`DealsPage.tsx`** — add a 500-row initial fetch with "Load More" for Kanban; rely on existing pagination for List view. Disable real-time subscription when tab hidden.
8. **`Accounts.tsx`** — convert ad-hoc owner fetch to `useQuery` with cache.
9. **`vite.config.ts`** — add `dnd`, `query`, `dates` chunks for better cache hits.

### Expected Impact
- Campaigns dashboard: ~3 seconds → ~300 ms (one RPC vs three full table scans).
- Campaign detail: ~2 seconds → ~500 ms (1 query instead of 7).
- Deals page: large dataset load deferred until scrolled.
- Notification polling no longer fires when tab is backgrounded.

### Out of Scope
- No UI/visual changes — purely performance.
- No data shape changes — RPCs return the same totals existing components already compute.

