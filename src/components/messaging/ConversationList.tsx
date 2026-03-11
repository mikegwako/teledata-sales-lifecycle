import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/UserAvatar';
import { Plus, Search, MessageSquare, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Conversation {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  updated_at: string;
  unread_count: number;
  last_message?: string;
  participants: { user_id: string; full_name: string | null; avatar_url: string | null; avatar_position: string }[];
}

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({ selectedId, onSelect, onNewConversation }: ConversationListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchConversations = async () => {
    if (!user) return;

    // Get conversations user participates in
    const { data: convos } = await supabase
      .from('conversations')
      .select('id, title, description, created_by, updated_at')
      .order('updated_at', { ascending: false });

    if (!convos) { setLoading(false); return; }

    // For each conversation, get participants and last message
    const enriched = await Promise.all(convos.map(async (c) => {
      const [{ data: participants }, { data: msgs }, { data: myParticipation }] = await Promise.all([
        supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', c.id),
        supabase
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('conversation_participants')
          .select('last_read_at')
          .eq('conversation_id', c.id)
          .eq('user_id', user.id)
          .single(),
      ]);

      // Get profiles for participants
      const userIds = (participants || []).map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_position')
        .in('id', userIds);

      const participantProfiles = (profiles || []).map(p => ({
        user_id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        avatar_position: p.avatar_position,
      }));

      // Count unread messages
      let unread_count = 0;
      if (myParticipation?.last_read_at) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .gt('created_at', myParticipation.last_read_at)
          .neq('sender_id', user.id);
        unread_count = count || 0;
      }

      return {
        ...c,
        participants: participantProfiles,
        last_message: msgs?.[0]?.content || null,
        unread_count,
      };
    }));

    setConversations(enriched as Conversation[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();

    // Listen for new messages to refresh list
    const channel = supabase
      .channel('conversation-list-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants' }, () => fetchConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.participants.some(p => p.full_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const getOtherParticipants = (c: Conversation) =>
    c.participants.filter(p => p.user_id !== user?.id);

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Messages
          </h2>
          <Button size="icon" variant="default" className="h-8 w-8 rounded-lg" onClick={onNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-8 h-8 text-sm bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <Button variant="link" size="sm" className="mt-1 text-primary" onClick={onNewConversation}>
                Start one →
              </Button>
            </div>
          ) : (
            filtered.map(c => {
              const others = getOtherParticipants(c);
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                    selectedId === c.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Avatar stack */}
                    <div className="relative shrink-0 mt-0.5">
                      {others.length > 0 ? (
                        <>
                          <UserAvatar
                            fullName={others[0].full_name}
                            avatarUrl={others[0].avatar_url}
                            avatarPosition={others[0].avatar_position}
                            className="h-9 w-9"
                            fallbackClassName="text-xs"
                          />
                          {others.length > 1 && (
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                              <span className="text-[8px] font-bold text-muted-foreground">+{others.length - 1}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium truncate ${c.unread_count > 0 ? 'text-foreground font-semibold' : 'text-foreground/80'}`}>
                          {c.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatDistanceToNow(new Date(c.updated_at), { addSuffix: false })}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${c.unread_count > 0 ? 'text-foreground/70 font-medium' : 'text-muted-foreground'}`}>
                        {c.last_message || c.description || 'No messages yet'}
                      </p>
                    </div>

                    {c.unread_count > 0 && (
                      <span className="shrink-0 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1.5 mt-1">
                        {c.unread_count > 9 ? '9+' : c.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </>
  );
}
