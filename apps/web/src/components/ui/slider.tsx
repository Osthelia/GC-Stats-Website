"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({ className, ...props }: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root data-slot="slider" className={cn("w-full", className)} {...props}>
      <SliderPrimitive.Control className="flex h-5 w-full cursor-pointer touch-none items-center select-none data-disabled:opacity-50">
        <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-muted">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="size-4 rounded-full border border-primary bg-background shadow-sm transition-transform outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-110" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
