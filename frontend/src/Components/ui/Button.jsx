import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm",
      "text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
))
Button.displayName = "Button"

export { Button }