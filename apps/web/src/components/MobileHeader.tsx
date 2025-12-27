import { cn } from "@bahar/design-system";
import { Button } from "@bahar/web-ui/components/button";
import {
  Sheet,
  type SheetContent,
  SheetOverlay,
  SheetTrigger,
} from "@bahar/web-ui/components/sheet";
import { sheetVariantsNoSlideAnimations } from "@bahar/web-ui/components/sheet/variants";
import { Trans } from "@lingui/react/macro";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { useClickAway } from "@uidotdev/usehooks";
import { atom, useAtom } from "jotai";
import { Home, Layers, PanelLeft, Settings, X } from "lucide-react";
import { motion } from "motion/react";
import React, { type FC, type PropsWithChildren } from "react";
import Logo from "@/assets/logo.svg";
import { NavLink } from "@/components/NavLink";
import { useDir } from "@/hooks/useDir";
import { useLogout } from "@/hooks/useLogout";

const isOpenAtom = atom(false);

const DraggableSheetContent: typeof SheetContent = React.forwardRef(
  ({ side = "right", className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const dir = useDir();

    return (
      <div>
        <SheetOverlay />

        <motion.div
          animate={{ x: isOpen ? 0 : dir === "rtl" ? 1000 : -1000 }}
          className="pointer-events-none fixed top-0 z-[100] h-full w-screen sm:hidden ltr:left-0 rtl:right-0"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{
            left: dir === "rtl" ? 0 : 1,
            right: dir === "rtl" ? 1 : 0,
          }}
          dragMomentum={false}
          initial={{ x: 0 }}
          onDragEnd={(_e, info) => {
            const { x: xOffset } = info.offset;
            const { x: xVelocity } = info.velocity;

            const isDraggedRight = xVelocity > 0 || xOffset > 0;
            const isDraggedLeft = xVelocity < 0 || xOffset < 0;

            if (
              (dir === "rtl" && isDraggedRight) ||
              (dir === "ltr" && isDraggedLeft)
            ) {
              setIsOpen(false);
            }
          }}
          transition={{ type: "just" }}
        >
          <SheetPrimitive.Content
            className={cn(
              sheetVariantsNoSlideAnimations({ side }),
              className,
              "w-[70vw] border-border ltr:border-r rtl:border-l"
            )}
            ref={ref}
            {...props}
          >
            <SheetPrimitive.Title className="sr-only">
              <Trans>Menu</Trans>
            </SheetPrimitive.Title>
            <SheetPrimitive.Description className="sr-only">
              <Trans>Navigation menu</Trans>
            </SheetPrimitive.Description>
            {children}

            <button
              className="absolute top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary ltr:right-4 rtl:left-4"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </SheetPrimitive.Content>
        </motion.div>
      </div>
    );
  }
);
DraggableSheetContent.displayName = SheetPrimitive.Content.displayName;

export const MobileHeader: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useAtom(isOpenAtom);
  const ref = useClickAway(() => {
    setIsOpen(false);
  });
  const { logout } = useLogout();
  const dir = useDir();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet open={isOpen}>
        <SheetTrigger asChild>
          <Button
            className="sm:hidden"
            onClick={() => setIsOpen(!isOpen)}
            size="icon"
            variant="outline"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">
              <Trans>Toggle Menu</Trans>
            </span>
          </Button>
        </SheetTrigger>

        <DraggableSheetContent
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          className="sm:max-w-xs"
          ref={ref as any}
          side={dir === "rtl" ? "right" : "left"}
        >
          <nav className="flex flex-col gap-y-6 font-medium text-lg">
            <Link
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-y-2 font-semibold text-lg md:text-base"
              onClick={() => {
                setIsOpen(false);
              }}
              params={{}}
              to="/"
            >
              <img
                className="h-5 w-5 transition-all group-hover:scale-110"
                src={Logo}
                alt="Bahar logo"
              />
              <span className="sr-only">
                <Trans>Bahar</Trans>
              </span>
            </Link>

            <div className="flex flex-col gap-y-2">
              <NavLink
                className="h-auto w-auto justify-start gap-x-2"
                onClick={() => {
                  setIsOpen(false);
                }}
                params={{}}
                to="/"
              >
                <Home className="h-5 w-5" />
                <Trans>Home</Trans>
              </NavLink>

              <NavLink
                className="h-auto w-auto justify-start gap-x-2"
                onClick={() => {
                  setIsOpen(false);
                }}
                params={{}}
                to="/decks"
              >
                <Layers className="h-5 w-5" />
                <Trans>Decks</Trans>
              </NavLink>

              <NavLink
                className="h-auto w-auto justify-start gap-x-2"
                onClick={() => {
                  setIsOpen(false);
                }}
                params={{}}
                to="/settings"
              >
                <Settings className="h-5 w-5" />
                <Trans>Settings</Trans>
              </NavLink>
            </div>

            <Button
              asChild
              onClick={async () => {
                await logout();
                setIsOpen(false);
              }}
              variant="secondary"
            >
              <p>
                <Trans>Logout</Trans>
              </p>
            </Button>
          </nav>
        </DraggableSheetContent>
      </Sheet>

      {children}
    </header>
  );
};
