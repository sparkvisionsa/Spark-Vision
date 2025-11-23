"use client";

import React, { useContext, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./language-switcher";
import { Menu } from "lucide-react";
import Image from "next/image";
import SparkLogo from "@/app/Spark.jpg";
import { LanguageContext } from "./layout-provider";
import { content } from "@/lib/content";




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
            <div className="w-10 h-10 overflow-hidden rounded-md">
              <Image
                src={SparkLogo}
                alt="Spark Vision"
                width={40}
                height={40}
                className="object-cover object-center w-full h-full"
              />
            </div>
            <span className="hidden font-bold sm:inline-block">Spark Vision</span>
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
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <Link
              href="/"
              className="flex items-center"
              onClick={() => setIsOpen(false)}
            >
              <div className="mr-2 w-9 h-9 overflow-hidden rounded-md">
                <Image
                  src={SparkLogo}
                  alt="Spark Vision"
                  width={36}
                  height={36}
                  className="object-cover object-center w-full h-full"
                />
              </div>
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
          <div className="w-9 h-9 overflow-hidden rounded-md">
            <Image
              src={SparkLogo}
              alt="Spark Vision"
              width={36}
              height={36}
              className="object-cover object-center w-full h-full"
            />
          </div>
          <span className="font-bold">Spark Vision</span>
        </Link>

        {/* <div className="flex flex-1 items-center justify-end space-x-2 rtl:space-x-reverse">
          <LanguageSwitcher />
        </div> */}
      </div>
    </header>
  );
}
