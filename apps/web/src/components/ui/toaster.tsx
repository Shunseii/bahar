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
      duration={TOAST_REMOVE_DELAY}
      swipeDirection={dir === "rtl" ? "left" : "right"}
    >
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
