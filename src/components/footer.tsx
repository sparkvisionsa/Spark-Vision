"use client";

import React, { useContext } from "react";
import { LanguageContext } from "@/components/layout-provider";
import { content } from "@/lib/content";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "./ui/button";

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

export default function Footer() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language, dir } = langContext;
  const c = content[language];

  return (
    <footer className="bg-secondary/50" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        {c.footer.title}
      </h2>
      <div className="container py-12">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <SparkleIcon className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold text-foreground">
                Spark Vision
              </span>
            </Link>
            <p className="text-base text-muted-foreground">
              {c.footer.description}
            </p>
            <div className="flex space-x-6 rtl:space-x-reverse">
              {c.footer.socials.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <span className="sr-only">{social.name}</span>
                  <social.icon className="h-6 w-6" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold leading-6 text-foreground">
                  {c.footer.solutions.title}
                </h3>
                <ul role="list" className="mt-6 space-y-4">
                  {c.footer.solutions.items.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className="text-sm leading-6 text-muted-foreground hover:text-foreground"
                      >
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold leading-6 text-foreground">
                  {c.footer.company.title}
                </h3>
                <ul role="list" className="mt-6 space-y-4">
                  {c.footer.company.items.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className="text-sm leading-6 text-muted-foreground hover:text-foreground"
                      >
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-border pt-8 sm:mt-20 lg:mt-24">
          <p className="text-xs leading-5 text-muted-foreground">
            &copy; {new Date().getFullYear()} Spark Vision. {c.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
