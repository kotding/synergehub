
"use client";

import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  addDoc,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import {
  Plus,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipProvider,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';


type Note = {
  id: string;
  title: string;
  content: string; // Changed from 'any' to 'string'
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoadingNotes(true);
    const q = query(
      collection(db, 'notes'),
      where('ownerId', '==', user.id),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userNotes = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Note)
      );
      setNotes(userNotes);
      setLoadingNotes(false);

      if (userNotes.length > 0) {
        // If there's no selected note, or the selected note was deleted, select the first one.
        const currentSelectedExists = userNotes.some(n => n.id === selectedNote?.id);
        if (!selectedNote || !currentSelectedExists) {
          setSelectedNote(userNotes[0]);
        } else {
            // If the selected note still exists, update its content from the snapshot
            const updatedNote = userNotes.find(n => n.id === selectedNote.id);
            if (updatedNote) {
                setSelectedNote(updatedNote);
            }
        }
      } else {
        setSelectedNote(null);
      }

    }, (error) => {
        console.error("Firestore snapshot error:", error);
        setLoadingNotes(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateNote = async () => {
    if (!user) return;
    const newNoteData: Omit<Note, 'id'> = {
      title: 'Ghi chú không có tiêu đề',
      content: 'Bắt đầu viết...',
      ownerId: user.id,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    const newNoteRef = await addDoc(collection(db, 'notes'), newNoteData);
    // Firestore listener will pick up the new note and update the state
  };
  

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteDoc(doc(db, 'notes', noteId));
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <aside className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText />
              Ghi chú của bạn
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={handleCreateNote}>
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tạo ghi chú mới</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <ScrollArea className="flex-1">
            {loadingNotes ? (
              <div className="p-4"><Loader2 className="animate-spin" /></div>
            ) : (
              <nav className="p-2">
                {notes.map((note) => (
                  <div key={note.id} className="relative group">
                    <button
                      onClick={() => handleSelectNote(note)}
                      className={cn(
                        'w-full text-left p-2 rounded-md truncate hover:bg-accent',
                        selectedNote?.id === note.id && 'bg-accent'
                      )}
                    >
                      {note.title}
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Bạn có chắc chắn?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Hành động này không thể được hoàn tác. Điều này sẽ xóa vĩnh viễn ghi chú của bạn.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteNote(note.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </nav>
            )}
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col">
          {selectedNote ? (
            <Editor key={selectedNote.id} note={selectedNote} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-medium">Không có ghi chú nào được chọn</h3>
                <p className="mt-1 text-sm">Chọn một ghi chú từ danh sách hoặc tạo một ghi chú mới.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}

function Editor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(note.updatedAt ? note.updatedAt.toDate() : new Date());

  const debouncedSave = useDebouncedCallback(async ({ newTitle, newContent }: { newTitle: string, newContent: string }) => {
    setIsSaving(true);
    const noteRef = doc(db, 'notes', note.id);
    const finalTitle = newTitle.trim() === '' ? 'Ghi chú không có tiêu đề' : newTitle;

    await setDoc(noteRef, { 
        title: finalTitle,
        content: newContent,
        updatedAt: serverTimestamp() 
    }, { merge: true });
    
    setIsSaving(false);
    setLastSaved(new Date());
  }, 1000);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    debouncedSave({ newTitle, newContent: content });
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      debouncedSave({ newTitle: title, newContent });
  };

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    if (note.updatedAt) {
      setLastSaved(note.updatedAt.toDate());
    }
  }, [note]);

  return (
    <div className="flex flex-col flex-1">
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
            <Input
              value={title}
              onChange={handleTitleChange}
              placeholder="Tiêu đề ghi chú"
              className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                  <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lưu...</span>
                  </>
              ) : (
                  <span>
                  Đã lưu lúc {lastSaved.toLocaleTimeString()}
                  </span>
              )}
            </div>
        </div>
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Viết điều gì đó..."
          className="flex-1 w-full h-full p-8 text-base resize-none border-none focus-visible:ring-0"
          autoFocus
        />
    </div>
  );
}
