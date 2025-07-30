
"use client";

import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, Users, MessageCircle, ImagePlus, Loader2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';


interface User {
  id: string;
  nickname: string;
  avatar: string;
}

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  timestamp: any;
}

interface Chat {
  id: string;
  participants: string[];
}

export default function MessagingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);


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
          .filter(u => u.id !== user.id);
        setUsers(allUsers);
      } catch (error) {
        console.error("Error fetching users: ", error);
        toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải danh sách người dùng." });
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [user, toast]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('div:first-child') as HTMLElement;
        if(scrollContainer){
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }
  }, [messages]);


  // Handle selecting a user and finding/creating a chat
  const handleUserSelect = async (selected: User) => {
    if (!user) return;
    setSelectedUser(selected);
    setLoadingMessages(true);
    setMessages([]);
    setChatId(null);
    
    try {
      const chatsRef = collection(db, 'chats');
      // Query for chats where user.id is a participant
      const q = query(chatsRef, where('participants', 'array-contains', user.id));
      const querySnapshot = await getDocs(q);
      
      let existingChat: (Chat & { id: string }) | null = null;
      // Find the specific chat that also includes the selected user
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
          createdAt: serverTimestamp(),
        });
        currentChatId = newChatRef.id;
      }
      setChatId(currentChatId);

    } catch (error) {
      console.error("Error finding or creating chat: ", error);
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể bắt đầu cuộc trò chuyện." });
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
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải tin nhắn." });
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [chatId, toast]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !isUploading) || !chatId || !user) return;

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
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể gửi tin nhắn." });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !chatId || !user) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: "destructive", title: "Lỗi", description: "Kích thước ảnh không được vượt quá 5MB." });
        return;
    }

    setIsUploading(true);
    try {
        const storageRef = ref(storage, `chat_images/${chatId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);

        const messagesRef = collection(db, 'chats', chatId, 'messages');
        await addDoc(messagesRef, {
            senderId: user.id,
            imageUrl: imageUrl,
            timestamp: serverTimestamp(),
        });

    } catch (error) {
        console.error("Error uploading image: ", error);
        toast({ variant: "destructive", title: "Lỗi gửi ảnh", description: (error as Error).message });
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  };

  const getAvatarFallback = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };
  
  const handleDownloadImage = () => {
    if (!viewingImage) return;
    // Using fetch to bypass browser CORS issues with direct download
    fetch(viewingImage)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        // Give the file a name
        a.download = `synergy-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      })
      .catch((error) => {
        console.error("Error downloading image:", error)
        toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải ảnh xuống." });
      });
  };

  return (
    <>
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
              <ScrollArea className="flex-1 p-4 bg-background/50" ref={scrollAreaRef}>
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
                         <div className={`max-w-xs md:max-w-md lg:max-w-lg ${msg.imageUrl ? 'bg-transparent' : (msg.senderId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-card border')} rounded-lg ${msg.text ? 'px-3 py-2' : 'p-0'}`}>
                          {msg.text && <p className="text-sm">{msg.text}</p>}
                          {msg.imageUrl && (
                            <button onClick={() => setViewingImage(msg.imageUrl!)} className="w-full h-full block">
                                <Image 
                                  src={msg.imageUrl} 
                                  alt="Ảnh đã gửi" 
                                  width={250} 
                                  height={250}
                                  className="rounded-md object-cover max-w-full h-auto"
                                />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isUploading && (
                      <div className="flex justify-end">
                          <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-3 py-2">
                            <Loader2 className="h-4 w-4 animate-spin"/>
                            <p className="text-sm">Đang gửi ảnh...</p>
                          </div>
                      </div>
                  )}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex items-center space-x-2">
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                      accept="image/png, image/jpeg, image/gif"
                      disabled={isUploading}
                  />
                  <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      title="Gửi ảnh"
                  >
                      <ImagePlus />
                  </Button>
                  <Input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    className="flex-1"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    disabled={loadingMessages || isUploading}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || loadingMessages || isUploading}>
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

       {/* Image Viewer Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={(isOpen) => !isOpen && setViewingImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Xem ảnh</DialogTitle>
          </DialogHeader>
          <div className="p-4 flex justify-center items-center">
            {viewingImage && (
              <Image 
                src={viewingImage} 
                alt="Image preview" 
                width={800} 
                height={600}
                className="rounded-md object-contain max-h-[70vh]" 
              />
            )}
          </div>
           <DialogFooter className="p-4 pt-0">
            <Button onClick={handleDownloadImage}>
              <Download className="mr-2 h-4 w-4" />
              Tải xuống
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
