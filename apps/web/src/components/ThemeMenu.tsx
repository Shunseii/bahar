import { Trans } from "@lingui/macro";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor, Moon, Sun } from "lucide-react";
import { FC } from "react";
import { useAtom } from "jotai";
import { Theme, getAllThemes, themeAtom } from "@/atoms/theme";
import { useDir } from "@/hooks/useDir";

export const ThemeIcon: FC<{ theme: Theme }> = ({ theme }) => {
  switch (theme) {
    case Theme.DARK:
      return <Moon className="rtl:scale-x-flip" size={16} />;

    case Theme.LIGHT:
      return <Sun size={16} />;

    case Theme.SYSTEM:
    default:
      return <Monitor size={16} />;
  }
};

export const ThemeLabel: FC<{ theme: Theme }> = ({ theme }) => {
  switch (theme) {
    case Theme.DARK:
      return <Trans>Dark</Trans>;

    case Theme.LIGHT:
      return <Trans>Light</Trans>;

    case Theme.SYSTEM:
    default:
      return <Trans>System</Trans>;
  }
};

export const ThemeMenu = () => {
  const [theme, setTheme] = useAtom(themeAtom);
  const dir = useDir();

  return (
    <Select
      dir={dir}
      defaultValue={theme}
      onValueChange={(theme: Theme) => {
        setTheme(theme);
      }}
    >
      <SelectTrigger className="w-max gap-x-2 dark:text-slate-50">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {getAllThemes().map((theme) => (
            <SelectItem className="cursor-pointer" key={theme} value={theme}>
              <div className="flex flex-row items-center gap-x-2">
                <ThemeIcon theme={theme} />

                <ThemeLabel theme={theme} />
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
