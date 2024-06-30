import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useDir } from "@/hooks/useDir";
import { TOAST_REMOVE_DELAY, useToast } from "@/hooks/useToast";

export function Toaster() {
  const { toasts } = useToast();
  const dir = useDir();

  return (
    <ToastProvider
      swipeDirection={dir === "rtl" ? "left" : "right"}
      duration={TOAST_REMOVE_DELAY}
    >
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
