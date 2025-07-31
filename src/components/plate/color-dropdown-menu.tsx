
'use client';

import React from 'react';
import {
  useColorDropdownMenu,
  useColorsCustom,
  TColor,
} from '@udecode/plate-font';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '@/lib/utils';


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

const customColors: TColor[] = [
    { name: 'Teal', value: '#009688', isBrightColor: false },
    { name: 'Cyan', value: '#00BCD4', isBrightColor: false },
    { name: 'Lime', value: '#CDDC39', isBrightColor: false },
    { name: 'Amber', value: '#FFC107', isBrightColor: false },
    { name: 'Indigo', value: '#3F51B5', isBrightColor: false },
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
  const {
    getButtonProps,
    open,
    setOpen,
  } = useColorDropdownMenu({ nodeType });

  const {
    colors: customColors,
    updateColor,
    updateCustomColor,
  } = useColorsCustom({ nodeType });

  const render = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" {...getButtonProps()} className="h-8 w-8 p-1">
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Custom</span>
             <input
                type="color"
                value={customColors[0]?.value ?? '#000000'}
                onChange={(e) => updateCustomColor(e.target.value)}
                className="w-full h-8 p-0 border-none cursor-pointer"
            />
          </div>
          <Separator />
           <div className="grid grid-cols-5 gap-2">
            {colors.map((colorOption) => (
              <Tooltip key={colorOption.name}>
                  <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'h-6 w-6 rounded-full border flex items-center justify-center',
                        )}
                        style={{ backgroundColor: colorOption.value === 'default' ? 'transparent' : colorOption.value }}
                        onClick={() => updateColor(colorOption.value)}
                      />
                  </TooltipTrigger>
                  <TooltipContent>{colorOption.name}</TooltipContent>
              </Tooltip>
            ))}
           </div>
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
