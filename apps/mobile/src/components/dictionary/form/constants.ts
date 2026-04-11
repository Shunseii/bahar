import { useLingui } from "@lingui/react/macro";

export const useWordTypeOptions = () => {
  const { t } = useLingui();
  return [
    { value: "ism", label: t`Ism (Noun)` },
    { value: "fi'l", label: t`Fi'l (Verb)` },
    { value: "harf", label: t`Harf (Particle)` },
    { value: "expression", label: t`Expression` },
  ];
};

export const useGenderOptions = () => {
  const { t } = useLingui();
  return [
    { value: "masculine", label: t`Masculine` },
    { value: "feminine", label: t`Feminine` },
  ];
};

export const useInflectionOptions = () => {
  const { t } = useLingui();
  return [
    { value: "triptote", label: t`Triptote` },
    { value: "diptote", label: t`Diptote` },
    { value: "indeclinable", label: t`Indeclinable` },
  ];
};
