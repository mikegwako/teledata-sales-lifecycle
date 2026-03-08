import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, TrendingUp, AlertTriangle, Users, DollarSign, FileText, Activity } from 'lucide-react';
import teledataLogo from '@/assets/teledata-logo.jpeg';

interface Deal {
  id: string;
  title: string;
  value: number;
  cost: number;
  status: string;
  deal_number: number;
  created_at: string;
  assigned_to: string | null;
  assigned_profile?: { full_name: string } | null;
  profiles?: { full_name: string } | null;
}

interface StaffActivity {
  user_id: string;
  count: number;
  name: string;
}

export default function ExecutiveReport() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activityCounts, setActivityCounts] = useState<StaffActivity[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [dealRes, logRes] = await Promise.all([
      supabase.from('deals').select('*, assigned_profile:profiles!deals_assigned_to_fkey(full_name), profiles!deals_client_id_fkey(full_name)'),
      supabase.from('activity_logs').select('user_id, id, profile:profiles!activity_logs_user_id_fkey(full_name)').order('created_at', { ascending: false }).limit(500),
    ]);

    const dealsData = (dealRes.data as any) || [];
    setDeals(dealsData);

    // Count activity per staff
    const staffMap: Record<string, { count: number; name: string }> = {};
    (logRes.data || []).forEach((log: any) => {
      if (!log.user_id) return;
      if (!staffMap[log.user_id]) {
        staffMap[log.user_id] = { count: 0, name: log.profile?.full_name || 'Unknown' };
      }
      staffMap[log.user_id].count++;
    });
    setActivityCounts(Object.entries(staffMap).map(([user_id, v]) => ({ user_id, ...v })).sort((a, b) => b.count - a.count));

    // Check documents per deal
    const docMap: Record<string, number> = {};
    for (const deal of dealsData) {
      const { count } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('deal_id', deal.id);
      docMap[deal.id] = count || 0;
    }
    setDocCounts(docMap);

    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const now = new Date();
  const inProgressDeals = deals.filter((d) => d.status !== 'Completion' && d.status !== 'Inception');
  const totalPipelineValue = inProgressDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const totalRevenue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const totalCost = deals.reduce((s, d) => s + Number(d.cost || 0), 0);
  const profit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;
  const completedDeals = deals.filter((d) => d.status === 'Completion');
  const winRate = deals.length > 0 ? Math.round((completedDeals.length / deals.length) * 100) : 0;

  // Top 3 deals by value
  const topDeals = [...deals].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).slice(0, 3);

  // Deals missing documents
  const missingDocs = deals.filter((d) => (docCounts[d.id] || 0) === 0 && d.status !== 'Inception');

  // 30-day trend
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentDeals = deals.filter((d) => new Date(d.created_at) >= thirtyDaysAgo);
  const recentValue = recentDeals.reduce((s, d) => s + Number(d.value || 0), 0);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">Executive Snapshot</h1>
          <p className="text-muted-foreground text-sm">Real-time briefing • Generated {now.toLocaleDateString()} at {now.toLocaleTimeString()}</p>
        </div>
        <Button onClick={handlePrint} className="gradient-primary text-primary-foreground print:hidden">
          <Download className="h-4 w-4 mr-2" />Download Report
        </Button>
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* Report Header for Print */}
        <div className="hidden print:flex items-center gap-4 mb-6 pb-4 border-b-2 border-primary">
          <img src={teledataLogo} alt="Teledata Africa" className="h-14 w-14 rounded-lg object-cover" />
          <div>
            <h1 className="text-2xl font-bold font-display">Teledata Africa — Executive Snapshot</h1>
            <p className="text-sm text-muted-foreground">Generated {now.toLocaleDateString()} at {now.toLocaleTimeString()}</p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Active Pipeline', value: `$${totalPipelineValue.toLocaleString()}`, icon: TrendingUp, sub: `${inProgressDeals.length} deals in progress`, color: 'text-primary' },
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, sub: `${profitMargin}% margin`, color: 'text-success' },
            { label: 'Net Profit', value: `$${profit.toLocaleString()}`, icon: DollarSign, sub: `Cost: $${totalCost.toLocaleString()}`, color: profit >= 0 ? 'text-success' : 'text-destructive' },
            { label: 'Win Rate', value: `${winRate}%`, icon: Activity, sub: `${completedDeals.length} of ${deals.length} completed`, color: 'text-accent' },
          ].map((m) => (
            <Card key={m.label} className="shadow-card print:shadow-none print:border">
              <CardContent className="p-4 sm:pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    <p className="text-lg sm:text-2xl font-bold font-display text-foreground mt-1">{m.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{m.sub}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${m.color} shrink-0 hidden sm:flex`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 30-Day Pipeline Inflow */}
        <Card className="shadow-card print:shadow-none print:border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />Last 30 Days Inflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold font-display text-foreground">${recentValue.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">across {recentDeals.length} new deal{recentDeals.length !== 1 ? 's' : ''}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 3 Deals */}
          <Card className="shadow-card print:shadow-none print:border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">🏆 Top 3 Deals Requiring Attention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topDeals.map((deal, i) => (
                  <div key={deal.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary-foreground">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{deal.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        TD-{1000 + (deal.deal_number || 0)} • {deal.assigned_profile?.full_name || 'Unassigned'} • {deal.status}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-primary text-sm shrink-0">${Number(deal.value || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Productivity */}
          <Card className="shadow-card print:shadow-none print:border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />Team Productivity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {activityCounts.slice(0, 5).map((staff) => {
                    const maxCount = activityCounts[0]?.count || 1;
                    const pct = Math.round((staff.count / maxCount) * 100);
                    return (
                      <div key={staff.user_id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-foreground">{staff.name}</span>
                          <span className="text-muted-foreground">{staff.count} actions</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Missing Documents Alert */}
        {missingDocs.length > 0 && (
          <Card className="shadow-card border-warning/30 print:shadow-none print:border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />Critical: Missing Documentation ({missingDocs.length} deals)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {missingDocs.slice(0, 5).map((deal) => (
                  <div key={deal.id} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-warning/5">
                    <FileText className="h-4 w-4 text-warning shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{deal.title}</p>
                      <p className="text-[10px] text-muted-foreground">TD-{1000 + (deal.deal_number || 0)} • {deal.status} • {deal.assigned_profile?.full_name || 'Unassigned'}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-warning text-warning shrink-0">No docs</Badge>
                  </div>
                ))}
                {missingDocs.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+ {missingDocs.length - 5} more deals without documentation</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <Separator />
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">Teledata Africa Sales Engine • Confidential Executive Report</p>
          <p className="text-[10px] text-muted-foreground mt-1">This report reflects real-time data as of {now.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
