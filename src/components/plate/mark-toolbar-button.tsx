
'use client';

import React from 'react';
import { useMarkToolbarButton, useEditorRef } from '@udecode/plate-common';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export function MarkToolbarButton({
  nodeType,
  tooltip,
  children,
}: {
  nodeType: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  const editor = useEditorRef();
  const { props } = useMarkToolbarButton({ nodeType });

  const render = (
    <Button
      variant={props.pressed ? 'secondary' : 'ghost'}
      size="icon"
      className="h-8 w-8 p-1"
      {...props}
    >
      {children}
    </Button>
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
