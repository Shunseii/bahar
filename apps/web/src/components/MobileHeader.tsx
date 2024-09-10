import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetOverlay,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDir } from "@/hooks/useDir";
import { trpc } from "@/lib/trpc";
import { Trans } from "@lingui/macro";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useClickAway } from "@uidotdev/usehooks";
import { Home, PanelLeft, Settings, Layers } from "lucide-react";
import React, { FC, PropsWithChildren } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { sheetVariantsNoSlideAnimations } from "./ui/sheet/variants";
import { atom, useAtom } from "jotai";
import { motion } from "framer-motion";
import Logo from "@/assets/logo.svg";

const isOpenAtom = atom(false);

const DraggableSheetContent: typeof SheetContent = React.forwardRef(
  ({ side = "right", className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = useAtom(isOpenAtom);
    const dir = useDir();

    return (
      <div>
        <SheetOverlay />

        <motion.div
          drag="x"
          initial={{ x: 0 }}
          animate={{ x: isOpen ? 0 : dir === "rtl" ? 1000 : -1000 }}
          dragMomentum={false}
          transition={{ type: "just" }}
          dragElastic={{
            left: dir === "rtl" ? 0 : 1,
            right: dir === "rtl" ? 1 : 0,
          }}
          className="fixed sm:hidden top-0 ltr:left-0 rtl:right-0 z-[100] h-full w-screen pointer-events-none"
          dragConstraints={{ left: 0, right: 0 }}
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
        >
          <SheetPrimitive.Content
            ref={ref}
            className={cn(sheetVariantsNoSlideAnimations({ side }), className)}
            {...props}
          >
            {children}

            <button
              className="absolute ltr:right-4 top-4 rtl:left-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </SheetPrimitive.Content>
        </motion.div>
      </div>
    );
  },
);
DraggableSheetContent.displayName = SheetPrimitive.Content.displayName;

export const MobileHeader: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useAtom(isOpenAtom);
  const ref = useClickAway(() => {
    setIsOpen(false);
  });
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const dir = useDir();

  const { mutate: logout } = trpc.auth.logout.useMutation();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet open={isOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="sm:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">
              <Trans>Toggle Menu</Trans>
            </span>
          </Button>
        </SheetTrigger>

        <DraggableSheetContent
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={ref as any}
          side={dir === "rtl" ? "right" : "left"}
          className="sm:max-w-xs"
        >
          <nav className="flex flex-col gap-y-6 text-lg font-medium">
            <Link
              to="/"
              params={{}}
              onClick={() => {
                setIsOpen(false);
              }}
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-y-2 text-lg font-semibold md:text-base"
            >
              <img
                src={Logo}
                className="h-5 w-5 transition-all group-hover:scale-110"
              />
              <span className="sr-only">
                <Trans>Bahar</Trans>
              </span>
            </Link>

            <div className="flex flex-col gap-y-2">
              <NavLink
                to="/"
                params={{}}
                className="h-auto w-auto justify-start gap-x-2"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <Home className="w-5 h-5" />
                <Trans>Home</Trans>
              </NavLink>

              <NavLink
                to="/decks"
                params={{}}
                className="h-auto w-auto justify-start gap-x-2"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <Layers className="h-5 w-5" />
                <Trans>Decks</Trans>
              </NavLink>

              <NavLink
                to="/settings"
                params={{}}
                onClick={() => {
                  setIsOpen(false);
                }}
                className="h-auto w-auto justify-start gap-x-2"
              >
                <Settings className="w-5 h-5" />
                <Trans>Settings</Trans>
              </NavLink>
            </div>

            <Button
              variant="secondary"
              onClick={async () => {
                logout();

                await queryClient.invalidateQueries();

                navigate({
                  to: "/login",
                  replace: true,
                  resetScroll: true,
                });
              }}
              asChild
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
