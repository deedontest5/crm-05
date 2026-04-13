import { useParams, useNavigate } from "react-router-dom";
import { useCampaignDetail, useCampaigns } from "@/hooks/useCampaigns";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, Circle, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CampaignModal } from "@/components/campaigns/CampaignModal";
import { CampaignMARTStrategy } from "@/components/campaigns/CampaignMARTStrategy";
import { CampaignAccounts } from "@/components/campaigns/CampaignAccounts";
import { CampaignContacts } from "@/components/campaigns/CampaignContacts";
import { CampaignCommunications } from "@/components/campaigns/CampaignCommunications";
import { CampaignAnalytics } from "@/components/campaigns/CampaignAnalytics";
import { CampaignActionItems } from "@/components/campaigns/CampaignActionItems";
import { CampaignOverview } from "@/components/campaigns/CampaignOverview";

const statusColors: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  Active: "bg-primary/10 text-primary",
  Paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useCampaignDetail(id);
  const { updateCampaign } = useCampaigns();
  const ownerIds = useMemo(() => [detail.campaign?.owner].filter(Boolean) as string[], [detail.campaign?.owner]);
  const { displayNames } = useUserDisplayNames(ownerIds);
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const autoCompleteRef = useRef(false);

  // Auto-complete campaign when end date is reached (only if Active)
  useEffect(() => {
    if (
      detail.campaign &&
      detail.isCampaignEnded &&
      detail.campaign.status === "Active" &&
      !autoCompleteRef.current
    ) {
      autoCompleteRef.current = true;
      updateCampaign.mutate({ id: detail.campaign.id, status: "Completed" });
      toast.info(`This campaign ended on ${detail.campaign.end_date} and has been marked Completed.`);
    }
  }, [detail.campaign, detail.isCampaignEnded]);

  // Set document title to campaign name
  useEffect(() => {
    if (detail.campaign?.campaign_name) {
      document.title = `${detail.campaign.campaign_name} — Campaign`;
    }
    return () => { document.title = "CRM"; };
  }, [detail.campaign?.campaign_name]);

  if (detail.isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-muted animate-pulse" />
          <div className="h-6 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!detail.campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button variant="outline" onClick={() => navigate("/campaigns")}>Back to Campaigns</Button>
      </div>
    );
  }

  const { campaign, isMARTComplete, martProgress, isFullyMARTComplete, isCampaignEnded, daysRemaining } = detail;

  // Status transition rules
  const handleStatusChange = (newStatus: string) => {
    const current = campaign.status || "Draft";

    // Completed lock
    if (current === "Completed") {
      toast.error("Completed campaigns cannot be reactivated.");
      return;
    }

    // MART gate for Active
    if (newStatus === "Active" && !isFullyMARTComplete) {
      toast.error("Complete all 4 MART sections before activating this campaign.");
      return;
    }

    updateCampaign.mutate({ id: campaign.id, status: newStatus });
  };

  const getAvailableStatuses = () => {
    const current = campaign.status || "Draft";
    if (current === "Completed") return [];
    const statuses = ["Draft", "Paused", "Completed"];
    if (isFullyMARTComplete) statuses.splice(1, 0, "Active");
    return statuses.filter((s) => s !== current);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 h-16 px-6 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{campaign.campaign_name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {campaign.campaign_type} · Owner: {campaign.owner ? displayNames[campaign.owner] || "—" : "—"}
              {campaign.start_date && campaign.end_date && (
                <> · {format(new Date(campaign.start_date + "T00:00:00"), "dd MMM yyyy")} → {format(new Date(campaign.end_date + "T00:00:00"), "dd MMM yyyy")}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* MART pills — compact inline */}
          <div className="hidden md:flex items-center gap-1 mr-2">
            {[
              { key: "M", label: "Message", done: isMARTComplete.message },
              { key: "A", label: "Audience", done: isMARTComplete.audience },
              { key: "R", label: "Region", done: isMARTComplete.region },
              { key: "T", label: "Timing", done: isMARTComplete.timing },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab("mart")}
                title={`${item.label}: ${item.done ? "Done" : "Pending"}`}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  item.done
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {item.key}
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">{martProgress}/4</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Badge className={statusColors[campaign.status || "Draft"]} variant="secondary">
                  {campaign.status || "Draft"}
                </Badge>
                {campaign.status !== "Completed" && <ChevronDown className="h-3 w-3" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {getAvailableStatuses().map((s) => (
                <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                  <Badge className={`${statusColors[s]} mr-2`} variant="secondary">{s}</Badge>
                  Set to {s}
                </DropdownMenuItem>
              ))}
              {getAvailableStatuses().length === 0 && (
                <DropdownMenuItem disabled>No status changes available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {isCampaignEnded && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Ended
            </Badge>
          )}
          {daysRemaining !== null && daysRemaining > 0 && !isCampaignEnded && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {daysRemaining}d left
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
        </div>
      </div>

      {/* Campaign ended warning */}
      {isCampaignEnded && (
        <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          This campaign ended on {campaign.end_date}. Outreach is closed.
        </div>
      )}

      {/* 7 Tabs per spec */}
      <div className="flex-1 overflow-hidden px-6 pt-4 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="overflow-x-auto">
            <TabsList className="w-full grid grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="mart">MART Strategy</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="outreach">Outreach</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto mt-4">
            {/* Overview */}
            <TabsContent value="overview" className="mt-0">
              <CampaignOverview
                campaign={campaign}
                accounts={detail.accounts}
                contacts={detail.contacts}
                communications={detail.communications}
                isMARTComplete={isMARTComplete}
                martProgress={martProgress}
                onTabChange={setActiveTab}
              />
            </TabsContent>

            {/* MART Strategy — unified tab */}
            <TabsContent value="mart" className="mt-0">
              <CampaignMARTStrategy
                campaignId={campaign.id}
                campaign={campaign}
                isMARTComplete={isMARTComplete}
                updateMartFlag={detail.updateMartFlag}
                isCampaignEnded={isCampaignEnded}
                daysRemaining={daysRemaining}
                timingNotes={detail.mart?.timing_notes}
              />
            </TabsContent>

            <TabsContent value="accounts" className="mt-0">
              <CampaignAccounts campaignId={campaign.id} isCampaignEnded={isCampaignEnded} />
            </TabsContent>
            <TabsContent value="contacts" className="mt-0">
              <CampaignContacts campaignId={campaign.id} isCampaignEnded={isCampaignEnded} campaignName={campaign.campaign_name} campaignOwner={campaign.owner} endDate={campaign.end_date} />
            </TabsContent>
            <TabsContent value="outreach" className="mt-0">
              <CampaignCommunications campaignId={campaign.id} isCampaignEnded={isCampaignEnded} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              <CampaignActionItems campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="analytics" className="mt-0">
              <CampaignAnalytics campaignId={campaign.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <CampaignModal open={editOpen} onClose={() => setEditOpen(false)} campaign={campaign} isMARTComplete={isFullyMARTComplete} />
    </div>
  );
}
