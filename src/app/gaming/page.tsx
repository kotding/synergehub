
"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Search, Gamepad2 } from 'lucide-react';
import Image from 'next/image';

const allGames = [
  { id: 1, title: 'Flappy Bird', description: 'Navigate the bird through the pipes.', imageUrl: 'https://placehold.co/400x300.png', dataAiHint: 'flappy bird', href: '/gaming/flappy-bird' },
  // Future games will be added here
];

export default function GamingPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGames = useMemo(() => {
    if (!searchQuery) {
      return allGames;
    }
    return allGames.filter(game =>
      game.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-10 w-10">
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-3xl sm:text-4xl font-bold text-primary flex items-center gap-2">
            <Gamepad2 className="h-8 w-8" />
            Game Center
          </h1>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm trò chơi..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1">
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGames.map(game => (
              <Card key={game.id} className="overflow-hidden bg-card/50 group transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
                 <Link href={game.href} className="block h-full">
                    <CardContent className="p-0">
                      <div className="relative aspect-[4/3] w-full overflow-hidden">
                        <Image
                          src={game.imageUrl}
                          alt={game.title}
                          data-ai-hint={game.dataAiHint}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-xl font-bold truncate group-hover:text-primary transition-colors">{game.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">{game.description}</p>
                        <Button className="w-full mt-2">
                          Chơi ngay
                        </Button>
                      </div>
                    </CardContent>
                 </Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full py-20">
            <Search className="h-16 w-16 mb-4" />
            <h3 className="text-xl font-semibold">Không tìm thấy trò chơi nào</h3>
            <p>Hãy thử một từ khóa tìm kiếm khác.</p>
          </div>
        )}
      </main>
    </div>
  );
}
