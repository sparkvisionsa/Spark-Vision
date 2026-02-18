"use client";

import React, { useContext, useEffect, useState } from "react";
import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./language-switcher";
import AuthUserMenu from "./auth-user-menu";
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
  const [mounted, setMounted] = useState(false);
  const langContext = useContext(LanguageContext);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!langContext) {
    return null;
  }

  const { language } = langContext;
  const isArabic = language === "ar";
  const c = content[language];
  const serviceMenuLabels =
    isArabic
      ? {
          valueTech: "\u0641\u0627\u0644\u064A\u0648 \u062A\u0643",
          valueTechApp: "\u062A\u0637\u0628\u064A\u0642 Value Tech",
          evaluationSource: "\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u062A\u0642\u064A\u064A\u0645",
          cars: "\u0627\u0644\u0633\u064A\u0627\u0631\u0627\u062A",
          realEstate: "\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          other: "\u0623\u062E\u0631\u0649",
        }
      : {
          valueTech: "Value Tech",
          valueTechApp: "Value Tech App",
          evaluationSource: "Evaluation Source",
          cars: "Cars",
          realEstate: "Real Estate",
          other: "Other",
        };
  const showValueTechAppLink = false;

  const resolveNavHref = (href: string) => {
    if (href.startsWith("#")) {
      return `/${href}`;
    }
    return href;
  };

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href="/"
            className={`flex items-center space-x-2 rtl:space-x-reverse ${navDisabled ? "pointer-events-none opacity-80" : ""}`}
            aria-disabled={navDisabled}
            tabIndex={navDisabled ? -1 : undefined}
            onClick={navDisabled ? (e) => e.preventDefault() : undefined}
          >
            <div className="h-9 w-9 overflow-hidden rounded-md">
              <Image
                src={SparkLogo}
                alt="Spark Vision"
                width={36}
                height={36}
                className="h-full w-full object-cover object-center"
              />
            </div>
            <span className="font-bold">Spark Vision</span>
          </Link>
          <nav className="hidden items-center space-x-4 text-sm text-foreground/70 rtl:space-x-reverse md:flex">
            {c.nav.map((item) => (
              <Link
                key={item.href}
                href={resolveNavHref(item.href)}
                className={`${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                aria-disabled={navDisabled}
                tabIndex={navDisabled ? -1 : undefined}
                onClick={navDisabled ? (e) => e.preventDefault() : undefined}
              >
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="hidden ltr:mr-4 rtl:ml-4 md:flex">
          <Link
            href="/"
            className={`flex items-center ltr:mr-6 rtl:ml-6 space-x-2 rtl:space-x-reverse ${navDisabled ? "pointer-events-none opacity-80" : ""}`}
            aria-disabled={navDisabled}
            tabIndex={navDisabled ? -1 : undefined}
            onClick={navDisabled ? (e) => e.preventDefault() : undefined}
          >
            <div className="h-10 w-10 overflow-hidden rounded-md">
              <Image
                src={SparkLogo}
                alt="Spark Vision"
                width={40}
                height={40}
                className="h-full w-full object-cover object-center"
              />
            </div>
            <span className="hidden font-bold sm:inline-block">Spark Vision</span>
          </Link>

          <nav className="flex items-center space-x-6 text-sm font-medium rtl:space-x-reverse">
            {c.nav.map((item) =>
              item.href === "#services" ? (
                <DropdownMenu key={item.name} dir={isArabic ? "rtl" : "ltr"}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-2 text-foreground/60 transition-colors hover:text-foreground/80 ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                      aria-disabled={navDisabled}
                      tabIndex={navDisabled ? -1 : undefined}
                      disabled={navDisabled}
                    >
                      {item.name}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align={isArabic ? "end" : "start"}
                    className={`w-56 ${isArabic ? "text-right" : "text-left"}`}
                  >
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger
                        className={`flex w-full items-center justify-between ${
                          isArabic
                            ? "[&_svg]:ml-0 [&_svg]:mr-auto [&_svg]:rotate-180"
                            : "[&_svg]:ml-auto [&_svg]:mr-0"
                        }`}
                      >
                        {serviceMenuLabels.valueTech}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className={`w-56 ${isArabic ? "text-right" : "text-left"}`}>
                        {showValueTechAppLink ? (
                          <DropdownMenuItem asChild>
                            <Link href="/value-tech-app" className="flex w-full items-center justify-between">
                              {serviceMenuLabels.valueTechApp}
                            </Link>
                          </DropdownMenuItem>
                        ) : null}

                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger
                            className={`flex w-full items-center justify-between ${
                              isArabic
                                ? "[&_svg]:ml-0 [&_svg]:mr-auto [&_svg]:rotate-180"
                                : "[&_svg]:ml-auto [&_svg]:mr-0"
                            }`}
                          >
                            {serviceMenuLabels.evaluationSource}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className={`w-52 ${isArabic ? "text-right" : "text-left"}`}>
                            <DropdownMenuItem asChild>
                              <Link href="/evaluation-source/cars" className="flex w-full items-center justify-between">
                                {serviceMenuLabels.cars}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href="/evaluation-source/real-estate" className="flex w-full items-center justify-between">
                                {serviceMenuLabels.realEstate}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href="/evaluation-source/other" className="flex w-full items-center justify-between">
                                {serviceMenuLabels.other}
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  key={item.name}
                  href={resolveNavHref(item.href)}
                  className={`text-foreground/60 transition-colors hover:text-foreground/80 ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
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
              <div className="mr-2 h-9 w-9 overflow-hidden rounded-md">
                <Image
                  src={SparkLogo}
                  alt="Spark Vision"
                  width={36}
                  height={36}
                  className="h-full w-full object-cover object-center"
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
                        className={`flex cursor-pointer list-none items-center justify-between text-foreground ${
                          isArabic ? "flex-row-reverse" : ""
                        } ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                        aria-disabled={navDisabled}
                        tabIndex={navDisabled ? -1 : undefined}
                        onClick={navDisabled ? (e) => e.preventDefault() : undefined}
                      >
                        <span>{item.name}</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>

                      <div className="mt-2 flex flex-col gap-2 pl-4">
                        <details className="group">
                          <summary
                            className={`flex cursor-pointer list-none items-center justify-between text-sm text-foreground/80 hover:text-foreground ${
                              isArabic ? "flex-row-reverse" : ""
                            } ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                            aria-disabled={navDisabled}
                            tabIndex={navDisabled ? -1 : undefined}
                            onClick={navDisabled ? (e) => e.preventDefault() : undefined}
                          >
                            <span>{serviceMenuLabels.valueTech}</span>
                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                          </summary>

                          <div className="mt-2 flex flex-col gap-2 pl-4">
                            {showValueTechAppLink ? (
                              <Link
                                href="/value-tech-app"
                                onClick={() => setIsOpen(false)}
                                className={`text-sm text-foreground/80 hover:text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                                aria-disabled={navDisabled}
                                tabIndex={navDisabled ? -1 : undefined}
                                onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
                              >
                                {serviceMenuLabels.valueTechApp}
                              </Link>
                            ) : null}

                            <details className="group">
                              <summary
                                className={`flex cursor-pointer list-none items-center justify-between text-sm text-foreground/80 hover:text-foreground ${
                                  isArabic ? "flex-row-reverse" : ""
                                } ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                                aria-disabled={navDisabled}
                                tabIndex={navDisabled ? -1 : undefined}
                                onClick={navDisabled ? (e) => e.preventDefault() : undefined}
                              >
                                <span>{serviceMenuLabels.evaluationSource}</span>
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                              </summary>

                              <div className="mt-2 flex flex-col gap-2 pl-4">
                                <Link
                                  href="/evaluation-source/cars"
                                  onClick={() => setIsOpen(false)}
                                  className={`text-sm text-foreground/80 hover:text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                                  aria-disabled={navDisabled}
                                  tabIndex={navDisabled ? -1 : undefined}
                                  onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
                                >
                                  {serviceMenuLabels.cars}
                                </Link>
                                <Link
                                  href="/evaluation-source/real-estate"
                                  onClick={() => setIsOpen(false)}
                                  className={`text-sm text-foreground/80 hover:text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                                  aria-disabled={navDisabled}
                                  tabIndex={navDisabled ? -1 : undefined}
                                  onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
                                >
                                  {serviceMenuLabels.realEstate}
                                </Link>
                                <Link
                                  href="/evaluation-source/other"
                                  onClick={() => setIsOpen(false)}
                                  className={`text-sm text-foreground/80 hover:text-foreground ${navDisabled ? "pointer-events-none text-foreground/40" : ""}`}
                                  aria-disabled={navDisabled}
                                  tabIndex={navDisabled ? -1 : undefined}
                                  onClickCapture={navDisabled ? (e) => e.preventDefault() : undefined}
                                >
                                  {serviceMenuLabels.other}
                                </Link>
                              </div>
                            </details>
                          </div>
                        </details>
                      </div>
                    </details>
                  ) : (
                    <Link
                      key={item.href}
                      href={resolveNavHref(item.href)}
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
          <div className="h-9 w-9 overflow-hidden rounded-md">
            <Image
              src={SparkLogo}
              alt="Spark Vision"
              width={36}
              height={36}
              className="h-full w-full object-cover object-center"
            />
          </div>
          <span className="font-bold">Spark Vision</span>
        </Link>

        <div className="flex flex-1 items-center justify-end space-x-2 rtl:space-x-reverse">
          <AuthUserMenu />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
