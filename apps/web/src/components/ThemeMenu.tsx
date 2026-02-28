import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bahar/web-ui/components/select";
import { Trans } from "@lingui/react/macro";
import { useAtom } from "jotai";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import type { FC } from "react";
import {
  ColorTheme,
  colorThemeAtom,
  getAllColorThemes,
  getAllThemes,
  Theme,
  themeAtom,
} from "@/atoms/theme";
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
      defaultValue={theme}
      dir={dir}
      onValueChange={(theme: Theme) => {
        setTheme(theme);
      }}
    >
      <SelectTrigger className="w-max min-w-[150px] gap-x-2">
        <SelectValue />
      </SelectTrigger>

      <SelectContent id="settings-theme-menu">
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

const ColorThemeLabel: FC<{ theme: ColorTheme }> = ({ theme }) => {
  switch (theme) {
    case ColorTheme.NORD:
      return <Trans>Nord</Trans>;

    case ColorTheme.TOKYO_NIGHT:
      return <Trans>Tokyo Night</Trans>;

    case ColorTheme.DEFAULT:
    default:
      return <Trans>Default</Trans>;
  }
};

export const ColorThemeMenu = () => {
  const [colorTheme, setColorTheme] = useAtom(colorThemeAtom);
  const dir = useDir();

  return (
    <Select
      defaultValue={colorTheme}
      dir={dir}
      onValueChange={(theme: ColorTheme) => {
        setColorTheme(theme);
      }}
    >
      <SelectTrigger className="w-max min-w-[150px] gap-x-2">
        <SelectValue />
      </SelectTrigger>

      <SelectContent id="settings-color-theme">
        <SelectGroup>
          {getAllColorThemes().map((theme) => (
            <SelectItem className="cursor-pointer" key={theme} value={theme}>
              <div className="flex flex-row items-center gap-x-2">
                <Palette size={16} />

                <ColorThemeLabel theme={theme} />
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
