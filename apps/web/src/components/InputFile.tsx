import { Trans } from "@lingui/react/macro";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@bahar/design-system";
import { FC, useCallback, useRef, useState } from "react";
import { Separator } from "./ui/separator";
import { XIcon } from "lucide-react";

type InputFileProps = Omit<InputProps, "onChange"> & {
  onChange?: (value?: File) => void;
};

export const InputFile: FC<InputFileProps> = ({
  className,
  onChange,
  ...rest
}) => {
  // We store this as state along with using a ref
  // so that we can trigger a re-render when the
  // file input is reset.
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const resetFileInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";

      setFileName("");
      onChange?.(undefined);
    }
  }, []);

  return (
    <div className="w-full sm:w-auto">
      <Label
        htmlFor="dictionary"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer w-max h-10 py-2 px-4 items-center rounded-md border border-input gap-x-3",
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            inputRef.current?.click();
          }
        }}
      >
        <Trans>Choose file</Trans>

        <Separator orientation="vertical" />

        <p className="font-medium text-muted-foreground flex gap-x-2 items-center">
          {!fileName ? (
            <Trans>No file chosen</Trans>
          ) : (
            <span className="truncate max-w-[180px]">{fileName}</span>
          )}

          {fileName && (
            <button
              tabIndex={0}
              onKeyDown={(e) => {
                e.stopPropagation();

                if (e.key === "Enter") {
                  resetFileInput();
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                resetFileInput();
              }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </p>
      </Label>

      <Input
        id="dictionary"
        name="dictionary"
        aria-labelledby="import-dictionary-button"
        type="file"
        multiple={false}
        className="hidden"
        ref={inputRef}
        onChange={(e) => {
          setFileName(e?.target?.files?.[0]?.name ?? "");

          onChange?.(e.target.files?.[0]);
        }}
        {...rest}
      />
    </div>
  );
};
