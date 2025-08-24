export const REGEXP_ONLY_EN_AR_DIGITS = "^[0-9٠-٩]+$";

export const convertArabicNumToEnglish = (arabicNumber: string) => {
  const arabicNumerals = "٠١٢٣٤٥٦٧٨٩";
  const englishNumerals = "0123456789";

  const arabicToEnglishMap = new Map(
    [...arabicNumerals].map((num, index) => [num, englishNumerals[index]]),
  );

  const englishNumber = arabicNumber.replace(
    /[٠-٩]/g,
    (match) => arabicToEnglishMap.get(match) as string,
  );

  return englishNumber;
};

export const TRACE_ID_HEADER = "x-request-id";

export const generateTraceId = () => {
  return crypto.randomUUID();
};
