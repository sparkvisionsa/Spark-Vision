import { cn } from "@/lib/utils";
import React from "react";

interface HeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  className,
}: HeadingProps) {
  return (
    <div className={cn("text-center", className)}>
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-headline">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}
