import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/UserAvatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserOption {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  avatar_position: string;
  role: string;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (!open) return;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_position');

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));

      setUsers(
        (profiles || [])
          .filter(p => p.id !== user?.id)
          .map(p => ({
            ...p,
            role: roleMap.get(p.id) || 'client',
          }))
      );
      setLoadingUsers(false);
    };
    fetchUsers();
    // Reset form
    setTitle('');
    setDescription('');
    setSelectedUsers(new Set());
    setSearch('');
  }, [open, user]);

  const toggleUser = (id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Give this conversation a title'); return; }
    if (selectedUsers.size === 0) { toast.error('Select at least one participant'); return; }
    if (!user) return;

    setCreating(true);

    // Create conversation
    const { data: convo, error: convoErr } = await supabase
      .from('conversations')
      .insert({ title: title.trim(), description: description.trim() || null, created_by: user.id } as any)
      .select('id')
      .single();

    if (convoErr || !convo) {
      toast.error('Failed to create conversation');
      setCreating(false);
      return;
    }

    // Add participants (creator + selected)
    const participantInserts = [user.id, ...Array.from(selectedUsers)].map(uid => ({
      conversation_id: convo.id,
      user_id: uid,
    }));

    await supabase.from('conversation_participants').insert(participantInserts as any);

    setCreating(false);
    onOpenChange(false);
    onCreated(convo.id);
    toast.success('Conversation created!');
  };

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-primary/10 text-primary',
    staff: 'bg-accent/10 text-accent-foreground',
    client: 'bg-muted text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New Conversation</DialogTitle>
          <DialogDescription>Start a private conversation with team members or clients</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title</Label>
            <Input
              placeholder="e.g., Project Discussion, Support Query"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              placeholder="What is this conversation about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Participants</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <ScrollArea className="h-48 rounded-lg border border-border">
              <div className="p-1.5 space-y-0.5">
                {loadingUsers ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No users found</p>
                ) : (
                  filtered.map(u => (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors ${
                        selectedUsers.has(u.id) ? 'bg-primary/5' : 'hover:bg-muted/60'
                      }`}
                    >
                      <Checkbox
                        checked={selectedUsers.has(u.id)}
                        onCheckedChange={() => toggleUser(u.id)}
                      />
                      <UserAvatar
                        fullName={u.full_name}
                        avatarUrl={u.avatar_url}
                        avatarPosition={u.avatar_position}
                        className="h-7 w-7"
                        fallbackClassName="text-[9px]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name || 'Unnamed User'}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${roleBadgeColor[u.role] || roleBadgeColor.client}`}>
                        {u.role}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>

            {selectedUsers.size > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {selectedUsers.size} participant{selectedUsers.size > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={creating || !title.trim() || selectedUsers.size === 0}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Conversation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
