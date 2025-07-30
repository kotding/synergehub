
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Gamepad2, Play, RefreshCw, Ghost } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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

const defaultBirdSvg = (rotation: number) => `
  <svg width="40" height="40" viewBox="-20 -20 40 40" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(${rotation})">
      <path d="M-13.5,2.5 C-13.5,5.5 -17,7 -17,7 C-17,7 -19,4.5 -19,2.5 C-19,-1.5 -15.5,-4.5 -11.5,-4.5 C-7.5,-4.5 -5.5,-1.5 -5.5,2.5 C-5.5,6 -9,7 -9,7 C-9,7 -13.5,5.5 -13.5,2.5 Z" fill="#EBCB4A" stroke="#C39B1F" stroke-width="2"/>
      <path d="M-11.5,2.5 C-11.5,5 -14.5,6 -14.5,6 C-14.5,6 -16,4 -16,2.5 C-16,-1 -13,-3.5 -11.5,-3.5 C-10,-3.5 -8, -1 -8,2.5 C-8,5.5 -10,6.5 -10,6.5 C-10,6.5 -11.5,5 -11.5,2.5" fill="#F4E043"/>
      <path d="M-12.5,-3.5 C-15,-4 -15,-6 -13.5,-7 C-12,-8 -10,-7.5 -9.5,-6 C-9,-4.5 -10,-3 -12.5,-3.5 Z" fill="white" stroke="black" stroke-width="0.5"/>
      <circle cx="-11" cy="-5.5" r="1" fill="black"/>
      <path d="M-6,2 C-6,2 2,-2 8,1 C14,4 8,8 3,7 C-2,6 -6,2 -6,2 Z" fill="#F4E043" stroke="#C39B1F" stroke-width="2"/>
      <path d="M-9,2.5 C-9,4.5 -5,5.5 -1,4.5 C3,3.5 5,1 5,1" fill="none" stroke="#D9A824" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M-4, -10 C-2, -12 2, -12 4, -10 L -4 -10 Z" fill="#D84B20" stroke="#B83118" stroke-width="2"/>
      <path d="M-4,-10 C-2,-9 2,-9 4,-10" fill="none" stroke="#E59783" stroke-width="1"/>
      <path d="M-1, -10 L 0,-16 L 1,-10" fill="none" stroke="#B83118" stroke-width="1"/>
    </g>
  </svg>
`;


interface DeathData {
    id: string;
    userId: string;
    nickname: string;
    position: { x: number, y: number };
    avatar: string;
    timestamp: any;
    score: number;
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
        avatarImage: HTMLImageElement | null;
        defaultBirdImage: HTMLImageElement | null;
        ghostImages: Record<string, HTMLImageElement>;
        pipeImages: Record<string, HTMLImageElement>;
    }>({
        avatarImage: null,
        defaultBirdImage: null,
        ghostImages: {},
        pipeImages: {},
    });

    const gameVars = useRef({
        bird: { x: 60, y: 150, width: 40, height: 40, velocity: 0, rotation: 0 },
        gravity: 0.18,
        lift: -4,
        pipes: [] as { x: number, y: number, passed: boolean }[],
        pipeWidth: 52,
        pipeGap: 150,
        pipeSpeed: 2,
        pipeInterval: 120, // frames
        frameCount: 0,
        worldOffset: 0,
    });

    const loadDeathMarkers = useCallback(async () => {
        try {
            const deathsRef = collection(db, 'flappyBirdDeaths');
            const topScoresQuery = query(deathsRef, orderBy('score', 'desc'), limit(20));
            const topScoresSnapshot = await getDocs(topScoresQuery);
            const topMarkers = topScoresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeathData));
    
            let userMarkers: DeathData[] = [];
            if(profile?.id) {
                const userDeathQuery = query(deathsRef, where('userId', '==', profile.id));
                const userDeathSnapshot = await getDocs(userDeathQuery);
                 if (!userDeathSnapshot.empty) {
                    userMarkers = userDeathSnapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as DeathData))
                        .sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                }
            }
            
            const combined = [...topMarkers, ...(userMarkers.length > 0 ? [userMarkers[0]] : [])];
            const uniqueMarkers = Array.from(new Map(combined.map(item => [item.id, item])).values());
            
            setDeathMarkers(uniqueMarkers);
        } catch (error) {
            console.error("Error loading death markers:", error);
        }
    }, [profile]);
    
    // Load user avatar and default bird
    useEffect(() => {
        if (profile?.avatar) {
            const avatarImg = new Image();
            avatarImg.crossOrigin = "anonymous"; // Important for loading external images onto canvas
            avatarImg.src = profile.avatar;
            avatarImg.onload = () => { gameAssets.current.avatarImage = avatarImg; };
        }
        
        const birdImg = new Image();
        birdImg.src = "data:image/svg+xml;base64," + btoa(defaultBirdSvg(0));
        birdImg.onload = () => { gameAssets.current.defaultBirdImage = birdImg; };
        
    }, [profile?.avatar]);

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
                ghostAvatarImg.crossOrigin = "anonymous"; // Important for loading external images
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
        
        const drawPlayer = (context: CanvasRenderingContext2D, birdX: number, birdY: number, birdW: number, birdH: number, rotation: number, avatarImg: HTMLImageElement | null, defaultBirdImg: HTMLImageElement | null, isGhost: boolean = false) => {
            context.save();
            context.translate(birdX + birdW / 2, birdY + birdH / 2);
            context.rotate(rotation * Math.PI / 180);
            context.translate(-(birdX + birdW / 2), -(birdY + birdH / 2));
            
            if(isGhost) {
                context.globalAlpha = 0.4;
            }
            
            const imageToDraw = avatarImg && avatarImg.complete ? avatarImg : defaultBirdImg;

            if (imageToDraw && imageToDraw.complete) {
                context.beginPath();
                context.arc(birdX + birdW / 2, birdY + birdH / 2, birdW / 2, 0, Math.PI * 2, true);
                context.closePath();
                context.clip();
                context.drawImage(imageToDraw, birdX, birdY, birdW, birdH);
                context.restore(); // Restore to reset clip
                context.save(); // Save again for rotation and border
                context.translate(birdX + birdW / 2, birdY + birdH / 2);
                context.rotate(rotation * Math.PI / 180);
                context.translate(-(birdX + birdW / 2), -(birdY + birdH / 2));
                context.beginPath();
                context.arc(birdX + birdW / 2, birdY + birdH / 2, birdW / 2, 0, Math.PI * 2, true);
                context.strokeStyle = isGhost ? 'rgba(255, 255, 255, 0.4)' : 'white';
                context.lineWidth = 2;
                context.stroke();
            }
             context.restore();
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBackground();

            // Pipes
            gameVars.current.pipes.forEach(pipe => {
                const pipeImage = getPipeImage(pipe.y, canvas.height);
                if (pipeImage && pipeImage.complete) {
                     ctx.drawImage(pipeImage, pipe.x - gameVars.current.worldOffset, 0);
                }
            });
            
            // Death Markers (ghosts)
            deathMarkers.forEach(marker => {
                if(marker.userId !== profile?.id){
                    const ghostAvatar = gameAssets.current.ghostImages[marker.id];
                    const markerX = marker.position.x - gameVars.current.worldOffset;
                    if (markerX > -50 && markerX < canvas.width + 50) {
                        drawPlayer(ctx, markerX, marker.position.y, gameVars.current.bird.width, gameVars.current.bird.height, 0, ghostAvatar, gameAssets.current.defaultBirdImage, true);
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.font = 'bold 10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${marker.nickname} đã chết ở đây`, markerX + gameVars.current.bird.width / 2, marker.position.y - 5);
                    }
                }
            });

            // Bird
            drawPlayer(ctx, gameVars.current.bird.x, gameVars.current.bird.y, gameVars.current.bird.width, gameVars.current.bird.height, gameVars.current.bird.rotation, gameAssets.current.avatarImage, gameAssets.current.defaultBirdImage, false);
        };

        const update = () => {
            // Bird physics
            gameVars.current.bird.velocity += gameVars.current.gravity;
            gameVars.current.bird.y += gameVars.current.bird.velocity;
            gameVars.current.bird.rotation = Math.min(Math.max(-20, gameVars.current.bird.velocity * 9), 90);
            
            // World movement
            gameVars.current.worldOffset += gameVars.current.pipeSpeed;

            // Pipe management
            gameVars.current.frameCount++;
            if (gameVars.current.frameCount % gameVars.current.pipeInterval === 0) {
                 const pipeY = Math.floor(Math.random() * (canvas.height - gameVars.current.pipeGap - 150)) + 75;
                 gameVars.current.pipes.push({ x: canvas.width + gameVars.current.worldOffset, y: pipeY, passed: false });
            }

            gameVars.current.pipes.forEach(pipe => {
                // Score
                if (!pipe.passed && (pipe.x - gameVars.current.worldOffset) < gameVars.current.bird.x) {
                    pipe.passed = true;
                    setScore(prev => prev + 1);
                }
            });
            
            // Remove off-screen pipes
            gameVars.current.pipes = gameVars.current.pipes.filter(pipe => (pipe.x - gameVars.current.worldOffset) + gameVars.current.pipeWidth > 0);

            // Collision detection
            const bird = gameVars.current.bird;
            // Ground and ceiling collision
            if (bird.y + bird.height > canvas.height || bird.y < 0) {
                endGame();
                return;
            }
            // Pipe collision
            gameVars.current.pipes.forEach(pipe => {
                const pipeX = pipe.x - gameVars.current.worldOffset;
                if (
                    bird.x < pipeX + gameVars.current.pipeWidth &&
                    bird.x + bird.width > pipeX &&
                    (bird.y < pipe.y || bird.y + bird.height > pipe.y + gameVars.current.pipeGap)
                ) {
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
    }, [isGameOver, countdown, deathMarkers, profile, loadDeathMarkers]);

    const jump = () => {
        if (!isGameOver && countdown === null) {
            gameVars.current.bird.velocity = gameVars.current.lift;
        }
    };
    
    const triggerCountdown = () => {
        if (countdown !== null) return; // Prevent restarting countdown
        
        loadDeathMarkers();
        setGameStarted(true);
        setIsGameOver(true); // Set to true to show countdown screen
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
        gameVars.current.bird = { x: 60, y: 150, width: 40, height: 40, velocity: 0, rotation: 0 };
        gameVars.current.pipes = [];
        gameVars.current.frameCount = 0;
        gameVars.current.worldOffset = 0;
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
                    x: gameVars.current.bird.x + gameVars.current.worldOffset,
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
        setIsGameOver(true);
        if(profile) {
            saveDeathPosition();
        }
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
             if (countdown === null) { // Only trigger if no countdown is active
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
    }, [isGameOver, countdown]); // Re-bind listener when game state changes

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
                        Flappy Ghost
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
}

