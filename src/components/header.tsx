"use client";

import React, { useContext, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./language-switcher";
import { Menu, Sparkles } from "lucide-react";
import { LanguageContext } from "./layout-provider";
import { content } from "@/lib/content";

const SparkleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9.5 2.5a2.5 2.5 0 0 1 5 0" />
    <path d="M12 6.36V3" />
    <path d="M15.41 7.5l2.09-2.09" />
    <path d="M17.5 9.5a2.5 2.5 0 0 1 0 5" />
    <path d="M17.64 12H21" />
    <path d="M15.41 16.5l2.09 2.09" />
    <path d="M12 17.64V21" />
    <path d="M8.59 16.5l-2.09 2.09" />
    <path d="M6.5 14.5a2.5 2.5 0 0 1 0-5" />
    <path d="M6.36 12H3" />
    <path d="M8.59 7.5L6.5 5.41" />
  </svg>
);


export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const langContext = useContext(LanguageContext);

  if (!langContext) {
    return null;
  }
  const { language } = langContext;
  const c = content[language];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2 rtl:space-x-reverse">
            <SparkleIcon className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">
              Spark Vision
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium rtl:space-x-reverse">
            {c.nav.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="pr-0">
            <Link
              href="/"
              className="flex items-center"
              onClick={() => setIsOpen(false)}
            >
              <SparkleIcon className="mr-2 h-6 w-6 text-primary" />
              <span className="font-bold">Spark Vision</span>
            </Link>
            <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
              <div className="flex flex-col space-y-3">
                {c.nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="text-foreground"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <Link href="/" className="flex items-center space-x-2 rtl:space-x-reverse md:hidden">
            <SparkleIcon className="h-6 w-6 text-primary" />
            <span className="font-bold">Spark Vision</span>
        </Link>

        <div className="flex flex-1 items-center justify-end space-x-2 rtl:space-x-reverse">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
