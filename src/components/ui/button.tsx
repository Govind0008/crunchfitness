import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out-expo hover:-translate-y-px active:translate-y-0 active:scale-[0.97] active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary call to action — the only filled brand button on a screen
        default: "btn-sweep bg-brand-400 text-ink-950 hover:bg-brand-300 hover:shadow-[0_10px_30px_-12px_rgba(176,212,63,0.6)] disabled:bg-ink-800 disabled:text-ink-500 disabled:opacity-100",
        // Secondary action on dark surfaces
        outline: "border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5",
        // Tertiary / quiet actions
        secondary: "bg-ink-800 text-white hover:bg-ink-700",
        ghost: "text-ink-300 hover:bg-white/5 hover:text-white",
        light: "bg-white text-ink-950 hover:bg-ink-200",
        whatsapp: "bg-[#25D366] text-ink-950 hover:bg-[#3ee27b]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "rounded-none px-0 text-brand-400 underline-offset-4 hover:underline hover:translate-y-0",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-6 text-sm",
        lg: "h-12 px-7 text-[0.95rem] sm:h-14 sm:px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
