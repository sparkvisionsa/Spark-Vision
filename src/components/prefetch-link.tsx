"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type AnchorHTMLAttributes } from "react";

type PrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    prefetchOnIntent?: boolean;
  };

function resolvePathname(href: LinkProps["href"]) {
  if (typeof href === "string") return href;
  if (typeof href.pathname === "string") return href.pathname;
  return "";
}

export default function PrefetchLink({
  href,
  prefetchOnIntent = true,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: PrefetchLinkProps) {
  const router = useRouter();

  const prefetch = useCallback(() => {
    if (!prefetchOnIntent) return;
    const pathname = resolvePathname(href);
    if (!pathname.startsWith("/")) return;
    void router.prefetch(pathname);
  }, [href, prefetchOnIntent, router]);

  return (
    <Link
      href={href}
      onMouseEnter={(event) => {
        prefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        onTouchStart?.(event);
      }}
      {...props}
    />
  );
}
