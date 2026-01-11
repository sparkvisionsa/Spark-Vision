"use client";

import React, { useContext, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./language-switcher";
import { ChevronDown, Menu } from "lucide-react";
import Image from "next/image";
import SparkLogo from "@/app/Spark.jpg";
import { LanguageContext } from "./layout-provider";
import { content } from "@/lib/content";

interface HeaderProps {
  navDisabled?: boolean;
}

export default function Header({ navDisabled = false }: HeaderProps) {
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
          <Link
            href="/"
            className={`mr-6 flex items-center space-x-2 rtl:space-x-reverse ${navDisabled ? "pointer-events-none opacity-80" : ""}`}
            aria-disabled={navDisabled}
            tabIndex={navDisabled ? -1 : undefined}
            onClick={navDisabled ? (e) => e.preventDefault() : undefined}
          >
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
            {c.nav.map((item) =>
              item.href === "#services" ? (
                <DropdownMenu key={item.name}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-2 transition-colors hover:text-foreground/80 text-foreground/60 ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                      aria-disabled={navDisabled}
                      tabIndex={navDisabled ? -1 : undefined}
                      disabled={navDisabled}
                    >
                      {item.name}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href="/value-tech" className="flex w-full items-center justify-between">
                        Value Tech Application
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`transition-colors hover:text-foreground/80 text-foreground/60 ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                  aria-disabled={navDisabled}
                  tabIndex={navDisabled ? -1 : undefined}
                  onClick={navDisabled ? (e) => e.preventDefault() : undefined}
                >
                  {item.name}
                </Link>
              )
            )}
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
              className={`flex items-center ${navDisabled ? "pointer-events-none opacity-80" : ""}`}
              onClick={() => setIsOpen(false)}
              aria-disabled={navDisabled}
              tabIndex={navDisabled ? -1 : undefined}
              onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
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
                {c.nav.map((item) =>
                  item.href === "#services" ? (
                    <details key={item.href} className="group">
                      <summary
                        className={`flex cursor-pointer list-none items-center justify-between text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                        aria-disabled={navDisabled}
                        tabIndex={navDisabled ? -1 : undefined}
                        onClick={navDisabled ? (e) => e.preventDefault() : undefined}
                      >
                        <span>{item.name}</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 flex flex-col gap-2 pl-4">
                        <Link
                          href="/value-tech"
                          onClick={() => setIsOpen(false)}
                          className={`text-sm text-foreground/80 hover:text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                          aria-disabled={navDisabled}
                          tabIndex={navDisabled ? -1 : undefined}
                          onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
                        >
                          Value Tech Application
                        </Link>
                      </div>
                    </details>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                      aria-disabled={navDisabled}
                      tabIndex={navDisabled ? -1 : undefined}
                      onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
                    >
                      {item.name}
                    </Link>
                  )
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <Link
          href="/"
          className={`flex items-center space-x-2 rtl:space-x-reverse md:hidden ${navDisabled ? "pointer-events-none opacity-80" : ""}`}
          aria-disabled={navDisabled}
          tabIndex={navDisabled ? -1 : undefined}
          onClick={navDisabled ? (e) => e.preventDefault() : undefined}
        >
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

        <div className="flex flex-1 items-center justify-end space-x-2 rtl:space-x-reverse">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
