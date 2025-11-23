"use client";

import React, { useContext } from "react";
import Image from "next/image";
import SparkLogo from "@/app/Spark.jpg";
import { LanguageContext } from "@/components/layout-provider";
import { content } from "@/lib/content";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "./ui/button";


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
              <div className="w-9 h-9 overflow-hidden rounded-md">
                <Image
                  src={SparkLogo}
                  alt="Spark Vision"
                  width={36}
                  height={36}
                  className="object-cover object-center w-full h-full"
                />
              </div>
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
