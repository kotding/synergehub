
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Upload, Repeat, Repeat1, Shuffle, ListMusic, Music2, Pencil, Save, Loader2, Trash2, ImagePlus, Expand
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from "firebase/storage";
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


interface Track {
  id: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  audioUrl: string;
  ownerId?: string;
  storagePath?: {
      audio: string;
      image?: string;
  };
  dataAiHint?: string;
  createdAt?: any;
}

const defaultPlaylistData: Omit<Track, 'id' | 'ownerId' | 'createdAt'>[] = [
    {
        title: "Inspiring Dreams",
        artist: "AudioCoffee",
        albumArtUrl: "/images/default_music_icon.png",
        dataAiHint: "inspiring abstract",
        audioUrl: "/music/inspiring-dreams.mp3",
    },
    {
        title: "Ambient Classical Guitar",
        artist: "William King",
        albumArtUrl: "/images/default_music_icon.png",
        dataAiHint: "classical guitar",
        audioUrl: "/music/ambient-classical-guitar.mp3",
    },
     {
        title: "Lofi Study",
        artist: "FASSounds",
        albumArtUrl: "/images/default_music_icon.png",
        dataAiHint: "lofi anime",
        audioUrl: "/music/lofi-study.mp3",
    },
];


export default function MusicPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();

  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);
  const [albumArtScale, setAlbumArtScale] = useState(1);
  const [isVisualizeOnly, setIsVisualizeOnly] = useState(false);
  
  // Dialog states
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user's music from Firestore
  useEffect(() => {
    setIsLoading(true);
    const staticDefaultPlaylist = defaultPlaylistData.map((t, i) => ({...t, id: `default-${i}`}));
    
    if (!user) {
        setPlaylist(staticDefaultPlaylist);
        setCurrentTrackIndex(0);
        setIsLoading(false);
        return;
    }

    const q = query(collection(db, 'music'), where('ownerId', '==', user.id), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userMusic = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Track));
      const newPlaylist = userMusic.length > 0 ? userMusic : staticDefaultPlaylist;
      setPlaylist(newPlaylist);
      
      const currentTrackId = playlist[currentTrackIndex]?.id;
      const currentTrackStillExists = newPlaylist.some(t => t.id === currentTrackId);

      if (!currentTrackStillExists) {
          setCurrentTrackIndex(0);
          setIsPlaying(false);
      }

      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching user music:", error);
        toast({ title: "Lỗi", description: "Không thể tải nhạc của bạn.", variant: 'destructive' });
        setPlaylist(staticDefaultPlaylist);
        setIsLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, toast]);
  
  const currentTrack = useMemo(() => {
      if (playlist.length === 0 || isLoading) return null;
      const index = isShuffled ? shuffledIndices[currentTrackIndex] : currentTrackIndex;
      return playlist[index] || null;
  }, [currentTrackIndex, playlist, isShuffled, shuffledIndices, isLoading]);
  
  // Load new track source when currentTrack changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack?.audioUrl) {
      if (audio.src !== currentTrack.audioUrl) {
        audio.src = currentTrack.audioUrl;
        audio.load();
        if (isPlaying) {
          audio.play().catch(e => {
            console.error("Playback error on src change:", e);
          });
        }
      }
    } else if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
  }, [currentTrack, isPlaying]);
  
  // Control play/pause when isPlaying state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
  
    if (isPlaying) {
      if (audio.currentSrc) {
        audio.play().catch(e => {
            console.error("Playback error:", e);
            setIsPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const setupAudioContext = useCallback(() => {
    if (audioRef.current && !sourceRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = context.createMediaElementSource(audioRef.current);
            const analyser = context.createAnalyser();
            
            source.connect(analyser);
            analyser.connect(context.destination);
            analyser.fftSize = 128;
            
            audioContextRef.current = context;
            sourceRef.current = source;
            analyserRef.current = analyser;

        } catch (e) {
            console.warn("Web Audio API is not supported or failed to initialize:", e);
        }
    }
  }, []);

  const drawVisualizer = useCallback(() => {
    if (!isPlaying || !visualizerRef.current || !analyserRef.current) {
        setAlbumArtScale(1);
        return;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = visualizerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Calculate average for pulsing effect
    analyser.getByteTimeDomainData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / bufferLength;
    const normalizedAverage = (average - 128) / 128; // Normalize from -1 to 1
    const newScale = 1 + Math.abs(normalizedAverage) * 0.05; // Subtle pulse effect
    setAlbumArtScale(newScale);

    const renderFrame = () => {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.6)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    renderFrame();
  }, [isPlaying]);

  // Effect to handle starting/stopping the visualizer
  useEffect(() => {
    if (isPlaying) {
        drawVisualizer();
    } else {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setAlbumArtScale(1);
        const canvas = visualizerRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };
  }, [isPlaying, drawVisualizer]);
  
  useEffect(() => {
    return () => {
        animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
        audioContextRef.current?.close();
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;
    
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    } else if (!audioContextRef.current) {
      setupAudioContext(); 
    }
    
    setIsPlaying(!isPlaying);
  };
  
  const generateShuffledIndices = useCallback(() => {
    const indices = Array.from(Array(playlist.length).keys());
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
  }, [playlist.length]);

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length);
  }, [playlist.length]);

  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);
  
  const handleShuffleToggle = () => {
    setIsShuffled(prev => {
        const nextState = !prev;
        if(nextState) {
            generateShuffledIndices();
        } else {
            if (currentTrack) {
              const originalIndex = playlist.findIndex(track => track.id === currentTrack.id);
              setCurrentTrackIndex(originalIndex >= 0 ? originalIndex : 0);
            }
        }
        return nextState;
    });
  };
  
  useEffect(() => {
      if (isShuffled) {
        generateShuffledIndices();
      }
  }, [playlist.length, isShuffled, generateShuffledIndices]);

  const handleProgressChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };
  
  const handleVolumeChange = (value: number[]) => {
    if (audioRef.current) {
        audioRef.current.volume = value[0];
        setVolume(value[0]);
    }
  }

  const handleDeleteTrack = async (trackToDelete: Track) => {
    if (!user || !trackToDelete.ownerId || trackToDelete.ownerId !== user.id) {
        toast({ title: 'Lỗi', description: 'Bạn không có quyền xóa bài hát này.', variant: 'destructive' });
        return;
    }
    
    setIsSaving(true);
    try {
        // Delete from Firestore
        await deleteDoc(doc(db, 'music', trackToDelete.id));

        // Delete from Storage
        if(trackToDelete.storagePath?.audio) {
             const audioRef = ref(storage, trackToDelete.storagePath.audio);
             await deleteObject(audioRef);
        }
        if(trackToDelete.storagePath?.image) {
             const imageRef = ref(storage, trackToDelete.storagePath.image);
             await deleteObject(imageRef);
        }
        
        toast({ title: 'Thành công', description: `Đã xóa bài hát "${trackToDelete.title}".` });

    } catch(error) {
        console.error("Error deleting track:", error);
        toast({ title: 'Lỗi', description: 'Không thể xóa bài hát. Vui lòng thử lại.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }


  const cycleRepeatMode = () => {
      const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setRepeatMode(modes[nextIndex]);
  }

  const onEnded = useCallback(() => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (currentTrackIndex === playlist.length - 1 && repeatMode !== 'all') {
        setIsPlaying(false);
    } else {
        handleNext();
    }
  }, [repeatMode, handleNext, currentTrackIndex, playlist.length]);

  const onLoadedMetadata = () => {
      if(audioRef.current){
        setDuration(audioRef.current.duration);
      }
  }

  const onCanPlay = () => {
    if (audioRef.current && isPlaying) {
        audioRef.current.play().catch(e => {
           console.error("Playback error onCanPlay:", e);
           setIsPlaying(false);
        });
    }
  }

  const onTimeUpdate = () => {
      if(audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
      }
  }
  
  const handleSelectTrack = (index: number) => {
    const targetIndex = isShuffled ? shuffledIndices.findIndex(i => i === index) : index;
    if (currentTrackIndex === targetIndex && audioRef.current && audioRef.current.src) {
        handlePlayPause();
    } else {
        setCurrentTrackIndex(targetIndex);
        if(!isPlaying) {
          setupAudioContext();
          setIsPlaying(true);
        }
    }
  }

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    if (!audioRef.current) return;
    
    const error = audioRef.current.error;
    let errorMessage = "Đã xảy ra lỗi không xác định khi tải âm thanh.";
    
    if (error) {
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                errorMessage = 'Việc tải âm thanh đã bị người dùng hủy bỏ.';
                break;
            case error.MEDIA_ERR_NETWORK:
                errorMessage = 'Lỗi mạng đã ngăn không cho tải âm thanh. Vui lòng kiểm tra lại kết nối và cấu hình CORS trên Firebase Storage.';
                break;
            case error.MEDIA_ERR_DECODE:
                errorMessage = 'Không thể giải mã tệp âm thanh. Tệp có thể bị hỏng hoặc không được hỗ trợ.';
                break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Không tìm thấy nguồn âm thanh được hỗ trợ. Điều này có thể do lỗi CORS hoặc URL không hợp lệ.';
                break;
            default:
                errorMessage = `Đã xảy ra một lỗi không xác định: mã ${error.code}.`;
                break;
        }
    }
    
    console.error("Audio Element Error Event:", e);
    toast({
        title: "Lỗi tải âm thanh",
        description: errorMessage,
        variant: "destructive"
    });
  }


  return (
    <>
    <audio
        ref={audioRef}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onCanPlay={onCanPlay}
        onError={handleAudioError}
        crossOrigin="anonymous"
    />
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Playlist Sidebar */}
        <aside className={cn(
          "w-1/3 lg:w-1/4 h-full flex flex-col border-r border-border bg-card/30 transition-all duration-300",
          isVisualizeOnly && "-ml-[33.333333%] lg:-ml-[25%]"
        )}>
            <div className="p-4 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2"><ListMusic /> Danh sách phát</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsUploadDialogOpen(true)} disabled={isSaving || !user} title={user ? "Tải nhạc lên" : "Đăng nhập để tải nhạc lên"}>
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload />}
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin"/>
                    </div>
                ) : (
                    playlist.map((track, index) => {
                        const isActive = (isShuffled ? shuffledIndices[currentTrackIndex] === index : currentTrackIndex === index);
                        return (
                           <div key={track.id} className={cn("relative group/item", isActive ? "bg-primary/20" : "")}>
                             <button
                                
                                className={cn(
                                    "w-full text-left p-3 flex items-center gap-3 hover:bg-accent transition-colors"
                                )}
                                onClick={() => handleSelectTrack(index)}
                            >
                                <Image src={track.albumArtUrl} alt={track.title} width={40} height={40} className="rounded-md object-cover" data-ai-hint={track.dataAiHint as string | undefined} />
                                <div className="flex-1 truncate">
                                    <p className="font-semibold text-sm truncate">{track.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                </div>
                                {isActive && isPlaying && <Music2 className="w-5 h-5 text-primary animate-pulse" />}
                            </button>
                            {track.ownerId === user?.id && (
                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 flex gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7"
                                        onClick={() => setEditingTrack(track)}
                                    >
                                        <Pencil className="w-4 h-4"/>
                                    </Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                             <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Hành động này sẽ xóa vĩnh viễn bài hát "{track.title}" và các tệp liên quan. Hành động này không thể được hoàn tác.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction
                                                className="bg-destructive hover:bg-destructive/90"
                                                onClick={() => handleDeleteTrack(track)}>
                                                    Xóa
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                 </div>
                            )}
                           </div>
                        )
                    })
                )}
            </div>
        </aside>

        {/* Main Player View */}
        <main className={cn("flex-1 flex flex-col items-center justify-center p-8 gap-8 relative transition-all duration-300", isVisualizeOnly && "w-full")}>
           <div className="absolute inset-0 z-0">
                <canvas ref={visualizerRef} className="w-full h-full opacity-50"></canvas>
            </div>

           <div className="relative z-10 flex flex-col items-center text-center">
            {currentTrack ? (
                    <>
                    <div className="relative mb-8 group/art">
                       <Image
                        src={currentTrack.albumArtUrl}
                        alt={currentTrack.title}
                        width={300}
                        height={300}
                        className="rounded-lg shadow-2xl shadow-primary/20 object-cover aspect-square transition-transform duration-75"
                        style={{ transform: `scale(${albumArtScale})` }}
                        data-ai-hint={currentTrack.dataAiHint as string | undefined}
                       />
                    </div>
                    <div className={cn("transition-opacity duration-300", isVisualizeOnly && "opacity-0")}>
                        <h1 className="text-3xl font-bold">{currentTrack.title}</h1>
                        <p className="text-lg text-muted-foreground mt-1">{currentTrack.artist}</p>
                    </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[380px] text-muted-foreground">
                        <Music2 className="w-24 h-24 mb-4" />
                        <p>{isLoading ? 'Đang tải nhạc...' : 'Chọn một bài hát để bắt đầu'}</p>
                    </div>
                )}
           </div>

           <div className={cn("w-full max-w-md z-10 transition-opacity duration-300", isVisualizeOnly && "opacity-0")}>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    onValueChange={handleProgressChange}
                    className="my-2"
                    disabled={!currentTrack || isLoading}
                />

                <div className="flex justify-center items-center gap-4 mt-4">
                     <Button variant="ghost" size="icon" onClick={handleShuffleToggle} className={cn(isShuffled && "text-primary")} disabled={!currentTrack || isLoading}>
                        <Shuffle />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handlePrev} disabled={!currentTrack || isLoading}>
                        <SkipBack />
                    </Button>
                    <Button size="lg" className="w-16 h-16 rounded-full" onClick={handlePlayPause} disabled={!currentTrack || isLoading}>
                        {isPlaying ? <Pause className="w-8 h-8"/> : <Play className="w-8 h-8"/>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleNext} disabled={!currentTrack || isLoading}>
                        <SkipForward />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={cycleRepeatMode} className={cn(repeatMode !== 'off' && "text-primary")} disabled={!currentTrack || isLoading}>
                        {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
                    </Button>
                </div>

                <div className="flex items-center gap-2 mt-6">
                    <Button variant="ghost" size="icon" onClick={() => handleVolumeChange([volume > 0 ? 0 : 0.75])} disabled={!currentTrack || isLoading}>
                        {volume === 0 ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <Slider
                        value={[volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                        disabled={!currentTrack || isLoading}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setIsVisualizeOnly(v => !v)} disabled={!currentTrack || isLoading}>
                        <Expand />
                    </Button>
                </div>
           </div>
        </main>
    </div>
    
    <UploadDialog 
      open={isUploadDialogOpen}
      onOpenChange={setIsUploadDialogOpen}
      onSuccess={() => setIsUploadDialogOpen(false)}
    />
    
    {editingTrack && (
        <EditDialog
          key={editingTrack.id}
          track={editingTrack}
          open={!!editingTrack}
          onOpenChange={(isOpen) => !isOpen && setEditingTrack(null)}
          onSuccess={() => setEditingTrack(null)}
        />
    )}
    </>
  );
}

// Upload Dialog Component
function UploadDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setTitle('');
        setArtist('');
        setAudioFile(null);
        setImageFile(null);
        setImagePreview(null);
        if (audioInputRef.current) audioInputRef.current.value = "";
        if (imageInputRef.current) imageInputRef.current.value = "";
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAudioFile(file);
            if (!title) {
                setTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
        }
    };

    const handleUpload = async () => {
        if (!user || !audioFile) {
            toast({ title: "Lỗi", description: "Vui lòng chọn một tệp âm thanh.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        try {
            const timestamp = Date.now();
            const audioPath = `music/${user.id}/${timestamp}_${audioFile.name}`;
            const audioStorageRef = ref(storage, audioPath);
            await uploadBytes(audioStorageRef, audioFile);
            const audioUrl = await getDownloadURL(audioStorageRef);
            
            let imageUrl = "/images/default_music_icon.png";
            let imagePath: string | undefined = undefined;

            if (imageFile) {
                imagePath = `music_art/${user.id}/${timestamp}_${imageFile.name}`;
                const imageStorageRef = ref(storage, imagePath);
                await uploadBytes(imageStorageRef, imageFile);
                imageUrl = await getDownloadURL(imageStorageRef);
            }

            await addDoc(collection(db, 'music'), {
                title: title.trim() || "Bài hát không tên",
                artist: artist.trim() || "Nghệ sĩ không xác định",
                albumArtUrl: imageUrl,
                audioUrl: audioUrl,
                ownerId: user.id,
                storagePath: {
                    audio: audioPath,
                    image: imagePath
                },
                createdAt: serverTimestamp()
            });

            toast({ title: 'Thành công', description: 'Bài hát đã được tải lên.' });
            onSuccess();
            resetForm();

        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: 'Lỗi', description: 'Không thể tải tệp lên. Vui lòng thử lại.', variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) resetForm(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tải lên bài hát mới</DialogTitle>
                    <DialogDescription>
                        Cung cấp thông tin và tệp cho bài hát của bạn.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Tên bài hát</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="artist">Nghệ sĩ</Label>
                        <Input id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        <Label>Ảnh bìa (tùy chọn)</Label>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 rounded-md">
                               <AvatarImage src={imagePreview ?? "/images/default_music_icon.png"} className="object-cover" />
                               <AvatarFallback><Music2/></AvatarFallback>
                            </Avatar>
                            <Button variant="outline" className="flex-1" onClick={() => imageInputRef.current?.click()}>
                                <ImagePlus className="mr-2 h-4 w-4"/>
                                {imageFile ? 'Thay đổi ảnh' : 'Chọn ảnh'}
                            </Button>
                        </div>
                        <input type="file" ref={imageInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                    </div>

                    <div className="space-y-2">
                        <Label>Tệp âm thanh</Label>
                        <div className="overflow-hidden">
                           <Button variant="outline" className="w-full justify-start text-left font-normal" onClick={() => audioInputRef.current?.click()}>
                              <Music2 className="mr-2 h-4 w-4"/>
                              <span className="truncate">
                                  {audioFile ? audioFile.name : 'Chọn tệp âm thanh...'}
                              </span>
                          </Button>
                        </div>
                        <input type="file" ref={audioInputRef} onChange={handleAudioChange} className="hidden" accept="audio/*" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Hủy</Button></DialogClose>
                    <Button onClick={handleUpload} disabled={isUploading || !audioFile}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Tải lên
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


// Edit Dialog Component
function EditDialog({ track, open, onOpenChange, onSuccess }: { track: Track, open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [details, setDetails] = useState({ title: track.title, artist: track.artist });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(track.albumArtUrl);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSaveChanges = async () => {
        if (!user || !details.title.trim()) {
            toast({ title: "Lỗi", description: "Tên bài hát không được để trống.", variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const trackRef = doc(db, 'music', track.id);
            const dataToUpdate: any = {
                title: details.title,
                artist: details.artist || "Nghệ sĩ không xác định",
            };

            if (imageFile) {
                // Delete old image if it exists and is not the default one
                if (track.storagePath?.image) {
                    const oldImageRef = ref(storage, track.storagePath.image);
                    await deleteObject(oldImageRef).catch(err => console.warn("Old image not found or could not be deleted:", err));
                }

                // Upload new image
                const timestamp = Date.now();
                const imagePath = `music_art/${user.id}/${timestamp}_${imageFile.name}`;
                const newImageRef = ref(storage, imagePath);
                await uploadBytes(newImageRef, imageFile);
                dataToUpdate.albumArtUrl = await getDownloadURL(newImageRef);
                dataToUpdate['storagePath.image'] = imagePath;
            }

            await updateDoc(trackRef, dataToUpdate);
            toast({ title: 'Thành công', description: 'Thông tin bài hát đã được cập nhật.' });
            onSuccess();
        } catch (error) {
            console.error("Error updating track:", error);
            toast({ title: "Lỗi", description: "Không thể cập nhật thông tin bài hát.", variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa thông tin bài hát</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-24 w-24 rounded-md">
                           <AvatarImage src={imagePreview ?? "/images/default_music_icon.png"} className="object-cover" />
                           <AvatarFallback><Music2/></AvatarFallback>
                        </Avatar>
                         <Button variant="outline" className="w-full" onClick={() => imageInputRef.current?.click()}><ImagePlus className="mr-2"/>Thay đổi ảnh bìa</Button>
                         <input type="file" ref={imageInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">Tên bài hát</Label>
                        <Input
                            id="title"
                            value={details.title}
                            onChange={(e) => setDetails({ ...details, title: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="artist" className="text-right">Nghệ sĩ</Label>
                        <Input
                            id="artist"
                            value={details.artist}
                            onChange={(e) => setDetails({ ...details, artist: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Hủy</Button>
                    </DialogClose>
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Lưu thay đổi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    