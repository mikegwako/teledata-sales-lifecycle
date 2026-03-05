import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Wifi, Cloud, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Deal {
  id: string;
  title: string;
  service_type: string;
  value: number;
  status: string;
  description: string;
  created_at: string;
  client_id: string;
  assigned_to: string | null;
  profiles?: { full_name: string } | null;
}

const STAGES = ['Inception', 'Discovery', 'Proposal', 'Negotiation', 'Implementation', 'Completion'];

const serviceIcon: Record<string, React.ElementType> = { Fiber: Wifi, Cloud, Security: ShieldCheck };

const stageColors: Record<string, string> = {
  Inception: 'bg-muted text-muted-foreground',
  Discovery: 'bg-primary/10 text-primary',
  Proposal: 'bg-accent/10 text-accent',
  Negotiation: 'bg-warning/10 text-warning',
  Implementation: 'bg-primary/20 text-primary',
  Completion: 'bg-success/10 text-success',
};

export default function ProjectsView() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = async () => {
    setLoading(true);
    let query = supabase.from('deals').select('*, profiles!deals_client_id_fkey(full_name)').order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals(deals.filter((d) => d.id !== id));
      toast({ title: 'Deal deleted' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">
          {role === 'client' ? 'My Projects' : 'All Projects'}
        </h1>
        <p className="text-muted-foreground mt-1">{deals.length} project{deals.length !== 1 ? 's' : ''} found</p>
      </div>

      {deals.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No projects yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => {
            const Icon = serviceIcon[deal.service_type] || Cloud;
            const stageIndex = STAGES.indexOf(deal.status);

            return (
              <Card key={deal.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-display">{deal.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {deal.service_type} • {deal.profiles?.full_name || 'Unknown Client'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={stageColors[deal.status]}>{deal.status}</Badge>
                      {deal.value > 0 && (
                        <Badge variant="outline" className="font-mono">${Number(deal.value).toLocaleString()}</Badge>
                      )}
                      {role === 'admin' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(deal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Stepper */}
                  <div className="flex items-center gap-1">
                    {STAGES.map((stage, i) => (
                      <div key={stage} className="flex-1 flex items-center gap-1">
                        <div className={`h-2 flex-1 rounded-full transition-colors ${i <= stageIndex ? 'gradient-primary' : 'bg-muted'}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">Inception</span>
                    <span className="text-[10px] text-muted-foreground">Completion</span>
                  </div>
                  {deal.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{deal.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
