import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function MusicPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <div className="text-center">
            <h1 className="font-headline text-5xl font-bold text-primary mb-4">Music</h1>
            <p className="text-muted-foreground mb-8 text-lg">This feature is under construction. Check back soon!</p>
            <Button asChild variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back to Hub
                </Link>
            </Button>
        </div>
    </div>
  );
}
