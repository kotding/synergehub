
"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  orderBy
} from 'firebase/firestore';
import {
  Bold,
  Code,
  Italic,
  Plus,
  Trash2,
  FileText,
  Loader2,
  Palette,
  Link as LinkIcon,
  Strikethrough,
  Underline
} from 'lucide-react';
import {
  Plate,
  createPlateEditor,
  PlateContent,
  TEditableProps,
} from '@udecode/plate-common';
import {
    createLinkPlugin,
    ELEMENT_LINK,
} from '@udecode/plate-link';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
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
import {
    createBoldPlugin,
    createItalicPlugin,
    createUnderlinePlugin,
    createStrikethroughPlugin,
    createCodePlugin,
    MARK_BOLD,
    MARK_ITALIC,
    MARK_UNDERLINE,
    MARK_STRIKETHROUGH,
    MARK_CODE,
} from '@udecode/plate-basic-marks';
import { createPlugins } from '@udecode/plate-common';
import { MarkToolbarButton } from '@/components/plate/mark-toolbar-button';
import { ColorDropdownMenu } from '@/components/plate/color-dropdown-menu';
import {
    createFontColorPlugin,
    createFontBackgroundColorPlugin,
} from '@udecode/plate-font';
import { LinkToolbarButton } from '@/components/plate/link-toolbar-button';


type Note = {
  id: string;
  title: string;
  content: any;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

const plugins = createPlugins(
    [
        createBoldPlugin(),
        createItalicPlugin(),
        createUnderlinePlugin(),
        createStrikethroughPlugin(),
        createCodePlugin(),
        createFontColorPlugin(),
        createFontBackgroundColorPlugin(),
        createLinkPlugin(),
    ],
    {
        components: {},
    }
);

const initialValue = [
  {
    type: 'p',
    children: [{ text: 'Ghi chú mới...' }],
  },
];


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

      const docChanges = snapshot.docChanges();
      
      const addedChange = docChanges.find(change => change.type === 'added');

      if (addedChange) {
        const newNoteId = addedChange.doc.id;
        const noteToSelect = userNotes.find(n => n.id === newNoteId);
        if (noteToSelect) {
          setSelectedNote(noteToSelect);
        }
      } else if (selectedNote) {
        const updatedSelected = userNotes.find(n => n.id === selectedNote.id);
        if (updatedSelected) {
           if (JSON.stringify(updatedSelected) !== JSON.stringify(selectedNote)) {
              setSelectedNote(updatedSelected);
           }
        } else if (userNotes.length > 0) {
          setSelectedNote(userNotes[0]);
        } else {
          setSelectedNote(null);
        }
      } else if (userNotes.length > 0) {
        setSelectedNote(userNotes[0]);
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
    const newNoteRef = collection(db, 'notes');
    const newNote: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any } = {
      title: 'Ghi chú không có tiêu đề',
      content: initialValue,
      ownerId: user.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(newNoteRef, newNote);
  };
  

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteDoc(doc(db, 'notes', noteId));
  };

  return (
    <DndProvider backend={HTML5Backend}>
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
    </DndProvider>
  );
}

const editableProps: TEditableProps = {
    className: 'outline-none prose prose-neutral dark:prose-invert max-w-full p-8 flex-1',
    autoFocus: true,
};

function Editor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(note.updatedAt ? note.updatedAt.toDate() : new Date());

  const editor = useMemo(() => createPlateEditor({ plugins }), []);
  
  const debouncedSave = useDebouncedCallback(async (newTitle: string, newContent: any) => {
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
  }, 1500);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    debouncedSave(newTitle, editor.children);
  };
  
  const handleContentChange = (newContent: any) => {
    debouncedSave(title, newContent);
  };

  useEffect(() => {
    if (note.updatedAt) {
      setLastSaved(note.updatedAt.toDate());
    }
  }, [note.updatedAt]);

  return (
    <Plate
        editor={editor}
        initialValue={note.content}
        onChange={handleContentChange}
    >
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
            <div className="p-2 border-b border-border sticky top-0 bg-background z-10">
                <PlateToolbar />
            </div>
            <PlateContent {...editableProps}/>
        </div>
    </Plate>
  );
}

function PlateToolbar() {
    return (
        <div className="flex items-center gap-1">
            <MarkToolbarButton tooltip="In đậm" nodeType={MARK_BOLD}>
                <Bold />
            </MarkToolbarButton>
            <MarkToolbarButton tooltip="In nghiêng" nodeType={MARK_ITALIC}>
                <Italic />
            </MarkToolbarButton>
             <MarkToolbarButton tooltip="Gạch chân" nodeType={MARK_UNDERLINE}>
                <Underline />
            </MarkToolbarButton>
            <MarkToolbarButton tooltip="Gạch ngang" nodeType={MARK_STRIKETHROUGH}>
                <Strikethrough />
            </MarkToolbarButton>
            <MarkToolbarButton tooltip="Mã" nodeType={MARK_CODE}>
                <Code />
            </MarkToolbarButton>
            
            <ColorDropdownMenu nodeType="color" tooltip="Màu chữ">
                <Palette className="h-4 w-4" />
            </ColorDropdownMenu>
            <ColorDropdownMenu nodeType="backgroundColor" tooltip="Màu nền">
                <Palette className="h-4 w-4" />
            </ColorDropdownMenu>
            <LinkToolbarButton tooltip="Link">
                <LinkIcon />
            </LinkToolbarButton>

        </div>
    );
}

    