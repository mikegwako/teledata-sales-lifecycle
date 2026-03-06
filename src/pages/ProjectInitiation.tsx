import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ServiceTypeCombobox } from '@/components/ServiceTypeCombobox';
import { FilePlus, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function ProjectInitiation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [submittedDealNumber, setSubmittedDealNumber] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('deals').insert({
        client_id: user.id,
        title,
        service_type: serviceType,
        description,
        status: 'Inception',
      }).select('deal_number').single();
      if (error) throw error;
      setSubmittedDealNumber(data.deal_number);
      toast({ title: 'Project submitted!', description: `Deal ID: #TD-${1000 + data.deal_number}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (submittedDealNumber !== null) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <Card className="shadow-elevated text-center">
          <CardContent className="py-12">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">Project Submitted!</h2>
            <p className="text-lg font-mono text-primary font-bold mb-1">Deal ID: #TD-{1000 + submittedDealNumber}</p>
            <p className="text-muted-foreground mb-6">Your project has been submitted and is now in the <strong>Inception</strong> stage.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/projects')} className="gradient-primary text-primary-foreground">View My Projects</Button>
              <Button variant="outline" onClick={() => { setSubmittedDealNumber(null); setTitle(''); setServiceType(''); setDescription(''); }}>Submit Another</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground">Initiate New Project</h1>
        <p className="text-muted-foreground mt-1">Submit your project request to get started with Teledata Africa</p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <FilePlus className="h-5 w-5 text-primary" />
            Project Details
          </CardTitle>
          <CardDescription>Fill in the details below to initiate your project</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Enterprise Fiber Deployment" required />
            </div>

            <div className="space-y-2">
              <Label>Service Type</Label>
              <ServiceTypeCombobox value={serviceType} onChange={setServiceType} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your project requirements..." rows={4} />
            </div>

            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading || !serviceType || !title}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Project
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
