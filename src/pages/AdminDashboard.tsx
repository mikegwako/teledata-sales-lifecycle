import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, FolderOpen, Target, DollarSign, Activity, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Deal {
  id: string;
  title: string;
  value: number;
  cost: number;
  status: string;
  assigned_to: string | null;
  deal_number: number;
  created_at: string;
  assigned_profile?: { full_name: string } | null;
  profiles?: { full_name: string } | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface ActivityLog {
  id: string;
  action: string;
  details: string;
  created_at: string;
  deal_id: string | null;
  user_id: string | null;
  profile?: { full_name: string } | null;
  deal?: { title: string; deal_number: number } | null;
}

export default function AdminDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [dealRes, staffRes, logRes] = await Promise.all([
      supabase.from('deals').select('*, assigned_profile:profiles!deals_assigned_to_fkey(full_name), profiles!deals_client_id_fkey(full_name)'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('activity_logs').select('*, profile:profiles!activity_logs_user_id_fkey(full_name), deal:deals!activity_logs_deal_id_fkey(title, deal_number)').order('created_at', { ascending: false }).limit(20),
    ]);
    setDeals((dealRes.data as any) || []);
    setStaffList(staffRes.data || []);
    setActivityLogs((logRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Realtime activity feed
  useEffect(() => {
    const channel = supabase
      .channel('admin-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReassign = async (dealId: string, staffId: string) => {
    const { error } = await supabase.from('deals').update({ assigned_to: staffId }).eq('id', dealId);
    if (error) return;
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPipeline = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalCost = deals.reduce((sum, d) => sum + Number(d.cost || 0), 0);
  const profit = totalPipeline - totalCost;
  const profitMargin = totalPipeline > 0 ? Math.round((profit / totalPipeline) * 100) : 0;
  const activeProjects = deals.filter((d) => d.status !== 'Completion').length;
  const completedDeals = deals.filter((d) => d.status === 'Completion').length;
  const winRate = deals.length > 0 ? Math.round((completedDeals / deals.length) * 100) : 0;

  // 30-day trend
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentDeals = deals.filter((d) => new Date(d.created_at) >= thirtyDaysAgo).length;
  const olderDeals = deals.filter((d) => {
    const created = new Date(d.created_at);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    return created >= sixtyDaysAgo && created < thirtyDaysAgo;
  }).length;
  const growthPct = olderDeals > 0 ? Math.round(((recentDeals - olderDeals) / olderDeals) * 100) : recentDeals > 0 ? 100 : 0;

  // Deals per rep
  const repMap: Record<string, number> = {};
  deals.forEach((d) => {
    const name = d.assigned_profile?.full_name || 'Unassigned';
    repMap[name] = (repMap[name] || 0) + 1;
  });
  const chartData = Object.entries(repMap).map(([name, count]) => ({ name, deals: count }));

  const metrics = [
    { label: 'Total Pipeline', value: `$${totalPipeline.toLocaleString()}`, icon: DollarSign, color: 'text-primary', trend: growthPct },
    { label: 'Profit Margin', value: `${profitMargin}%`, icon: TrendingUp, color: 'text-success', sub: `$${profit.toLocaleString()} profit` },
    { label: 'Active Projects', value: activeProjects, icon: FolderOpen, color: 'text-accent' },
    { label: 'Win Rate', value: `${winRate}%`, icon: Target, color: 'text-success' },
  ];

  const barColors = ['hsl(211, 100%, 30%)', 'hsl(199, 89%, 48%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)'];

  const actionLabels: Record<string, string> = {
    status_change: '📋 Stage Update',
    claimed: '🤝 Deal Claimed',
    note: '📝 Quick Note',
    project_created: '🆕 Project Created',
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Admin Command Center</h1>
        <p className="text-muted-foreground mt-1">Overview of all sales operations</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-2xl font-bold font-display text-foreground mt-1">{m.value}</p>
                  {m.trend !== undefined && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${m.trend >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {m.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(m.trend)}% last 30d
                    </div>
                  )}
                  {(m as any).sub && <p className="text-xs text-muted-foreground mt-0.5">{(m as any).sub}</p>}
                </div>
                <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center ${m.color}`}>
                  <m.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Deals per Sales Representative</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No deals data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="deals" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                    <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary-foreground">{log.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">
                        <span className="font-medium">{log.profile?.full_name || 'System'}</span>
                        {' '}<span className="text-muted-foreground">{log.details}</span>
                      </p>
                      {log.deal && (
                        <p className="text-xs text-primary/70 font-mono">TD-{1000 + (log.deal.deal_number || 0)} • {log.deal.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{actionLabels[log.action] || log.action}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deal Assignment Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Deal Assignment Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Deal ID</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Title</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Client</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Value</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Cost</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono text-primary text-xs">TD-{1000 + (deal.deal_number || 0)}</td>
                    <td className="py-2 px-3 text-foreground font-medium">{deal.title}</td>
                    <td className="py-2 px-3 text-muted-foreground">{deal.profiles?.full_name || '—'}</td>
                    <td className="py-2 px-3 font-mono">${Number(deal.value || 0).toLocaleString()}</td>
                    <td className="py-2 px-3 font-mono text-destructive">${Number(deal.cost || 0).toLocaleString()}</td>
                    <td className="py-2 px-3"><Badge variant="secondary" className="text-xs">{deal.status}</Badge></td>
                    <td className="py-2 px-3">
                      <Select value={deal.assigned_to || 'unassigned'} onValueChange={(v) => handleReassign(deal.id, v)}>
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name || s.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
