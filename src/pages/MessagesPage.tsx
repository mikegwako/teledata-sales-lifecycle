import { useState } from 'react';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ChatView } from '@/components/messaging/ChatView';
import { NewConversationDialog } from '@/components/messaging/NewConversationDialog';
import { MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConversationCreated = (id: string) => {
    setRefreshKey(k => k + 1);
    setSelectedConversationId(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-4rem)] flex flex-col"
    >
      <div className="flex h-full rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Sidebar - Conversation List */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col bg-muted/30">
          <ConversationList
            key={refreshKey}
            selectedId={selectedConversationId}
            onSelect={(id) => setSelectedConversationId(id || null)}
            onNewConversation={() => setNewDialogOpen(true)}
          />
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversationId ? (
            <ChatView conversationId={selectedConversationId} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Your Messages</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Select a conversation or start a new one to begin messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={handleConversationCreated}
      />
    </motion.div>
  );
}
