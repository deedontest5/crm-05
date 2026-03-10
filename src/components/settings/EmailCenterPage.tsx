import { useState, useEffect, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, History, BarChart3, Clock, TrendingUp, Send, MailOpen } from 'lucide-react';
import SettingsLoadingSkeleton from './shared/SettingsLoadingSkeleton';

const EmailTemplatesSettings = lazy(() => import('@/components/settings/EmailTemplatesSettings'));

interface EmailCenterPageProps {
  defaultTab?: string | null;
}

const validTabs = ['templates', 'history', 'analytics'];

const EmailCenterPage = ({ defaultTab }: EmailCenterPageProps) => {
  const [activeTab, setActiveTab] = useState(() => {
    if (defaultTab && validTabs.includes(defaultTab)) {
      return defaultTab;
    }
    return 'templates';
  });

  useEffect(() => {
    if (defaultTab && validTabs.includes(defaultTab)) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  return (
    <div className="space-y-6 w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-10 bg-background pb-2 border-b border-border">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">History</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Analytics</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="templates" className="mt-6">
          <Suspense fallback={<SettingsLoadingSkeleton />}>
            <EmailTemplatesSettings />
          </Suspense>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground max-w-md mx-auto space-y-4">
                <History className="h-12 w-12 mx-auto opacity-50" />
                <div>
                  <p className="font-medium text-foreground">Email History</p>
                  <p className="text-sm mt-1">
                    Track all sent emails with delivery status, timestamps, and recipient details.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Send className="h-3.5 w-3.5" />
                    <span>Sent & delivery tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Timestamps & logs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MailOpen className="h-3.5 w-3.5" />
                    <span>Open rate tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Template usage stats</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  This section will activate once email sending is configured.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground max-w-md mx-auto space-y-4">
                <BarChart3 className="h-12 w-12 mx-auto opacity-50" />
                <div>
                  <p className="font-medium text-foreground">Email Analytics</p>
                  <p className="text-sm mt-1">
                    View performance metrics for your email campaigns and templates.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Open & click rates</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Volume trends</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Template performance</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Send className="h-3.5 w-3.5" />
                    <span>Delivery reports</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Analytics will be available once email history tracking is enabled.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailCenterPage;
