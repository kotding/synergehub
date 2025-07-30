
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Gamepad2, Play, RefreshCw, Ghost } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// SVG asset for a more fun bird character
const birdSvg = `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M25 50C38.8071 50 50 38.8071 50 25C50 11.1929 38.8071 0 25 0C11.1929 0 0 11.1929 0 25C0 38.8071 11.1929 50 25 50Z" fill="#FFC107"/><path d="M37.5 18.75C37.5 16.8206 35.9794 15.3125 34.0625 15.3125C32.1456 15.3125 30.625 16.8206 30.625 18.75C30.625 20.6794 32.1456 22.1875 34.0625 22.1875C35.9794 22.1875 37.5 20.6794 37.5 18.75Z" fill="white"/><path d="M34.0625 20C34.8938 20 35.625 19.4625 35.625 18.75C35.625 18.0375 34.8938 17.5 34.0625 17.5C33.2312 17.5 32.5 18.0375 32.5 18.75C32.5 19.4625 33.2312 20 34.0625 20Z" fill="black"/><path d="M19.375 18.75C19.375 16.8206 17.8544 15.3125 15.9375 15.3125C14.0206 15.3125 12.5 16.8206 12.5 18.75C12.5 20.6794 14.0206 22.1875 15.9375 22.1875C17.8544 22.1875 19.375 20.6794 19.375 18.75Z" fill="white"/><path d="M15.9375 20C16.7688 20 17.5 19.4625 17.5 18.75C17.5 18.0375 16.7688 17.5 15.9375 17.5C15.1062 17.5 14.375 18.0375 14.375 18.75C14.375 19.4625 15.1062 20 15.9375 20Z" fill="black"/><path d="M25 35.625C29.6875 35.625 33.75 33.125 35.625 29.375H14.375C16.25 33.125 20.3125 35.625 25 35.625Z" fill="#E65100"/></svg>`;
const pipeSvg = (height: number, canvasHeight: number, pipeGap: number) => `
  <svg width="52" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pipeGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#73BF29" />
        <stop offset="100%" stop-color="#558000" />
      </linearGradient>
    </defs>
    <rect x="2" y="0" width="48" height="${height - 25}" fill="url(#pipeGradient)" /><rect x="2" y="0" width="48" height="${height - 25}" fill="black" fill-opacity="0.1" />
    <rect x="0" y="${height - 25}" width="52" height="25" fill="url(#pipeGradient)" rx="3" ry="3" /><rect x="0" y="${height - 25}" width="52" height="25" fill="black" fill-opacity="0.2" rx="3" ry="3" /><rect x="4" y="${height - 23}" width="44" height="18" fill="url(#pipeGradient)" stroke="#456800" stroke-width="2" rx="2" ry="2"/>
    <rect x="2" y="${height + pipeGap + 25}" width="48" height="${canvasHeight - height - pipeGap - 25}" fill="url(#pipeGradient)" /><rect x="2" y="${height + pipeGap + 25}" width="48" height="${canvasHeight - height - pipeGap - 25}" fill="black" fill-opacity="0.1" />
    <rect x="0" y="${height + pipeGap}" width="52" height="25" fill="url(#pipeGradient)" rx="3" ry="3" /><rect x="0" y="${height + pipeGap}" width="52" height="25" fill="black" fill-opacity="0.2" rx="3" ry="3" /><rect x="4" y="${height + pipeGap + 4}" width="44" height="18" fill="url(#pipeGradient)" stroke="#456800" stroke-width="2" rx="2" ry="2"/>
  </svg>
`;

interface DeathData {
    id: string;
    nickname: string;
    position: { x: number, y: number };
    avatar: string;
}

export default function FlappyBirdPage() {
    const { profile } = useAuth();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(true);
    const [gameStarted, setGameStarted] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [deathMarkers, setDeathMarkers] = useState<DeathData[]>([]);

    const gameAssets = useRef<{ 
        birdImage: HTMLImageElement | null;
        avatarImage: HTMLImageElement | null;
        ghostImages: Record<string, HTMLImageElement>;
        pipeImages: Record<string, HTMLImageElement>;
        sounds: Record<string, HTMLAudioElement | null>;
    }>({
        birdImage: null,
        avatarImage: null,
        ghostImages: {},
        pipeImages: {},
        sounds: { wing: null, hit: null, die: null }
    });

    const gameVars = useRef({
        bird: { x: 50, y: 150, width: 40, height: 40, velocity: 0 },
        gravity: 0.25,
        lift: -5,
        pipes: [] as { x: number, y: number, passed: boolean }[],
        pipeWidth: 52,
        pipeGap: 150,
        pipeSpeed: 2,
        pipeInterval: 120, // frames
        frameCount: 0,
    });

    const loadDeathMarkers = useCallback(async () => {
        if (!profile) return;
        try {
            const deathsRef = collection(db, 'flappyBirdDeaths');
            // Query for top 20 scorers
            const topScoresQuery = query(deathsRef, orderBy('score', 'desc'), limit(20));
            const topScoresSnapshot = await getDocs(topScoresQuery);
            const topMarkers = topScoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeathData));

            // Query for current user's last death, if not in top 20
            let userMarker: DeathData | undefined;
            const userInTop = topMarkers.some(marker => marker.id === profile.id);
            if (!userInTop) {
                 const userDeathQuery = query(deathsRef, where('userId', '==', profile.id), orderBy('timestamp', 'desc'), limit(1));
                 const userDeathSnapshot = await getDocs(userDeathQuery);
                 if (!userDeathSnapshot.empty) {
                     userMarker = { id: userDeathSnapshot.docs[0].id, ...userDeathSnapshot.docs[0].data() } as DeathData;
                 }
            }

            const combined = [...topMarkers];
            if (userMarker) {
                // Avoid duplicates if user is in top 20 but query found another record
                if (!combined.some(m => m.id === userMarker!.id)) {
                    combined.push(userMarker);
                }
            }
            
            setDeathMarkers(combined);
        } catch (error) {
            console.error("Error loading death markers:", error);
        }
    }, [profile]);
    
    // Load assets
    useEffect(() => {
        const birdImg = new Image();
        birdImg.src = "data:image/svg+xml;base64," + btoa(birdSvg);
        birdImg.onload = () => { gameAssets.current.birdImage = birdImg; };

        const soundFiles = ['wing', 'hit', 'die'];
        soundFiles.forEach(sound => {
            const audio = new Audio(`/sounds/${sound}.mp3`);
            audio.load();
            gameAssets.current.sounds[sound] = audio;
        });

    }, []);

    // Load user avatar
    useEffect(() => {
        if (profile?.avatar) {
            const avatarImg = new Image();
            avatarImg.crossOrigin = "anonymous";
            avatarImg.src = profile.avatar;
            avatarImg.onload = () => { gameAssets.current.avatarImage = avatarImg; };
        }
    }, [profile?.avatar]);

    const playSound = (soundName: 'wing' | 'hit' | 'die') => {
        const sound = gameAssets.current.sounds[soundName];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(e => console.error(`Error playing sound: ${soundName}`, e));
        }
    }

    const getPipeImage = (pipeY: number, canvasHeight: number) => {
        const key = `${pipeY}`;
        if (!gameAssets.current.pipeImages[key]) {
            const img = new Image();
            const svg = pipeSvg(pipeY, canvasHeight, gameVars.current.pipeGap);
            img.src = "data:image/svg+xml;base64," + btoa(svg);
            gameAssets.current.pipeImages[key] = img;
        }
        return gameAssets.current.pipeImages[key];
    }
    
    // Load ghost images
    useEffect(() => {
        deathMarkers.forEach(marker => {
            if (!gameAssets.current.ghostImages[marker.id] && marker.avatar) {
                const ghostAvatarImg = new Image();
                ghostAvatarImg.crossOrigin = "anonymous";
                ghostAvatarImg.src = marker.avatar;
                ghostAvatarImg.onload = () => {
                    gameAssets.current.ghostImages[marker.id] = ghostAvatarImg;
                };
            }
        });
    }, [deathMarkers]);


    useEffect(() => {
      const storedHighScore = localStorage.getItem('flappyBirdHighScore');
      if (storedHighScore) {
        setHighScore(parseInt(storedHighScore, 10));
      }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const drawBackground = () => {
             ctx.fillStyle = '#70c5ce';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        drawBackground();

        if (isGameOver || countdown !== null) {
            if (countdown !== null) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 72px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 4;
                ctx.strokeText(`${countdown}`, canvas.width / 2, canvas.height / 2);
                ctx.fillText(`${countdown}`, canvas.width / 2, canvas.height / 2);
            }
            return;
        };

        let animationFrameId: number;

        const drawBird = (context: CanvasRenderingContext2D, birdX: number, birdY: number, birdW: number, birdH: number, avatarImg: HTMLImageElement | null, mainBird: boolean = true) => {
            context.save();
            if(!mainBird) {
                context.globalAlpha = 0.4;
            }
            if (gameAssets.current.birdImage) {
                context.drawImage(gameAssets.current.birdImage, birdX, birdY, birdW, birdH);
            }
            if (avatarImg) {
                const avatarRadius = birdW / 3.5;
                const avatarX = birdX + birdW / 2;
                const avatarY = birdY + birdH / 2;
                context.beginPath();
                context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
                context.closePath();
                context.clip();
                context.drawImage(avatarImg, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            }
            context.restore();
        }

        const draw = () => {
            drawBackground();
            
            // Death Markers (ghosts)
            deathMarkers.forEach(marker => {
                if(marker.id !== profile?.id){ // Don't draw own ghost if playing
                    const ghostAvatar = gameAssets.current.ghostImages[marker.id];
                    drawBird(ctx, marker.position.x, marker.position.y, gameVars.current.bird.width, gameVars.current.bird.height, ghostAvatar, false);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${marker.nickname} đã chết ở đây`, marker.position.x + gameVars.current.bird.width / 2, marker.position.y - 5);
                }
            });

            // Pipes
            gameVars.current.pipes.forEach(pipe => {
                const pipeImage = getPipeImage(pipe.y, canvas.height);
                if (pipeImage && pipeImage.complete) {
                     ctx.drawImage(pipeImage, pipe.x, 0);
                }
            });

            // Bird
            drawBird(ctx, gameVars.current.bird.x, gameVars.current.bird.y, gameVars.current.bird.width, gameVars.current.bird.height, gameAssets.current.avatarImage);
        };

        const update = () => {
            // Bird physics
            gameVars.current.bird.velocity += gameVars.current.gravity;
            gameVars.current.bird.y += gameVars.current.bird.velocity;
            
            // Pipe management
            gameVars.current.frameCount++;
            if (gameVars.current.frameCount % gameVars.current.pipeInterval === 0) {
                 const pipeY = Math.floor(Math.random() * (canvas.height - gameVars.current.pipeGap - 150)) + 75;
                 gameVars.current.pipes.push({ x: canvas.width, y: pipeY, passed: false });
            }

            gameVars.current.pipes.forEach(pipe => {
                pipe.x -= gameVars.current.pipeSpeed;

                // Score
                if (!pipe.passed && pipe.x < gameVars.current.bird.x) {
                    pipe.passed = true;
                    setScore(prev => prev + 1);
                }
            });
            
            // Remove off-screen pipes
            gameVars.current.pipes = gameVars.current.pipes.filter(pipe => pipe.x + gameVars.current.pipeWidth > 0);

            // Collision detection
            const bird = gameVars.current.bird;
            // Ground and ceiling collision
            if (bird.y + bird.height > canvas.height || bird.y < 0) {
                playSound('hit');
                endGame();
                return;
            }
            // Pipe collision
            gameVars.current.pipes.forEach(pipe => {
                if (
                    bird.x < pipe.x + gameVars.current.pipeWidth &&
                    bird.x + bird.width > pipe.x &&
                    (bird.y < pipe.y || bird.y + bird.height > pipe.y + gameVars.current.pipeGap)
                ) {
                    playSound('hit');
                    endGame();
                    return;
                }
            });
        };

        const gameLoop = () => {
            update();
            draw();
            animationFrameId = requestAnimationFrame(gameLoop);
        };

        gameLoop();
        
        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isGameOver, countdown, deathMarkers, profile]);

    const jump = () => {
        if (!isGameOver && countdown === null) {
            playSound('wing');
            gameVars.current.bird.velocity = gameVars.current.lift;
        }
    };
    
    const triggerCountdown = () => {
        loadDeathMarkers();
        setGameStarted(true);
        setIsGameOver(true);
        setCountdown(3);
        
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    startGame();
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startGame = () => {
        setIsGameOver(false);
        setCountdown(null);
        setScore(0);
        gameVars.current.bird = { x: 50, y: 150, width: 40, height: 40, velocity: 0 };
        gameVars.current.pipes = [];
        gameVars.current.frameCount = 0;
        jump();
    };

    const saveDeathPosition = async () => {
        if (!profile) return;
        try {
            const deathsRef = collection(db, 'flappyBirdDeaths');
            await addDoc(deathsRef, {
                userId: profile.id,
                nickname: profile.nickname,
                avatar: profile.avatar,
                score: score,
                position: {
                    x: gameVars.current.bird.x,
                    y: gameVars.current.bird.y
                },
                timestamp: new Date()
            });
        } catch (error) {
            console.error("Error saving death position:", error);
        }
    };

    const endGame = () => {
        if (isGameOver) return;
        playSound('die');
        setIsGameOver(true);
        saveDeathPosition();
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('flappyBirdHighScore', score.toString());
        }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
            handleClick();
        }
    };

    const handleClick = () => {
        if (isGameOver) {
            if (gameStarted || countdown === null) {
                triggerCountdown();
            }
        } else {
            jump();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGameOver, gameStarted, countdown]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-4">
             <header className="absolute top-4 left-4 flex items-center gap-3">
                <Button asChild variant="outline" size="icon" className="h-10 w-10">
                    <Link href="/gaming">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                 <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <Gamepad2 className="h-7 w-7" />
                        Flappy Bird
                    </h1>
                    {profile && (
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={profile.avatar} />
                                <AvatarFallback>{profile.nickname.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">{profile.nickname}</span>
                        </div>
                    )}
                 </div>
            </header>

            <div className="relative w-full max-w-sm aspect-[9/16] bg-black shadow-2xl rounded-lg overflow-hidden border-4 border-primary/20">
                <canvas
                    ref={canvasRef}
                    width={320}
                    height={480}
                    onClick={handleClick}
                    className="w-full h-full block"
                />
                {(isGameOver && gameStarted && countdown === null) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center">
                        <h2 className="text-4xl font-extrabold mb-2">Game Over</h2>
                        <p className="text-xl mb-4">Điểm: {score}</p>
                        <Button onClick={triggerCountdown} size="lg">
                            <RefreshCw className="mr-2" />
                            Chơi lại
                        </Button>
                    </div>
                )}
                 {(!gameStarted && isGameOver) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center">
                        <Ghost className="w-16 h-16 mb-4 text-primary" />
                        <h2 className="text-4xl font-extrabold mb-2">Flappy Ghost</h2>
                        <p className="text-lg mb-4">Bay qua các đường ống và né "hồn ma" của người chơi khác!</p>
                        <Button onClick={triggerCountdown} size="lg">
                            <Play className="mr-2" />
                            Bắt đầu
                        </Button>
                    </div>
                )}
            </div>

            <div className="w-full max-w-sm mt-4 flex justify-between text-xl font-bold">
                 <span>Điểm: {score}</span>
                 <span>Điểm cao: {highScore}</span>
            </div>
             <p className="text-muted-foreground mt-2">Nhấn phím cách hoặc nhấp chuột để bay.</p>
        </div>
    );

    