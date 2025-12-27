import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bahar/web-ui/components/popover";
import { Trans } from "@lingui/react/macro";
import { InfoIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useFormContext } from "react-hook-form";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";
import { IsmMorphologyCardSection } from "./IsmMorphologyCardSection";
import { VerbMorphologyCardSection } from "./VerbMorphologyCardSection";

export const MorphologyFormSection = () => {
  const form = useFormContext<z.infer<typeof FormSchema>>();
  const isMobile = useIsMobile();

  const { watch } = form;
  const type = watch("type");

  const hasMorphology = type === "fi'l" || type === "ism";

  return (
    <AnimatePresence>
      {hasMorphology ? (
        <motion.div
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{
            opacity: 0,
            y: isMobile ? undefined : -100,
            x: isMobile ? -100 : undefined,
          }}
          initial={{
            opacity: 0,
            y: isMobile ? undefined : -100,
            x: isMobile ? -100 : undefined,
          }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-x-2">
                <CardTitle>
                  <Trans>Morphology</Trans>
                </CardTitle>

                <Popover>
                  <PopoverTrigger>
                    <InfoIcon className="h-4 w-4" />
                  </PopoverTrigger>

                  <PopoverContent className="text-sm" side="right">
                    <p>
                      <Trans>
                        Morphology only applies to isms and fi'ls. This section
                        will be hidden if the type of the word is set to
                        anything else.
                      </Trans>
                    </p>
                  </PopoverContent>
                </Popover>
              </div>

              <CardDescription>
                <Trans>The morphological breakdown of the word.</Trans>
              </CardDescription>
            </CardHeader>

            {(() => {
              switch (type) {
                case "ism":
                  return <IsmMorphologyCardSection />;

                case "fi'l":
                  return <VerbMorphologyCardSection />;

                default:
                  return undefined;
              }
            })()}
          </Card>
        </motion.div>
      ) : undefined}
    </AnimatePresence>
  );
};
