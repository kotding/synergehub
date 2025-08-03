
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Upload, Repeat, Repeat1, Shuffle, ListMusic, Music2
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Track {
  id: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  audioUrl: string;
  ownerId?: string;
}

const defaultPlaylist: Omit<Track, 'id'>[] = [
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visualizerRef = useRef<HTMLCanvasElement>(null);

  const [playlist, setPlaylist] = useState<Track[]>(defaultPlaylist.map((t, i) => ({...t, id: `default-${i}`})));
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  // Fetch user's music from Firestore
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'music'), where('ownerId', '==', user.id), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userMusic = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Track));
      setPlaylist(prev => [...userMusic, ...defaultPlaylist.map((t, i) => ({...t, id: `default-${i}`}))]);
    }, (error) => {
        console.error("Error fetching user music:", error);
        toast({ title: "Lỗi", description: "Không thể tải nhạc của bạn.", variant: 'destructive' });
    });

    return () => unsubscribe();
  }, [user, toast]);
  
  const currentTrack = useMemo(() => {
      if (isShuffled) {
        return playlist[shuffledIndices[currentTrackIndex]];
      }
      return playlist[currentTrackIndex];
  }, [currentTrackIndex, playlist, isShuffled, shuffledIndices]);
  
  // Audio Visualizer effect
  useEffect(() => {
    if (!isPlaying || !audioRef.current || !visualizerRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyser.fftSize = 128;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = visualizerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const renderFrame = () => {
      animationFrameId = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        const r = barHeight + 25 * (i / bufferLength);
        const g = 250 * (i / bufferLength);
        const b = 50;
        ctx.fillStyle = `rgba(${r},${g},${b}, 0.6)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    renderFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
      source.disconnect();
      analyser.disconnect();
      // Do not close the audio context to allow re-use
    };
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Playback error:", e));
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
            // When turning shuffle off, find the original index of the current song
            const originalIndex = playlist.findIndex(track => track.id === currentTrack.id);
            setCurrentTrackIndex(originalIndex >= 0 ? originalIndex : 0);
        }
        return nextState;
    });
  };

  const onEnded = useCallback(() => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (repeatMode === 'all') {
      handleNext();
    } else { // 'off'
      if (currentTrackIndex < playlist.length - 1) {
        handleNext();
      } else {
        setIsPlaying(false);
      }
    }
  }, [repeatMode, handleNext, currentTrackIndex, playlist.length]);
  
  useEffect(() => {
      if (isShuffled) {
        generateShuffledIndices();
      }
  }, [playlist.length, isShuffled, generateShuffledIndices]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const setAudioData = () => {
        setDuration(audio.duration);
        setCurrentTime(audio.currentTime);
    }
    const setAudioTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    
    // Autoplay when track changes
    if (isPlaying) {
      audio.play().catch(e => console.error("Autoplay failed:", e));
    }

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
    }
  }, [currentTrack, onEnded, isPlaying]);

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('audio/')) {
        toast({ title: 'Lỗi', description: 'Chỉ chấp nhận tệp âm thanh.', variant: 'destructive' });
        return;
    }
    
    setIsUploading(true);
    try {
        const storageRef = ref(storage, `music/${user.id}/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(storageRef, file);
        const audioUrl = await getDownloadURL(uploadResult.ref);

        await addDoc(collection(db, 'music'), {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Nghệ sĩ không xác định",
            albumArtUrl: "/images/default_music_icon.png",
            audioUrl: audioUrl,
            ownerId: user.id,
            createdAt: serverTimestamp()
        });
        
        toast({ title: 'Thành công', description: 'Bài hát đã được tải lên.' });

    } catch (error) {
        console.error("Upload error:", error);
        toast({ title: 'Lỗi', description: 'Không thể tải tệp lên.', variant: 'destructive' });
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  }

  const cycleRepeatMode = () => {
      const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setRepeatMode(modes[nextIndex]);
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Playlist Sidebar */}
        <aside className="w-1/3 lg:w-1/4 h-full flex flex-col border-r border-border bg-card/30">
            <div className="p-4 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2"><ListMusic /> Danh sách phát</h2>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Tải nhạc lên">
                    {isUploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div> : <Upload />}
                </Button>
                <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} accept="audio/*" />
            </div>
            <div className="flex-1 overflow-y-auto">
                {playlist.map((track, index) => {
                    const originalIndex = isShuffled ? shuffledIndices.findIndex(i => i === index) : index;
                    return (
                        <button
                            key={track.id}
                            className={cn(
                                "w-full text-left p-3 flex items-center gap-3 hover:bg-accent transition-colors",
                                (isShuffled ? shuffledIndices[currentTrackIndex] : currentTrackIndex) === index ? "bg-primary/20" : ""
                            )}
                            onClick={() => setCurrentTrackIndex(isShuffled ? originalIndex : index)}
                        >
                            <Image src={track.albumArtUrl} alt={track.title} width={40} height={40} className="rounded-md" data-ai-hint={track.dataAiHint as string | undefined} />
                            <div className="flex-1 truncate">
                                <p className="font-semibold text-sm truncate">{track.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                            </div>
                            {(isShuffled ? shuffledIndices[currentTrackIndex] : currentTrackIndex) === index && isPlaying && <Music2 className="w-5 h-5 text-primary animate-pulse" />}
                        </button>
                    )
                })}
            </div>
        </aside>

        {/* Main Player View */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 gap-8 relative">
           <div className="absolute inset-0 z-0">
                <canvas ref={visualizerRef} className="w-full h-full opacity-50"></canvas>
            </div>

           <div className="relative z-10 flex flex-col items-center text-center">
            {currentTrack ? (
                    <>
                    <div className="relative mb-8">
                       <Image
                        src={currentTrack.albumArtUrl}
                        alt={currentTrack.title}
                        width={300}
                        height={300}
                        className="rounded-lg shadow-2xl shadow-primary/20"
                        data-ai-hint={currentTrack.dataAiHint as string | undefined}
                       />
                    </div>
                    <h1 className="text-3xl font-bold">{currentTrack.title}</h1>
                    <p className="text-lg text-muted-foreground mt-1">{currentTrack.artist}</p>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[380px] text-muted-foreground">
                        <Music2 className="w-24 h-24 mb-4" />
                        <p>Chọn một bài hát để bắt đầu</p>
                    </div>
                )}
           </div>

           <div className="w-full max-w-md z-10">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    onValueChange={handleProgressChange}
                    className="my-2"
                />

                <div className="flex justify-center items-center gap-4 mt-4">
                     <Button variant="ghost" size="icon" onClick={handleShuffleToggle} className={cn(isShuffled && "text-primary")}>
                        <Shuffle />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handlePrev}>
                        <SkipBack />
                    </Button>
                    <Button size="lg" className="w-16 h-16 rounded-full" onClick={handlePlayPause}>
                        {isPlaying ? <Pause className="w-8 h-8"/> : <Play className="w-8 h-8"/>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleNext}>
                        <SkipForward />
                    </Button>
                     <Button variant="ghost" size="icon" onClick={cycleRepeatMode} className={cn(repeatMode !== 'off' && "text-primary")}>
                        {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
                    </Button>
                </div>

                <div className="flex items-center gap-2 mt-6">
                    <Button variant="ghost" size="icon" onClick={() => handleVolumeChange([volume > 0 ? 0 : 0.75])}>
                        {volume === 0 ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <Slider
                        value={[volume]}
                        max={1}
                        step={0.01}
                        onValueChange={handleVolumeChange}
                    />
                </div>
           </div>
           
           <audio
                ref={audioRef}
                src={currentTrack?.audioUrl}
                crossOrigin="anonymous"
                onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
            />
        </main>
    </div>
  );
}
