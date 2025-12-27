import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bahar/web-ui/components/select";
import { i18n } from "@lingui/core";
import { Trans } from "@lingui/react/macro";
import type { FC } from "react";
import { useDir } from "@/hooks/useDir";
import { dynamicActivate, getLocaleKeys, type TLocale } from "@/lib/i18n";

export const LocaleLabel: FC<{ locale: TLocale }> = ({ locale }) => {
  switch (locale) {
    case "ar":
      return <Trans>Arabic</Trans>;

    case "en":
    default:
      return <Trans>English</Trans>;
  }
};

export const LanguageMenu = () => {
  const dir = useDir();

  return (
    <Select
      defaultValue={i18n.locale}
      dir={dir}
      onValueChange={(lng: TLocale) => {
        dynamicActivate(lng);
      }}
    >
      <SelectTrigger className="w-max gap-x-2 dark:text-slate-50">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectGroup>
          {getLocaleKeys().map((lng) => (
            <SelectItem className="cursor-pointer" key={lng} value={lng}>
              <LocaleLabel locale={lng} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
