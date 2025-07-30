
"use client";

import { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, Users, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface User {
  id: string;
  nickname: string;
  avatar: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

interface Chat {
  id: string;
  participants: string[];
}

export default function MessagingPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Fetch all users except the current one
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const allUsers = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as User))
          .filter(u => u.id !== user.id); // Ensure we filter out the current user
        setUsers(allUsers);
      } catch (error) {
        console.error("Error fetching users: ", error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [user]);

  // Handle selecting a user and finding/creating a chat
  const handleUserSelect = async (selected: User) => {
    if (!user) return;
    setSelectedUser(selected);
    setLoadingMessages(true);
    setMessages([]); // Clear previous messages
    
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', user.id));
      const querySnapshot = await getDocs(q);
      
      let existingChat: (Chat & { id: string }) | null = null;
      querySnapshot.forEach(doc => {
        const chat = doc.data() as Chat;
        if (chat.participants.includes(selected.id)) {
          existingChat = { id: doc.id, ...chat };
        }
      });

      let currentChatId;
      if (existingChat) {
        currentChatId = existingChat.id;
      } else {
        const newChatRef = await addDoc(chatsRef, {
          participants: [user.id, selected.id],
        });
        currentChatId = newChatRef.id;
      }
      setChatId(currentChatId);

    } catch (error) {
      console.error("Error finding or creating chat: ", error);
    } 
  };
  
   // Listen for messages in the selected chat
  useEffect(() => {
    if (!chatId) {
        setLoadingMessages(false);
        return;
    };

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chatId || !user) return;

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        senderId: user.id,
        text: newMessage,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message: ", error);
    }
  };

  const getAvatarFallback = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar - User List */}
      <aside className={`flex flex-col w-full md:w-1/3 lg:w-1/4 bg-card border-r border-border transition-transform duration-300 ease-in-out ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-bold flex items-center"><Users className="mr-2" /> Mọi người</h2>
        </div>
        <ScrollArea className="flex-1">
          {loadingUsers ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                  <div className="w-full space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <nav className="p-2 space-y-1">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleUserSelect(u)}
                  className={`w-full text-left flex items-center p-2 rounded-lg transition-colors hover:bg-accent ${selectedUser?.id === u.id ? 'bg-accent' : ''}`}
                >
                  <Avatar className="w-10 h-10 mr-3">
                    <AvatarImage src={u.avatar} />
                    <AvatarFallback>{getAvatarFallback(u.nickname)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{u.nickname}</span>
                </button>
              ))}
            </nav>
          )}
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex flex-col flex-1 transition-transform duration-300 ease-in-out ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <header className="flex items-center p-3 border-b border-border bg-card">
              <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setSelectedUser(null)}>
                <ArrowLeft />
              </Button>
              <Avatar className="w-10 h-10 mr-3">
                <AvatarImage src={selectedUser.avatar} />
                <AvatarFallback>{getAvatarFallback(selectedUser.nickname)}</AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-semibold">{selectedUser.nickname}</h2>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-background/50">
              <div className="space-y-4">
                 {loadingMessages ? (
                   <div className="text-center text-muted-foreground">Đang tải tin nhắn...</div>
                 ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                      {msg.senderId !== user?.id && (
                         <Avatar className="w-8 h-8">
                           <AvatarImage src={selectedUser.avatar} />
                           <AvatarFallback>{getAvatarFallback(selectedUser.nickname)}</AvatarFallback>
                         </Avatar>
                      )}
                      <div className={`rounded-lg px-3 py-2 max-w-xs md:max-w-md lg:max-w-lg ${msg.senderId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </div>
                  ))
                 )}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  placeholder="Nhập tin nhắn..."
                  className="flex-1"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  disabled={loadingMessages}
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim() || loadingMessages}>
                  <Send />
                </Button>
              </div>
            </div>
          </>
        ) : (
           <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground bg-background/50">
             <MessageCircle className="w-16 h-16 mb-4" />
             <h2 className="text-2xl font-semibold">Bắt đầu trò chuyện</h2>
             <p className="max-w-xs mt-2">Chọn một người từ danh sách bên trái để xem tin nhắn của bạn.</p>
           </div>
        )}
      </main>
    </div>
  );
}
