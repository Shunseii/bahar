import { cn } from "@bahar/design-system";
import { Trans } from "@lingui/react/macro";
import { XIcon } from "lucide-react";
import { type FC, useCallback, useRef, useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "./ui/separator";

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
        className={cn(
          "flex h-10 w-max cursor-pointer items-center gap-x-3 rounded-md border border-input px-4 py-2",
          className
        )}
        htmlFor="dictionary"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            inputRef.current?.click();
          }
        }}
        tabIndex={0}
      >
        <Trans>Choose file</Trans>

        <Separator orientation="vertical" />

        <p className="flex items-center gap-x-2 font-medium text-muted-foreground">
          {fileName ? (
            <span className="max-w-[180px] truncate">{fileName}</span>
          ) : (
            <Trans>No file chosen</Trans>
          )}

          {fileName && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                resetFileInput();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();

                if (e.key === "Enter") {
                  resetFileInput();
                }
              }}
              tabIndex={0}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </p>
      </Label>

      <Input
        aria-labelledby="import-dictionary-button"
        className="hidden"
        id="dictionary"
        multiple={false}
        name="dictionary"
        onChange={(e) => {
          setFileName(e?.target?.files?.[0]?.name ?? "");

          onChange?.(e.target.files?.[0]);
        }}
        ref={inputRef}
        type="file"
        {...rest}
      />
    </div>
  );
};
