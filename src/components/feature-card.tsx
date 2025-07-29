"use client";

import Link from 'next/link';
import { type ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
}

export function FeatureCard({ icon, title, description, href }: FeatureCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full bg-card/60 backdrop-blur-sm border-2 border-transparent hover:border-primary transition-all duration-300 ease-in-out transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-accent/10">
        <CardHeader className="flex flex-col h-full p-6">
          <div className="bg-primary/10 p-3 rounded-lg mb-4">
            {icon}
          </div>
          <div className="flex-grow space-y-1">
            <CardTitle className="font-headline text-2xl font-bold text-card-foreground group-hover:text-primary transition-colors duration-300">
              {title}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {description}
            </CardDescription>
          </div>
          <div className="mt-4 flex justify-end w-full">
            <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
