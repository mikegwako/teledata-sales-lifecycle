import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import confetti from 'canvas-confetti';

interface Deal {
  id: string;
  title: string;
  service_type: string;
  value: number;
  status: string;
  client_id: string;
  assigned_to: string | null;
  profiles?: { full_name: string } | null;
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
  const { role } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from('deals')
      .select('*, profiles!deals_client_id_fkey(full_name)')
      .order('updated_at', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals(data || []);
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

    if (newStatus === 'Completion') {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#004A99', '#0ea5e9', '#22c55e'] });
      toast({ title: '🎉 Deal Completed!', description: 'Congratulations on closing this deal!' });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDeals(deals.filter((d) => d.id !== id));
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
        <h1 className="text-2xl font-bold font-display text-foreground">Deal Pipeline</h1>
        <p className="text-muted-foreground mt-1">Drag deals across stages to update their status</p>
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
                    className={`rounded-lg border-t-4 ${columnColors[col]} bg-muted/30 p-2 min-h-[500px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{col}</h3>
                      <Badge variant="secondary" className="text-xs">{colDeals.length}</Badge>
                    </div>

                    {colDeals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`mb-2 shadow-card cursor-grab ${snapshot.isDragging ? 'shadow-elevated rotate-2' : ''} hover:shadow-elevated transition-all`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/40">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{deal.profiles?.full_name || 'Unassigned'}</p>
                                  {deal.value > 0 && (
                                    <p className="text-xs font-mono text-primary mt-1">${Number(deal.value).toLocaleString()}</p>
                                  )}
                                </div>
                                {role === 'admin' && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground/40 hover:text-destructive" onClick={() => handleDelete(deal.id)}>
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
    </div>
  );
}
