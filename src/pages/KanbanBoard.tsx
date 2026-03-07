import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, GripVertical, HandMetal, Plus, DollarSign, MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ServiceTypeCombobox } from '@/components/ServiceTypeCombobox';
import DealDetailDialog from '@/components/DealDetailDialog';

interface Deal {
  id: string;
  title: string;
  service_type: string;
  value: number;
  cost: number;
  status: string;
  description: string;
  client_id: string;
  assigned_to: string | null;
  deal_number: number;
  created_at: string;
  profiles?: { full_name: string } | null;
  assigned_profile?: { full_name: string } | null;
}

const COLUMNS = ['Inception', 'Discovery', 'Proposal', 'Negotiation', 'Implementation', 'Completion'];

const columnColors: Record<string, string> = {
  Inception: 'border-t-muted-foreground/30',
  Discovery: 'border-t-primary',
  Proposal: 'border-t-accent',
  Negotiation: 'border-t-warning',
  Implementation: 'border-t-primary/70',
  Completion: 'border-t-success',
};

export default function KanbanBoard() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: '', service_type: '', description: '', value: '' });

  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from('deals')
      .select('*, profiles!deals_client_id_fkey(full_name), assigned_profile:profiles!deals_assigned_to_fkey(full_name)')
      .order('updated_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const dealId = result.draggableId;
    const newStatus = result.destination.droppableId;

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, status: newStatus } : d)));

    const { error } = await supabase.from('deals').update({ status: newStatus }).eq('id', dealId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      fetchDeals();
      return;
    }

    if (user) {
      await supabase.from('activity_logs').insert({
        deal_id: dealId, user_id: user.id, action: 'status_change',
        details: `Moved deal to ${newStatus}`,
      });
    }

    if (newStatus === 'Completion') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#004A99', '#0ea5e9', '#22c55e'] });
      toast({ title: '🎉 Deal Completed!', description: 'Congratulations on closing this deal!' });
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals(deals.filter((d) => d.id !== id));
    }
  };

  const handleClaim = async (e: React.MouseEvent, dealId: string) => {
    e.stopPropagation();
    if (!user) return;
    const { error } = await supabase.from('deals').update({ assigned_to: user.id }).eq('id', dealId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deal claimed!' });
      await supabase.from('activity_logs').insert({ deal_id: dealId, user_id: user.id, action: 'claimed', details: 'Claimed this deal' });
      fetchDeals();
    }
  };

  const handleNewDeal = async () => {
    if (!user || !newDeal.title) return;
    const { error } = await supabase.from('deals').insert({
      title: newDeal.title, service_type: newDeal.service_type, description: newDeal.description,
      value: parseFloat(newDeal.value) || 0, assigned_to: user.id, status: 'Inception',
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deal created!' });
      setNewDeal({ title: '', service_type: '', description: '', value: '' });
      setNewDealOpen(false);
      fetchDeals();
    }
  };

  const openDealDetail = (deal: Deal) => {
    setSelectedDeal(deal);
    setDetailOpen(true);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Deal Pipeline</h1>
          <p className="text-muted-foreground mt-1">Click any card for full details • Drag to update stage</p>
        </div>
        {(role === 'staff' || role === 'admin') && (
          <Dialog open={newDealOpen} onOpenChange={setNewDealOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />New Deal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Create New Deal</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title</Label><Input value={newDeal.title} onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })} placeholder="Deal title" /></div>
                <div><Label>Service Type</Label><ServiceTypeCombobox value={newDeal.service_type} onChange={(v) => setNewDeal({ ...newDeal, service_type: v })} /></div>
                <div><Label>Value ($)</Label><Input type="number" value={newDeal.value} onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })} placeholder="0" /></div>
                <div><Label>Description</Label><Textarea value={newDeal.description} onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })} rows={3} /></div>
                <Button className="w-full gradient-primary text-primary-foreground" onClick={handleNewDeal} disabled={!newDeal.title}>Create Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {COLUMNS.map((col) => {
          const count = deals.filter((d) => d.status === col).length;
          const total = deals.filter((d) => d.status === col).reduce((s, d) => s + Number(d.value || 0), 0);
          return (
            <div key={col} className="rounded-lg border border-border p-2 text-center bg-card">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{col}</p>
              <p className="text-lg font-bold font-display text-foreground">{count}</p>
              {total > 0 && <p className="text-[10px] font-mono text-primary">${total.toLocaleString()}</p>}
            </div>
          );
        })}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-6 gap-3 min-w-[900px] overflow-x-auto">
          {COLUMNS.map((col) => {
            const colDeals = deals.filter((d) => d.status === col);
            return (
              <Droppable droppableId={col} key={col}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-xl border-t-4 ${columnColors[col]} bg-muted/20 p-2 min-h-[500px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5 ring-2 ring-primary/20' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">{col}</h3>
                      <Badge variant="secondary" className="text-[10px] h-5">{colDeals.length}</Badge>
                    </div>

                    {colDeals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onClick={() => openDealDetail(deal)}
                            className={`mb-2 cursor-pointer border border-border/50 ${snapshot.isDragging ? 'shadow-elevated rotate-1 ring-2 ring-primary/30' : 'shadow-card hover:shadow-elevated hover:border-primary/30'} transition-all`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
                                  <p className="text-[10px] font-mono text-primary/60 mt-0.5">TD-{1000 + (deal.deal_number || 0)}</p>
                                  {deal.service_type && (
                                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{deal.service_type}</p>
                                  )}
                                  {deal.value > 0 && (
                                    <p className="text-xs font-mono font-semibold text-primary mt-1.5">${Number(deal.value).toLocaleString()}</p>
                                  )}
                                  {deal.assigned_profile ? (
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <div className="h-5 w-5 rounded-full gradient-accent flex items-center justify-center">
                                        <span className="text-[9px] font-bold text-accent-foreground">{deal.assigned_profile.full_name?.charAt(0)?.toUpperCase()}</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground truncate">{deal.assigned_profile.full_name}</span>
                                    </div>
                                  ) : (
                                    role === 'staff' && (
                                      <Button variant="outline" size="sm" className="mt-2 h-6 text-[10px] w-full" onClick={(e) => handleClaim(e, deal.id)}>
                                        <HandMetal className="h-3 w-3 mr-1" />Claim
                                      </Button>
                                    )
                                  )}
                                </div>
                                {role === 'admin' && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/30 hover:text-destructive" onClick={(e) => handleDelete(e, deal.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      <DealDetailDialog
        deal={selectedDeal}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDealUpdated={fetchDeals}
      />
    </div>
  );
}
