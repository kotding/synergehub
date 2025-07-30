
"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Gamepad2, Play, RefreshCw } from 'lucide-react';

// SVG assets for better graphics
const birdSvg = `<svg viewBox="0 0 34 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M32.4167 12.4167C32.4167 11.0313 31.4323 9.88021 30.099 9.68229L28.5833 7.5H22.9167L23.3333 3.33333L20.6667 0.666667L16.25 5.83333L13.1667 4.16667L10.5 5L11.75 8.33333H6.66667L5 6.66667L0.833333 9.58333H6.25L5.83333 11.25H2.5L2.08333 12.9167H5.83333L5 15H2.08333L2.5 16.6667H5.41667L5 18.3333H1.66667L2.91667 21.25L6.66667 20L7.5 17.0833H12.5L12.0833 22.5L16.25 23.75L18.3333 19.5833H29.1667L30.4167 16.25H22.5L24.1667 12.9167H30.0833C31.401 12.9167 32.4167 11.8385 32.4167 12.4167Z" fill="#F2D45C"/><path d="M16.25 8.33333C17.6354 8.33333 18.75 7.21875 18.75 5.83333C18.75 4.44792 17.6354 3.33333 16.25 3.33333C14.8646 3.33333 13.75 4.44792 13.75 5.83333C13.75 7.21875 14.8646 8.33333 16.25 8.33333Z" fill="white"/><path d="M16.25 7.08333C16.9427 7.08333 17.5 6.52604 17.5 5.83333C17.5 5.14062 16.9427 4.58333 16.25 4.58333C15.5573 4.58333 15 5.14062 15 5.83333C15 6.52604 15.5573 7.08333 16.25 7.08333Z" fill="black"/><path d="M30.4167 16.25L29.1667 19.5833H18.3333L16.25 23.75L12.0833 22.5L12.5 17.0833H7.5L6.66667 20L2.91667 21.25L1.66667 18.3333H5L5.41667 16.6667H2.5L2.08333 15H5L5.83333 12.9167H2.08333L2.5 11.25H5.83333L6.25 9.58333H0.833333L5 6.66667L6.66667 8.33333H11.75L10.5 5L13.1667 4.16667L16.25 5.83333L20.6667 0.666667L23.3333 3.33333L22.9167 7.5H28.5833L30.099 9.68229C31.4323 9.88021 32.4167 11.0313 32.4167 12.4167Z" fill="#E4572E" opacity="0.2"/></svg>`;
const pipeSvg = (height: number, canvasHeight: number, pipeGap: number) => `
  <svg width="52" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pipeGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#73BF29" />
        <stop offset="100%" stop-color="#558000" />
      </linearGradient>
    </defs>
    
    <rect x="2" y="0" width="48" height="${height - 25}" fill="url(#pipeGradient)" />
    <rect x="2" y="0" width="48" height="${height - 25}" fill="black" fill-opacity="0.1" />
    
    <rect x="0" y="${height - 25}" width="52" height="25" fill="url(#pipeGradient)" rx="3" ry="3" />
    <rect x="0" y="${height - 25}" width="52" height="25" fill="black" fill-opacity="0.2" rx="3" ry="3" />
    <rect x="4" y="${height - 23}" width="44" height="18" fill="url(#pipeGradient)" stroke="#456800" stroke-width="2" rx="2" ry="2"/>

    <rect x="2" y="${height + pipeGap + 25}" width="48" height="${canvasHeight - height - pipeGap - 25}" fill="url(#pipeGradient)" />
     <rect x="2" y="${height + pipeGap + 25}" width="48" height="${canvasHeight - height - pipeGap - 25}" fill="black" fill-opacity="0.1" />
   
    <rect x="0" y="${height + pipeGap}" width="52" height="25" fill="url(#pipeGradient)" rx="3" ry="3" />
    <rect x="0" y="${height + pipeGap}" width="52" height="25" fill="black" fill-opacity="0.2" rx="3" ry="3" />
    <rect x="4" y="${height + pipeGap + 4}" width="44" height="18" fill="url(#pipeGradient)" stroke="#456800" stroke-width="2" rx="2" ry="2"/>
  </svg>
`;

export default function FlappyBirdPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(true);
    const [gameStarted, setGameStarted] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);

    const gameAssets = useRef<{ 
      birdImage: HTMLImageElement | null;
      pipeImages: Record<string, HTMLImageElement>;
      sounds: Record<string, HTMLAudioElement | null>;
    }>({
      birdImage: null,
      pipeImages: {},
      sounds: { wing: null, hit: null, die: null }
    });

    const gameVars = useRef({
        bird: { x: 50, y: 150, width: 34, height: 24, velocity: 0 },
        gravity: 0.25,
        lift: -5,
        pipes: [] as { x: number, y: number, passed: boolean }[],
        pipeWidth: 52,
        pipeGap: 150,
        pipeSpeed: 2,
        pipeInterval: 120, // frames
        frameCount: 0,
    });

    // Load assets
    useEffect(() => {
        const birdImg = new Image();
        birdImg.src = "data:image/svg+xml;base64," + btoa(birdSvg);
        birdImg.onload = () => { gameAssets.current.birdImage = birdImg; };

        // Preload sounds
        const soundFiles = ['wing', 'hit', 'die'];
        soundFiles.forEach(sound => {
            const audio = new Audio(`/sounds/${sound}.mp3`);
            audio.load();
            gameAssets.current.sounds[sound] = audio;
        });

    }, []);

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

        const draw = () => {
            drawBackground();

            // Bird
            if (gameAssets.current.birdImage) {
                ctx.drawImage(gameAssets.current.birdImage, gameVars.current.bird.x, gameVars.current.bird.y, gameVars.current.bird.width, gameVars.current.bird.height);
            }

            // Pipes
            gameVars.current.pipes.forEach(pipe => {
                const pipeImage = getPipeImage(pipe.y, canvas.height);
                if (pipeImage && pipeImage.complete) {
                     ctx.drawImage(pipeImage, pipe.x, 0);
                }
            });
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
    }, [isGameOver, countdown]);

    const jump = () => {
        if (!isGameOver && countdown === null) {
            playSound('wing');
            gameVars.current.bird.velocity = gameVars.current.lift;
        }
    };
    
    const triggerCountdown = () => {
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
        gameVars.current.bird = { x: 50, y: 150, width: 34, height: 24, velocity: 0 };
        gameVars.current.pipes = [];
        gameVars.current.frameCount = 0;
        jump();
    };


    const endGame = () => {
        if (isGameOver) return; // Prevent multiple calls
        playSound('die');
        setIsGameOver(true);
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
                 <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Gamepad2 className="h-7 w-7" />
                    Flappy Bird
                </h1>
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
                        <h2 className="text-4xl font-extrabold mb-2">Flappy Bird</h2>
                        <p className="text-lg mb-4">Nhấn để bắt đầu</p>
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

