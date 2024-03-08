import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dynamicActivate,
  getLangDir,
  getLocaleKeys,
  TLocale,
} from "@/lib/i18n";
import { i18n } from "@lingui/core";
import { Trans } from "@lingui/macro";
import { FC } from "react";

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
  return (
    <Select
      defaultValue={i18n.locale}
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
