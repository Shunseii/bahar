import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const getDirection = (): "ltr" | "rtl" => {
  const documentDir = document.documentElement.dir;

  if (documentDir === "rtl") {
    return "rtl";
  }

  if (documentDir === "ltr") {
    return "ltr";
  }

  return "ltr";
};

const Toaster = ({ position, ...props }: ToasterProps) => {
  const dir = getDirection();
  const isRtl = dir === "rtl";

  // Flip position for RTL if not explicitly set
  const resolvedPosition: ToasterProps["position"] =
    position ?? (isRtl ? "bottom-left" : "bottom-right");

  return (
    <Sonner
      className="toaster group"
      dir={dir}
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      position={resolvedPosition}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-background group-[.toaster]:!text-foreground group-[.toaster]:!border-border group-[.toaster]:shadow-lg",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
