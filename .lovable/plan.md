

## Enhanced Campaign Detail Overview + URL Improvements

### Problem
1. The Overview tab on the campaign detail page is basic — static stat cards, no clickable actions, no charts
2. The browser URL shows `/campaigns/61f5e8ee-443b-42d6-bf4b-6ddfacc5d177` with UUID visible
3. Stat cards don't navigate to the relevant tab when clicked

### Changes

#### 1. Enhanced Overview Section (`src/pages/CampaignDetail.tsx`)

**Clickable stat cards:** Each of the 4 stat cards (Accounts targeted, Contacts targeted, Emails sent, Calls made) will navigate to the relevant tab when clicked:
- "Accounts targeted" → switches to Accounts tab
- "Contacts targeted" → switches to Contacts tab
- "Emails sent" / "Calls made" → switches to Outreach tab

**Add more stats row:** Add a second row with:
- LinkedIn messages sent (from communications)
- Responses (contacts with stage "Responded" or "Qualified")  
- Deals created (from deals table linked by campaign_id)
- MART completion percentage

**Add contact stage breakdown card:** Show a mini horizontal bar chart (Recharts) of contact stages — Not Contacted, Contacted, Responded, Qualified, Converted — so you see the campaign funnel at a glance.

**Add outreach timeline card:** Show communication activity over time as a small area/line chart (messages per week).

**Make MART Status clickable:** Clicking the MART Status card navigates to the MART Strategy tab.

**Make Recent Activity clickable:** Clicking individual activity items opens the Outreach tab.

**Add Description section** if `campaign.description` exists (currently only Goal and Notes are shown).

#### 2. Set Page Title to Campaign Name (`src/pages/CampaignDetail.tsx`)

Add `useEffect` to set `document.title` to the campaign name when loaded, so the browser tab shows the campaign name instead of UUID.

#### 3. URL Slug Support — Not Feasible Without Breaking Changes

Replacing UUIDs in the URL with campaign names requires either:
- A slug column in the database + migration + unique constraint
- Or a two-step lookup (list all campaigns, find by name) which is fragile

**Instead, the pragmatic fix:** Set `document.title` to the campaign name (browser tab shows name), and the header already prominently displays the campaign name. The UUID in the URL bar is a technical detail that doesn't affect UX significantly.

#### 4. Additional Overview Data Fetching

Add a query for deals linked to this campaign (`deals.campaign_id = campaignId`) to show deal stats on the overview. The `CampaignAnalytics` component already does this — we'll reuse the same query pattern.

### File Changes

| File | Changes |
|------|---------|
| `src/pages/CampaignDetail.tsx` | Enhance Overview tab: clickable stat cards, additional stats row, contact stage chart, outreach timeline chart, clickable MART status, description section, `document.title` set to campaign name |

### Technical Details

- Recharts (`BarChart`, `PieChart`) already imported in other components — will use same pattern
- Contact stage data available from `detail.contacts` (each has `.stage`)  
- Communications data available from `detail.communications` (each has `.communication_type` and `.communication_date`)
- Deals query: `supabase.from("deals").select("id, stage").eq("campaign_id", campaignId)`
- All stat cards get `cursor-pointer` + `onClick={() => setActiveTab("...")}` + hover effect

