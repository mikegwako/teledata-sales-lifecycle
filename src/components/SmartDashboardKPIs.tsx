import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Deal {
  id: string;
  title: string;
  value: number;
  cost: number;
  status: string;
  deal_number: number;
  updated_at?: string;
  assigned_profile?: { full_name: string } | null;
}

interface SmartDashboardKPIsProps {
  deals: Deal[];
  formatCurrency: (v: number) => string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export default function SmartDashboardKPIs({ deals, formatCurrency }: SmartDashboardKPIsProps) {
  const activeDeals = deals.filter(d => d.status !== 'Completion' && d.status !== 'Inception');
  const totalValue = activeDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const totalCost = activeDeals.reduce((s, d) => s + Number(d.cost || 0), 0);
  const potentialProfit = totalValue - totalCost;
  const overallMargin = totalValue > 0 ? Math.round((potentialProfit / totalValue) * 100) : 0;

  // Closed / Completed deals
  const closedDeals = deals.filter(d => d.status === 'Completion');
  const closedValue = closedDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const closedCost = closedDeals.reduce((s, d) => s + Number(d.cost || 0), 0);
  const finalProfit = closedValue - closedCost;
  const closedMargin = closedValue > 0 ? Math.round((finalProfit / closedValue) * 100) : 0;

  // Low-margin deals (< 15%)
  const lowMarginDeals = activeDeals.filter(d => {
    const v = Number(d.value || 0);
    const c = Number(d.cost || 0);
    if (v <= 0) return false;
    return ((v - c) / v) * 100 < 15;
  });

  // Stalled deals (no update in 7+ days)
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const stalledDeals = activeDeals.filter(d => {
    const updated = d.updated_at ? new Date(d.updated_at).getTime() : 0;
    return now - updated > SEVEN_DAYS;
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {/* Value vs Profit Counters */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-card border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pipeline Value</p>
                <p className="text-xl font-bold font-display text-foreground">{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`shadow-card ${potentialProfit >= 0 ? 'border-success/20' : 'border-destructive/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${potentialProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <BarChart3 className={`h-5 w-5 ${potentialProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Potential Profit</p>
                <p className={`text-xl font-bold font-display ${potentialProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(potentialProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${overallMargin >= 15 ? 'bg-success/10' : 'bg-warning/10'}`}>
                <TrendingDown className={`h-5 w-5 ${overallMargin >= 15 ? 'text-success' : 'text-warning'}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Margin</p>
                <p className={`text-xl font-bold font-display ${overallMargin >= 15 ? 'text-foreground' : 'text-warning'}`}>{overallMargin}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Low Margin Alerts */}
      {lowMarginDeals.length > 0 && (
        <motion.div variants={item}>
          <Card className="shadow-card border-warning/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2 text-warning">
                <TrendingDown className="h-4 w-4" />Low-Margin Deals ({lowMarginDeals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowMarginDeals.slice(0, 5).map(deal => {
                  const v = Number(deal.value || 0);
                  const c = Number(deal.cost || 0);
                  const margin = v > 0 ? Math.round(((v - c) / v) * 100) : 0;
                  return (
                    <div key={deal.id} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-warning/5">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{deal.title}</p>
                        <p className="text-[10px] text-muted-foreground">TD-{1000 + (deal.deal_number || 0)} • {deal.assigned_profile?.full_name || 'Unassigned'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-muted-foreground">{formatCurrency(v)}</span>
                        <Badge variant="outline" className="text-[10px] border-warning text-warning">{margin}% margin</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stalled Deal Alerts */}
      {stalledDeals.length > 0 && (
        <motion.div variants={item}>
          <Card className="shadow-card border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
                <Clock className="h-4 w-4" />Stalled Deals — No Activity for 7+ Days ({stalledDeals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stalledDeals.slice(0, 5).map(deal => {
                  const daysSince = Math.floor((now - new Date(deal.updated_at || '').getTime()) / (24 * 60 * 60 * 1000));
                  return (
                    <div key={deal.id} className="flex items-center justify-between gap-3 text-sm p-2 rounded-lg bg-destructive/5">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{deal.title}</p>
                        <p className="text-[10px] text-muted-foreground">TD-{1000 + (deal.deal_number || 0)} • {deal.status} • {deal.assigned_profile?.full_name || 'Unassigned'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-destructive text-destructive shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />{daysSince}d idle
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
