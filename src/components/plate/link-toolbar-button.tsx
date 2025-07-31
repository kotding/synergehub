
'use client';

import React from 'react';
import {
  useEditorRef,
  someNode,
} from '@udecode/plate-common';
import {
  ELEMENT_LINK,
  upsertLink,
  getPluginOptions,
} from '@udecode/plate-link';
import { useFocused, useSelected } from 'slate-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export function LinkToolbarButton({ nodeType = ELEMENT_LINK, tooltip, children }) {
  const editor = useEditorRef();
  const focused = useFocused();
  const selected = useSelected();
  const isLink = !!editor?.selection && someNode(editor, { match: { type: nodeType } });

  const render = (
      <Popover open={isLink && focused}>
            <PopoverTrigger asChild>
                <Button variant={isLink ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 p-1">
                  {children}
                </Button>
            </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="p-2">
            <Input
              className="h-8"
              placeholder="Dán đường dẫn..."
              defaultValue={getPluginOptions(editor, ELEMENT_LINK).getLinkUrl?.(editor) ?? ''}
              onChange={(e) => {
                upsertLink(editor, { url: e.target.value });
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
            {render}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return render;
}
