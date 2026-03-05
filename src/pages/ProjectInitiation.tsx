import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilePlus, Loader2, Wifi, Cloud, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const serviceIcons = { Fiber: Wifi, Cloud: Cloud, Security: ShieldCheck };

export default function ProjectInitiation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('deals').insert({
        client_id: user.id,
        title,
        service_type: serviceType,
        description,
        status: 'Inception',
      });
      if (error) throw error;
      toast({ title: 'Project submitted!', description: 'Your project has been initiated successfully.' });
      navigate('/projects');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
              <Select value={serviceType} onValueChange={setServiceType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {(['Fiber', 'Cloud', 'Security'] as const).map((s) => {
                    const Icon = serviceIcons[s];
                    return (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {s}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your project requirements..." rows={4} />
            </div>

            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Project
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
