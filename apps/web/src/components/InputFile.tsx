import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trans } from "@lingui/macro";
import { FC } from "react";

export const InputFile: FC<InputProps> = (props) => {
  return (
    <div className="grid max-w-sm items-center gap-1.5">
      <Label className="sr-only" htmlFor="dictionary">
        <Trans>Import</Trans>
      </Label>

      <Input id="dictionary" name="dictionary" type="file" {...props} />
    </div>
  );
};
