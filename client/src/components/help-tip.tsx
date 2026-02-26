import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from "@/tooltips";

export function HelpTip({ id, side = "top" }: { id: string; side?: "top" | "bottom" | "left" | "right" }) {
  const tip = TOOLTIPS[id];
  if (!tip) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center ml-1 text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`help-tip-${id}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs bg-popover text-popover-foreground border border-border p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">{tip.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{tip.body}</p>
          <p className="text-xs">
            <span className="font-medium text-muted-foreground">Changes picks: </span>
            <span className={tip.changesPicks.startsWith("Yes") ? "text-amber-400" : "text-muted-foreground"}>
              {tip.changesPicks}
            </span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
