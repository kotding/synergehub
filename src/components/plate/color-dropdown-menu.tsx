
'use client';

import React from 'react';
import {
  useEditorColor,
  TColor,
  useColorDropdownMenuState,
} from '@udecode/plate-font';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const colors: TColor[] = [
  { name: 'Default', value: 'default', isBrightColor: false },
  { name: 'Gray', value: '#757575', isBrightColor: false },
  { name: 'Brown', value: '#795548', isBrightColor: false },
  { name: 'Orange', value: '#FF9800', isBrightColor: false },
  { name: 'Yellow', value: '#FFC107', isBrightColor: false },
  { name: 'Green', value: '#4CAF50', isBrightColor: false },
  { name: 'Blue', value: '#2196F3', isBrightColor: false },
  { name: 'Purple', value: '#9C27B0', isBrightColor: false },
  { name: 'Red', value: '#F44336', isBrightColor: false },
  { name: 'Pink', value: '#E91E63', isBrightColor: false },
];

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
  const state = useColorDropdownMenuState({
      nodeType,
      colors,
      closeOnSelect: true,
  });
  const { selectedColor, color, updateColor } = useEditorColor(nodeType);

  const render = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 p-1">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Custom</span>
                <input
                    type="color"
                    value={selectedColor || color || ''}
                    onChange={(e) => updateColor(e.target.value)}
                    className="w-full h-8 p-0 border-none cursor-pointer"
                />
              </div>
              <Separator />
               {colors.map((colorOption) => (
                  <button
                    type="button"
                    key={colorOption.name}
                    className="flex items-center gap-2 p-1 rounded hover:bg-accent"
                    onClick={() => updateColor(colorOption.value === 'default' ? '' : colorOption.value)}
                  >
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: colorOption.value === 'default' ? 'transparent' : colorOption.value }}
                    />
                    <span>{colorOption.name}</span>
                  </button>
                ))}
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
