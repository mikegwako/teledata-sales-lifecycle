import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, FolderOpen, Target, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Deal {
  id: string;
  title: string;
  value: number;
  status: string;
  assigned_to: string | null;
  assigned_profile?: { full_name: string } | null;
}

export default function AdminDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, assigned_profile:profiles!deals_assigned_to_fkey(full_name)');
      setDeals(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPipeline = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const activeProjects = deals.filter((d) => d.status !== 'Completion').length;
  const completedDeals = deals.filter((d) => d.status === 'Completion').length;
  const winRate = deals.length > 0 ? Math.round((completedDeals / deals.length) * 100) : 0;

  // Deals per rep
  const repMap: Record<string, number> = {};
  deals.forEach((d) => {
    const name = d.assigned_profile?.full_name || 'Unassigned';
    repMap[name] = (repMap[name] || 0) + 1;
  });
  const chartData = Object.entries(repMap).map(([name, count]) => ({ name, deals: count }));

  const metrics = [
    { label: 'Total Pipeline', value: `$${totalPipeline.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Active Projects', value: activeProjects, icon: FolderOpen, color: 'text-accent' },
    { label: 'Win Rate', value: `${winRate}%`, icon: Target, color: 'text-success' },
    { label: 'Completed', value: completedDeals, icon: TrendingUp, color: 'text-success' },
  ];

  const barColors = ['hsl(211, 100%, 30%)', 'hsl(199, 89%, 48%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)'];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Admin Command Center</h1>
        <p className="text-muted-foreground mt-1">Overview of all sales operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="shadow-card hover:shadow-elevated transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="text-2xl font-bold font-display text-foreground mt-1">{m.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center ${m.color}`}>
                  <m.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
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
    </div>
  );
}
