import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  gradient?: boolean;
}

function getGradientColor(value: number): string {
  if (value <= 30) return "hsl(0, 72%, 50%)";
  if (value <= 50) return "hsl(30, 90%, 50%)";
  if (value <= 70) return "hsl(45, 90%, 50%)";
  return "hsl(142, 60%, 45%)";
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, gradient, value, defaultValue, ...props }, ref) => {
  const currentValue = (value as number[] | undefined)?.[0] ?? (defaultValue as number[] | undefined)?.[0] ?? 50;
  const color = gradient ? getGradientColor(currentValue) : undefined;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <SliderPrimitive.Track
        className="relative h-2.5 w-full grow overflow-hidden rounded-full"
        style={gradient ? { background: "linear-gradient(to right, hsl(0,72%,50%), hsl(45,90%,50%), hsl(142,60%,45%))" } : undefined}
      >
        <SliderPrimitive.Range
          className={cn("absolute h-full", !gradient && "bg-primary")}
          style={gradient ? { background: color } : undefined}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-6 w-6 rounded-full border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-md"
        style={gradient ? { borderColor: color } : { borderColor: "hsl(var(--primary))" }}
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
