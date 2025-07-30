
"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Gamepad2, Play, RefreshCw } from 'lucide-react';

export default function FlappyBirdPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(true);
    const [gameStarted, setGameStarted] = useState(false);

    // Game variables using refs to persist across renders
    const gameVars = useRef({
        bird: { x: 50, y: 150, width: 34, height: 24, velocity: 0 },
        gravity: 0.3,
        lift: -6,
        pipes: [] as { x: number, y: number, passed: boolean }[],
        pipeWidth: 52,
        pipeGap: 150,
        pipeSpeed: 2,
        pipeInterval: 120, // frames
        frameCount: 0,
    });

    useEffect(() => {
      const storedHighScore = localStorage.getItem('flappyBirdHighScore');
      if (storedHighScore) {
        setHighScore(parseInt(storedHighScore, 10));
      }
    }, []);

    useEffect(() => {
        if (isGameOver) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        let animationFrameId: number;

        const draw = () => {
            // Background
            ctx.fillStyle = '#70c5ce'; // Sky blue
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Bird
            ctx.fillStyle = '#f2d45c'; // Yellow
            ctx.fillRect(gameVars.current.bird.x, gameVars.current.bird.y, gameVars.current.bird.width, gameVars.current.bird.height);

            // Pipes
            ctx.fillStyle = '#558000'; // Green
            gameVars.current.pipes.forEach(pipe => {
                ctx.fillRect(pipe.x, 0, gameVars.current.pipeWidth, pipe.y); // Top pipe
                ctx.fillRect(pipe.x, pipe.y + gameVars.current.pipeGap, gameVars.current.pipeWidth, canvas.height - pipe.y - gameVars.current.pipeGap); // Bottom pipe
            });
        };

        const update = () => {
            // Bird physics
            gameVars.current.bird.velocity += gameVars.current.gravity;
            gameVars.current.bird.y += gameVars.current.bird.velocity;
            
            // Pipe management
            gameVars.current.frameCount++;
            if (gameVars.current.frameCount % gameVars.current.pipeInterval === 0) {
                 const pipeY = Math.floor(Math.random() * (canvas.height - gameVars.current.pipeGap - 100)) + 50;
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
            // Ground collision
            if (bird.y + bird.height > canvas.height || bird.y < 0) {
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
    }, [isGameOver]);

    const jump = () => {
        if (!isGameOver) {
            gameVars.current.bird.velocity = gameVars.current.lift;
        }
    };
    
    const startGame = () => {
        setIsGameOver(false);
        setGameStarted(true);
        setScore(0);
        gameVars.current.bird = { x: 50, y: 150, width: 34, height: 24, velocity: 0 };
        gameVars.current.pipes = [];
        gameVars.current.frameCount = 0;
    };

    const endGame = () => {
        setIsGameOver(true);
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('flappyBirdHighScore', score.toString());
        }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (isGameOver) {
                startGame();
            } else {
                jump();
            }
        }
    };

    const handleClick = () => {
        if (isGameOver) {
            startGame();
        } else {
            jump();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGameOver]);

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

                {(isGameOver && gameStarted) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center">
                        <h2 className="text-4xl font-extrabold mb-2">Game Over</h2>
                        <p className="text-xl mb-4">Điểm: {score}</p>
                        <Button onClick={startGame} size="lg">
                            <RefreshCw className="mr-2" />
                            Chơi lại
                        </Button>
                    </div>
                )}
                 {(isGameOver && !gameStarted) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4 text-center">
                        <h2 className="text-4xl font-extrabold mb-2">Flappy Bird</h2>
                        <p className="text-lg mb-4">Nhấn để bắt đầu</p>
                        <Button onClick={startGame} size="lg">
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

