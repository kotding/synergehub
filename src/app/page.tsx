"use client";

import { useEffect } from 'react';
import { FeatureCard } from '@/components/feature-card';
import { MessageSquare, Music, Gamepad2, FileText, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // If not loading and no user, redirect to login
        router.replace('/login');
      } else if (!profile) {
        // If user exists but no profile, redirect to create profile
        router.replace('/create-profile');
      }
    }
  }, [user, profile, loading, router]);
  
  // While loading or if redirection is happening, show a loading indicator.
  // This prevents a flash of the home page content for unauthenticated users.
  if (loading || !user || !profile) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 sm:p-8 md:p-12">
        <div className="text-2xl font-bold">Đang tải...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 sm:p-8 md:p-12 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-4">
          <>
            <span className="text-muted-foreground">Welcome back, {profile?.nickname}! {profile?.role === 'admin' && '(Admin)'}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Đăng xuất">
              <LogOut />
            </Button>
          </>
      </div>
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(hsl(var(--primary)/0.1)_1px,transparent_1px)] [background-size:24px_24px]"></div>
      <div className="text-center mb-12 z-10">
        <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-primary via-accent to-primary animate-gradient-xy">
          Synergy Hub
        </h1>
        <p className="text-muted-foreground mt-4 text-lg md:text-xl max-w-2xl mx-auto">
          Your interactive hub for a streamlined digital life. Select a feature to begin.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl z-10">
        <FeatureCard
          icon={<MessageSquare className="h-8 w-8 text-primary" />}
          title="Nhắn tin"
          description="Connect and chat with peers."
          href="/messaging"
        />
        <FeatureCard
          icon={<Music className="h-8 w-8 text-primary" />}
          title="Nghe nhạc"
          description="Your personal soundscape."
          href="/music"
        />
        <FeatureCard
          icon={<Gamepad2 className="h-8 w-8 text-primary" />}
          title="Chơi game"
          description="Enter the virtual arena."
          href="/gaming"
        />
        <FeatureCard
          icon={<FileText className="h-8 w-8 text-primary" />}
          title="Ghi chú"
          description="Capture your fleeting thoughts."
          href="/notes"
        />
      </div>
    </main>
  );
}
