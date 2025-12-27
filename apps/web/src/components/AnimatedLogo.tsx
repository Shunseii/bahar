import { cn } from "@bahar/design-system";
import Logo from "@/assets/logo.svg";

interface AnimatedLogoProps {
  className?: string;
}

export const AnimatedLogo = ({ className }: AnimatedLogoProps) => {
  return (
    <>
      <img
        alt="Bahar"
        className={cn(
          "h-16 w-16",
          "animate-[blurReveal_500ms_ease-out_forwards]",
          className
        )}
        src={Logo}
        style={{ filter: "blur(12px)", transform: "scale(0.9)" }}
      />
      <style>{`
          @keyframes blurReveal {
            to {
              filter: blur(0px);
              transform: scale(1);
            }
          }
        `}</style>
    </>
  );
};
