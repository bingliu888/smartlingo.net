import traditionalUiTranslations from "./traditional-ui-translations.generated";
import { translateStaticValue } from "./static-interface-translation";

export function traditionalChineseText(value: string) {
  return translateStaticValue(value, traditionalUiTranslations);
}
