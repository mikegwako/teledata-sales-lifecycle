import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, FolderOpen, Target, DollarSign, Activity, Users, ArrowUpRight, ArrowDownRight, FileBarChart, Trash2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { RoleBadge } from '@/components/RoleBadge';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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

function groupLogs(logs: ActivityLog[]) {
  const groups: { key: string; logs: ActivityLog[]; summary: string; user: string; userId: string | null; time: string }[] = [];
  for (const log of logs) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.logs[0].user_id === log.user_id &&
      last.logs[0].action === log.action &&
      Math.abs(new Date(last.logs[0].created_at).getTime() - new Date(log.created_at).getTime()) < 5 * 60 * 1000
    ) {
      last.logs.push(log);
      const count = last.logs.length;
      const userName = log.profile?.full_name || 'System';
      last.summary = `${userName} performed ${count} ${log.action.replace('_', ' ')} actions`;
    } else {
      groups.push({
        key: log.id,
        logs: [log],
        summary: '',
        user: log.profile?.full_name || 'System',
        userId: log.user_id,
        time: log.created_at,
      });
    }
  }
  return groups;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const roleMap = useUserRoles();

  const fetchAll = async () => {
    const [dealRes, staffRes, logRes] = await Promise.all([
      supabase.from('deals').select('*, assigned_profile:profiles!deals_assigned_to_fkey(full_name), profiles!deals_client_id_fkey(full_name)'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('activity_logs').select('*, profile:profiles!activity_logs_user_id_fkey(full_name), deal:deals!activity_logs_deal_id_fkey(title, deal_number)').order('created_at', { ascending: false }).limit(30),
    ]);
    setDeals((dealRes.data as any) || []);
    setStaffList(staffRes.data || []);
    setActivityLogs((logRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReassign = async (dealId: string, staffId: string) => {
    const { error } = await supabase.from('deals').update({ assigned_to: staffId }).eq('id', dealId);
    if (error) return;
    fetchAll();
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUser(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const result = await res.json();
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'User deleted successfully' });
        fetchAll();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setDeletingUser(null);
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

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentDeals = deals.filter((d) => new Date(d.created_at) >= thirtyDaysAgo).length;
  const olderDeals = deals.filter((d) => {
    const created = new Date(d.created_at);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    return created >= sixtyDaysAgo && created < thirtyDaysAgo;
  }).length;
  const growthPct = olderDeals > 0 ? Math.round(((recentDeals - olderDeals) / olderDeals) * 100) : recentDeals > 0 ? 100 : 0;

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
    document_upload: '📎 File Upload',
  };

  const logGroups = groupLogs(activityLogs);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">Admin Command Center</h1>
          <p className="text-muted-foreground mt-1 text-sm">Overview of all sales operations</p>
        </div>
        <Button onClick={() => navigate('/report')} className="gradient-primary text-primary-foreground w-full sm:w-auto">
          <FileBarChart className="h-4 w-4 mr-2" />Executive Report
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="p-4 sm:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-lg sm:text-2xl font-bold font-display text-foreground mt-1">{m.value}</p>
                  {m.trend !== undefined && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${m.trend >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {m.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(m.trend)}% last 30d
                    </div>
                  )}
                  {(m as any).sub && <p className="text-[10px] text-muted-foreground mt-0.5">{(m as any).sub}</p>}
                </div>
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-muted flex items-center justify-center ${m.color} hidden sm:flex`}>
                  <m.icon className="h-5 w-5 sm:h-6 sm:w-6" />
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
            <CardTitle className="font-display text-base sm:text-lg">Deals per Sales Representative</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No deals data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
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
            <CardTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-5 w-5 text-primary" />Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logGroups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {logGroups.map((group) => (
                  <div key={group.key}>
                    {group.logs.length === 1 ? (
                      <div className="flex items-start gap-3 text-sm border-b border-border pb-2 last:border-0">
                        <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-primary-foreground">{group.user.charAt(0)?.toUpperCase() || '?'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{group.user}</span>
                            {group.userId && roleMap[group.userId] && <RoleBadge role={roleMap[group.userId]} />}
                          </p>
                          <p className="text-muted-foreground text-xs mt-0.5">{group.logs[0].details}</p>
                          {group.logs[0].deal && (
                            <p className="text-xs text-primary/70 font-mono">TD-{1000 + (group.logs[0].deal.deal_number || 0)} • {group.logs[0].deal.title}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{new Date(group.time).toLocaleString()}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{actionLabels[group.logs[0].action] || group.logs[0].action}</Badge>
                      </div>
                    ) : (
                      <details className="border-b border-border pb-2">
                        <summary className="flex items-center gap-3 text-sm cursor-pointer list-none">
                          <div className="h-8 w-8 rounded-full gradient-accent flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-accent-foreground">{group.user.charAt(0)?.toUpperCase() || '?'}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                              {group.summary}
                              {group.userId && roleMap[group.userId] && <RoleBadge role={roleMap[group.userId]} />}
                            </p>
                            <p className="text-xs text-muted-foreground">{new Date(group.time).toLocaleString()}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{group.logs.length} events</Badge>
                        </summary>
                        <div className="mt-2 ml-11 space-y-1 border-l-2 border-border pl-3">
                          {group.logs.map((log) => (
                            <div key={log.id} className="text-xs text-muted-foreground">
                              {log.details}
                              {log.deal && <span className="font-mono text-primary/70 ml-1">• TD-{1000 + (log.deal.deal_number || 0)}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
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
          <CardTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-5 w-5 text-primary" />Deal Assignment Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Deal</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden sm:table-cell">Client</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Value</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden md:table-cell">Status</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-2 sm:px-3">
                      <p className="font-medium text-foreground text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{deal.title}</p>
                      <p className="font-mono text-primary text-[10px]">TD-{1000 + (deal.deal_number || 0)}</p>
                    </td>
                    <td className="py-2 px-2 sm:px-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs">{deal.profiles?.full_name || '—'}</span>
                        <RoleBadge role="client" />
                      </div>
                    </td>
                    <td className="py-2 px-2 sm:px-3 font-mono text-xs">${Number(deal.value || 0).toLocaleString()}</td>
                    <td className="py-2 px-2 sm:px-3 hidden md:table-cell"><Badge variant="secondary" className="text-[10px]">{deal.status}</Badge></td>
                    <td className="py-2 px-2 sm:px-3">
                      <div className="flex items-center gap-1.5">
                        <Select value={deal.assigned_to || 'unassigned'} onValueChange={(v) => handleReassign(deal.id, v)}>
                          <SelectTrigger className="h-7 sm:h-8 w-[100px] sm:w-[150px] text-[10px] sm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {staffList.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-1.5">
                                  {s.full_name || s.id}
                                  {roleMap[s.id] && <RoleBadge role={roleMap[s.id]} />}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-5 w-5 text-primary" />User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Name</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Role</th>
                  <th className="text-left py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Active Deals</th>
                  <th className="text-right py-2 px-2 sm:px-3 text-muted-foreground font-medium text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((person) => {
                  const userRole = roleMap[person.id] || 'client';
                  const dealCount = deals.filter((d) => d.assigned_to === person.id || d.client_id === person.id).length;
                  return (
                    <tr key={person.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2 sm:px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-primary-foreground">{person.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
                          </div>
                          <span className="font-medium text-foreground text-xs sm:text-sm">{person.full_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 sm:px-3"><RoleBadge role={userRole} /></td>
                      <td className="py-2 px-2 sm:px-3 text-xs text-muted-foreground">{dealCount}</td>
                      <td className="py-2 px-2 sm:px-3 text-right">
                        {userRole !== 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={deletingUser === person.id}>
                                {deletingUser === person.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />Delete User
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{person.full_name}</strong>? This action cannot be undone. All their data (deals, comments, documents) may be affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteUser(person.id)}>
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
