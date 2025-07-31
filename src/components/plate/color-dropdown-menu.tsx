
'use client';

import React from 'react';
import {
  useEditorColor,
  TColor,
  ColorDropdownMenuItems,
  ColorInput,
  colors,
} from '@udecode/plate-font';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type ColorDropdownMenuProps = {
  nodeType: string;
  tooltip?: string;
  children: React.ReactNode;
};

export function ColorDropdownMenu({
  nodeType,
  tooltip,
  children,
}: ColorDropdownMenuProps) {
  const { color, activeColor, updateColor } = useEditorColor(nodeType);

  const render = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-1">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex flex-col gap-4 p-4">
          <ColorInput color={color} setColor={updateColor} />
          <Separator />
          <ColorDropdownMenuItems
            color={color}
            onValueChange={updateColor}
          />
        </div>
      </PopoverContent>
    </Popover>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{render}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return render;
}
