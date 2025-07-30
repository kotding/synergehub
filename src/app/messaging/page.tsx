
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, query, getDocs, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadString } from "firebase/storage";
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, Users, MessageCircle, ImagePlus, Loader2, Download, Smile, PlusCircle, CheckCircle, UserPlus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


interface User {
  id: string;
  nickname: string;
  avatar: string;
  username: string;
  bio: string;
  role: 'user' | 'admin';
}

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  timestamp: any;
  senderInfo?: {
    nickname: string;
    avatar: string;
  }
}

interface Chat {
  id: string;
  participants: string[];
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
  admins?: string[];
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
}

export default function MessagingPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Dialog states
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<User | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', avatarFile: null as string | null, avatarPreview: "https://placehold.co/128x128.png", members: new Set<string>() });

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Memoized sorted chats
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const timeA = a.lastMessageTimestamp?.toMillis() || 0;
      const timeB = b.lastMessageTimestamp?.toMillis() || 0;
      return timeB - timeA;
    });
  }, [chats]);

  // Fetch all users once
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        const allUsers = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as User))
          .filter(u => u.id !== user.id); // Exclude self
        setUsers(allUsers);
      } catch (error) {
        console.error("Error fetching users: ", error);
        toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải danh sách người dùng." });
      }
    };
    fetchUsers();
  }, [user, toast]);

  // Fetch chats the user is a part of
  useEffect(() => {
    if (!user) return;
    setLoadingChats(true);
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', user.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(userChats);
      setLoadingChats(false);
    }, (error) => {
      console.error("Error fetching chats: ", error);
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải danh sách cuộc trò chuyện. Có thể cần tạo chỉ mục trong Firestore." });
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user, toast]);


  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('div:first-child') as HTMLElement;
        if(scrollContainer){
            setTimeout(() => scrollContainer.scrollTop = scrollContainer.scrollHeight, 100);
        }
    }
  }, [messages]);
  
  // Listen for messages in the selected chat
  useEffect(() => {
    if (!selectedChat?.id) {
        setMessages([]);
        setLoadingMessages(false);
        return;
    };

    setLoadingMessages(true);
    const messagesRef = collection(db, 'chats', selectedChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const newMsgs: Message[] = [];
        const senderProfiles: Record<string, User> = {};

        // Efficiently fetch sender profiles
        const senderIds = [...new Set(querySnapshot.docs.map(doc => doc.data().senderId))];
        const userDocs = await Promise.all(senderIds.map(id => getDoc(doc(db, "users", id))));
        userDocs.forEach(userDoc => {
            if (userDoc.exists()) {
                senderProfiles[userDoc.id] = { id: userDoc.id, ...userDoc.data() } as User;
            }
        });

        querySnapshot.forEach(doc => {
            const data = doc.data() as Omit<Message, 'id'>;
            const msg: Message = { id: doc.id, ...data };
            
            if (selectedChat.isGroup && senderProfiles[msg.senderId]) {
                 msg.senderInfo = { 
                    nickname: senderProfiles[msg.senderId].nickname, 
                    avatar: senderProfiles[msg.senderId].avatar,
                };
            }
            newMsgs.push(msg);
        });

        // Play sound for new messages from others
        if (newMsgs.length > messages.length && messages.length > 0) {
            const lastMessage = newMsgs[newMsgs.length - 1];
            if (lastMessage.senderId !== user?.id) {
                audioRef.current?.play().catch(e => console.log("Audio play failed:", e));
            }
        }
        
        setMessages(newMsgs);
        setLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể tải tin nhắn." });
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [selectedChat, toast, user, messages.length]);

  // Handle selecting a user to start a 1-on-1 chat
  const handleUserSelect = async (selected: User) => {
    if (!user) return;
    
    // Check if a 1-on-1 chat already exists
    const existingChat = chats.find(c => !c.isGroup && c.participants.length === 2 && c.participants.includes(selected.id));
    
    if (existingChat) {
        setSelectedChat(existingChat);
    } else {
        // Create a new 1-on-1 chat
        try {
            const newChatRef = doc(collection(db, 'chats'));
            const newChat: Chat = {
                id: newChatRef.id,
                participants: [user.id, selected.id],
                isGroup: false,
                lastMessageTimestamp: serverTimestamp() as Timestamp
            };
            await setDoc(newChatRef, newChat);
            setSelectedChat(newChat);
        } catch (error) {
            console.error("Error creating chat: ", error);
            toast({ variant: "destructive", title: "Lỗi", description: "Không thể bắt đầu cuộc trò chuyện." });
        }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat?.id || !user || isSending) return;

    setIsSending(true);
    const textToSend = newMessage;
    setNewMessage('');
    
    try {
      const messagesRef = collection(db, 'chats', selectedChat.id, 'messages');
      await addDoc(messagesRef, {
        senderId: user.id,
        text: textToSend,
        timestamp: serverTimestamp(),
      });
      // Update last message on chat
      await setDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: textToSend,
        lastMessageTimestamp: serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error("Error sending message: ", error);
      toast({ variant: "destructive", title: "Lỗi", description: "Không thể gửi tin nhắn." });
      setNewMessage(textToSend); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat?.id || !user) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: "destructive", title: "Lỗi", description: "Kích thước ảnh không được vượt quá 5MB." });
        return;
    }

    setIsUploading(true);
    try {
        const storageRef = ref(storage, `chat_images/${selectedChat.id}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);

        const messagesRef = collection(db, 'chats', selectedChat.id, 'messages');
        await addDoc(messagesRef, {
            senderId: user.id,
            imageUrl: imageUrl,
            timestamp: serverTimestamp(),
        });
        
        await setDoc(doc(db, 'chats', selectedChat.id), {
            lastMessage: "Đã gửi một ảnh",
            lastMessageTimestamp: serverTimestamp()
        }, { merge: true });

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
  
  const handleCreateGroup = async () => {
      if(!profile || profile.role !== 'admin' || !newGroup.name.trim() || newGroup.members.size === 0) {
          toast({ variant: "destructive", title: "Lỗi", description: "Tên nhóm và ít nhất một thành viên là bắt buộc." });
          return;
      }
      setIsSending(true);
      try {
          const groupChatRef = doc(collection(db, "chats"));
          let groupAvatarUrl = "https://placehold.co/128x128.png";
          
          if(newGroup.avatarFile) {
              const storageRef = ref(storage, `group_avatars/${groupChatRef.id}`);
              await uploadString(storageRef, newGroup.avatarFile, 'data_url');
              groupAvatarUrl = await getDownloadURL(storageRef);
          }
          
          const newChatData: Chat = {
              id: groupChatRef.id,
              isGroup: true,
              groupName: newGroup.name,
              groupAvatar: groupAvatarUrl,
              admins: [profile.id],
              participants: [profile.id, ...Array.from(newGroup.members)],
              lastMessage: `Nhóm được tạo bởi ${profile.nickname}`,
              lastMessageTimestamp: serverTimestamp() as Timestamp
          };
          
          await setDoc(groupChatRef, newChatData);
          
          toast({ title: "Thành công", description: `Nhóm "${newGroup.name}" đã được tạo.` });
          setIsCreatingGroup(false);
          setNewGroup({ name: '', avatarFile: null, avatarPreview: "https://placehold.co/128x128.png", members: new Set() });

      } catch (error) {
          console.error("Error creating group:", error);
          toast({ variant: "destructive", title: "Lỗi", description: "Không thể tạo nhóm." });
      } finally {
          setIsSending(false);
      }
  }

  const handleGroupAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setNewGroup(prev => ({...prev, avatarPreview: result, avatarFile: result}));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleMemberToggle = (userId: string) => {
      setNewGroup(prev => {
          const newMembers = new Set(prev.members);
          if (newMembers.has(userId)) {
              newMembers.delete(userId);
          } else {
              newMembers.add(userId);
          }
          return { ...prev, members: newMembers };
      });
  }

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prevMessage => prevMessage + emojiData.emoji);
  };
  
  const handleDownloadImage = () => {
    if (!viewingImage) return;
    fetch(viewingImage)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
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

  const getChatPartner = (chat: Chat): User | null => {
      if (!user || chat.isGroup) return null;
      const partnerId = chat.participants.find(p => p !== user.id);
      return users.find(u => u.id === partnerId) || null;
  }
  
  const getAvatarFallback = (name?: string) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };
  
  const renderChatHeader = () => {
      if (!selectedChat) return null;
      let avatarUrl: string | undefined;
      let name: string | undefined;
      let partner: User | null = null;
      
      if(selectedChat.isGroup) {
          avatarUrl = selectedChat.groupAvatar;
          name = selectedChat.groupName;
      } else {
          partner = getChatPartner(selectedChat);
          if (partner) {
            avatarUrl = partner.avatar;
            name = partner.nickname;
          }
      }

      return (
        <header className="flex items-center p-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={() => setSelectedChat(null)}>
            <ArrowLeft />
          </Button>
          <button 
            className="flex items-center gap-3 text-left hover:bg-accent/50 p-1 rounded-md transition-colors disabled:cursor-default disabled:hover:bg-transparent" 
            onClick={() => partner && setViewingProfile(partner)}
            disabled={!partner}
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{getAvatarFallback(name)}</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-semibold">{name || 'Chat'}</h2>
          </button>
        </header>
      );
  }

  const getUserById = (userId: string) => users.find(u => u.id === userId);


  return (
    <>
      {/* Preload audio */}
      <audio ref={audioRef} src="/notification.mp3" preload="auto" className="hidden" />

      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Sidebar - Chat List */}
        <aside className={`flex flex-col w-full md:w-1/3 lg:w-1/4 bg-card border-r border-border transition-transform duration-300 ease-in-out ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center"><Users className="mr-2" /> Trò chuyện</h2>
             {profile?.role === 'admin' && (
              <Button size="sm" variant="ghost" onClick={() => setIsCreatingGroup(true)} >
                  <PlusCircle className="mr-2 h-4 w-4"/> Tạo nhóm
              </Button>
             )}
          </div>
          <ScrollArea className="flex-1">
            {loadingChats ? (
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <nav className="p-2 space-y-1">
                 {sortedChats.map(chat => {
                    if (chat.isGroup) {
                        return (
                             <button
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={`w-full text-left flex items-center p-2 rounded-lg transition-colors hover:bg-accent ${selectedChat?.id === chat.id ? 'bg-accent' : ''}`}
                              >
                                <Avatar className="w-10 h-10 mr-3">
                                  <AvatarImage src={chat.groupAvatar} />
                                  <AvatarFallback>{getAvatarFallback(chat.groupName)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <span className="font-medium">{chat.groupName}</span>
                                    <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                                </div>
                              </button>
                        )
                    }
                    
                    const partner = getChatPartner(chat);
                    if (!partner) return null;

                    return (
                         <button
                            key={chat.id}
                            onClick={() => setSelectedChat(chat)}
                            className={`w-full text-left flex items-center p-2 rounded-lg transition-colors hover:bg-accent ${selectedChat?.id === chat.id ? 'bg-accent' : ''}`}
                          >
                            <Avatar className="w-10 h-10 mr-3">
                              <AvatarImage src={partner.avatar} />
                              <AvatarFallback>{getAvatarFallback(partner.nickname)}</AvatarFallback>
                            </Avatar>
                             <div className="flex-1 truncate">
                                <span className="font-medium">{partner.nickname}</span>
                                 {chat.lastMessage && <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>}
                            </div>
                          </button>
                    )
                 })}
              </nav>
            )}
          </ScrollArea>
        </aside>

        {/* Main Chat Area */}
        <main className={`flex flex-col flex-1 transition-transform duration-300 ease-in-out ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {selectedChat ? (
            <>
              {renderChatHeader()}

              {/* Messages */}
              <ScrollArea className="flex-1 p-4 bg-background/50" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const sender = getUserById(msg.senderId);
                      const senderIsAdmin = sender?.role === 'admin';
                      const showSender = selectedChat.isGroup && (index === 0 || messages[index-1].senderId !== msg.senderId);

                      return (
                      <div key={msg.id} className={`flex flex-col gap-1`}>
                        {showSender && msg.senderInfo && (
                            <div className={`flex items-center gap-2 ${msg.senderId === user?.id ? 'justify-end' : 'justify-start ml-10'}`}>
                                <button 
                                  onClick={() => sender && setViewingProfile(sender)}
                                  disabled={!sender}
                                  className={`text-xs font-bold hover:underline ${senderIsAdmin ? 'text-primary' : 'text-muted-foreground'}`}
                                >
                                    {msg.senderInfo.nickname}
                                </button>
                            </div>
                        )}
                        <div className={`flex items-end gap-2 ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
                          {msg.senderId !== user?.id && (
                            <button 
                                onClick={() => sender && setViewingProfile(sender)}
                                disabled={!sender}
                                className={`transition-opacity duration-300 ${showSender ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <Avatar className={`w-8 h-8 `}>
                                {msg.senderInfo && <AvatarImage src={msg.senderInfo.avatar} />}
                                <AvatarFallback>{getAvatarFallback(msg.senderInfo?.nickname)}</AvatarFallback>
                                </Avatar>
                            </button>
                          )}
                           <div className={`max-w-xs md:max-w-md lg:max-w-lg break-words ${msg.imageUrl ? 'bg-transparent' : (msg.senderId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-card border')} rounded-lg ${msg.text ? 'px-3 py-2' : 'p-0'}`}>
                            {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
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
                      </div>
                      )
                    })
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
                      disabled={isUploading || isSending}
                      title="Gửi ảnh"
                  >
                      <ImagePlus />
                  </Button>
                  
                  <Popover>
                      <PopoverTrigger asChild>
                           <Button 
                              variant="ghost" 
                              size="icon"
                              disabled={isUploading || isSending}
                              title="Gửi biểu cảm"
                          >
                              <Smile />
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-none">
                          <EmojiPicker onEmojiClick={onEmojiClick} />
                      </PopoverContent>
                  </Popover>

                  <Input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    className="flex-1"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    disabled={isUploading}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isUploading || isSending}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground bg-background/50">
              <MessageCircle className="w-16 h-16 mb-4" />
              <h2 className="text-2xl font-semibold">Bắt đầu trò chuyện</h2>
              <p className="max-w-xs mt-2">Chọn một người hoặc một nhóm để xem tin nhắn.</p>
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
      
      {/* User Profile Dialog */}
      {viewingProfile && (
        <Dialog open={!!viewingProfile} onOpenChange={() => setViewingProfile(null)}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
             <div className="h-24 bg-gradient-to-r from-primary via-accent to-secondary"/>
             <div className="p-6 pt-0 -mt-12">
                <div className="flex flex-col items-center text-center gap-4">
                     <Avatar className="w-24 h-24 border-4 border-background shadow-md">
                      <AvatarImage src={viewingProfile.avatar} />
                      <AvatarFallback className="text-4xl">{getAvatarFallback(viewingProfile.nickname)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <DialogTitle className="text-2xl">{viewingProfile.nickname}</DialogTitle>
                           {viewingProfile.role === 'admin' && (
                             <div className="relative group">
                                <CheckCircle className="h-6 w-6 text-primary" />
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping"/>
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full"/>
                             </div>
                           )}
                        </div>
                        <DialogDescription>@{viewingProfile.username}</DialogDescription>
                    </div>
                </div>
                 <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">{viewingProfile.bio || "Người dùng này chưa có tiểu sử."}</p>
                </div>
             </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Group Dialog */}
       <Dialog open={isCreatingGroup} onOpenChange={setIsCreatingGroup}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Tạo nhóm trò chuyện mới</DialogTitle>
                    <DialogDescription>Chọn thành viên và đặt tên cho nhóm của bạn.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center space-x-4">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={newGroup.avatarPreview} data-ai-hint="group avatar placeholder" />
                            <AvatarFallback>G</AvatarFallback>
                        </Avatar>
                        <Button variant="outline" onClick={() => groupAvatarInputRef.current?.click()}>Chọn ảnh nhóm</Button>
                        <input type="file" ref={groupAvatarInputRef} onChange={handleGroupAvatarChange} className="hidden" accept="image/*" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="group-name">Tên nhóm</Label>
                        <Input id="group-name" value={newGroup.name} onChange={(e) => setNewGroup(p => ({...p, name: e.target.value}))} placeholder="Ví dụ: Team Dự án X"/>
                    </div>
                    <div className="space-y-2">
                         <Label>Thành viên</Label>
                         <ScrollArea className="h-48 border rounded-md">
                             <div className="p-4 space-y-2">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center space-x-3">
                                        <Checkbox 
                                            id={`member-${u.id}`} 
                                            checked={newGroup.members.has(u.id)}
                                            onCheckedChange={() => handleMemberToggle(u.id)}
                                        />
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={u.avatar} />
                                            <AvatarFallback>{getAvatarFallback(u.nickname)}</AvatarFallback>
                                        </Avatar>
                                        <Label htmlFor={`member-${u.id}`} className="font-normal cursor-pointer">{u.nickname}</Label>
                                    </div>
                                ))}
                             </div>
                         </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Hủy</Button>
                    </DialogClose>
                    <Button onClick={handleCreateGroup} disabled={isSending}>
                        {isSending ? <Loader2 className="animate-spin"/> : "Tạo nhóm"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}

    