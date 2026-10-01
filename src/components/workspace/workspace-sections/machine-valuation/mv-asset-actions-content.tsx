"use client";

import * as React from "react";
import { DropdownMenuContent } from "@/components/ui/dropdown-menu";

/** Asset menus can be taller than the viewport on phones and short windows. */
export const MvAssetActionsContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(({ style, collisionPadding = 8, ...props }, ref) => (
  <DropdownMenuContent
    {...props}
    ref={ref}
    collisionPadding={collisionPadding}
    style={{
      ...style,
      maxWidth: "calc(100vw - 1rem)",
      maxHeight: "var(--radix-dropdown-menu-content-available-height)",
      overflowY: "auto",
      overscrollBehavior: "contain",
    }}
  />
));
MvAssetActionsContent.displayName = "MvAssetActionsContent";
