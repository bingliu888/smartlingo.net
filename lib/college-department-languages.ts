export const DEPARTMENT_LANGUAGES = ["zh","en","es","ja","ko","fr","de","ru","it","pt","ar","hi"] as const;
export type DepartmentLanguage = typeof DEPARTMENT_LANGUAGES[number];
const names:Record<DepartmentLanguage,{en:string;zh:string}>={
  zh:{en:"Chinese",zh:"中文"},en:{en:"English",zh:"英语"},es:{en:"Spanish",zh:"西班牙语"},ja:{en:"Japanese",zh:"日语"},
  ko:{en:"Korean",zh:"韩语"},fr:{en:"French",zh:"法语"},de:{en:"German",zh:"德语"},ru:{en:"Russian",zh:"俄语"},
  it:{en:"Italian",zh:"意大利语"},pt:{en:"Portuguese",zh:"葡萄牙语"},ar:{en:"Arabic",zh:"阿拉伯语"},hi:{en:"Hindi",zh:"印地语"},
};
export function departmentLanguageName(code:DepartmentLanguage,zh=false){return names[code][zh?"zh":"en"]}
export function isDepartmentLanguage(value:unknown):value is DepartmentLanguage{return typeof value==="string"&&(DEPARTMENT_LANGUAGES as readonly string[]).includes(value)}
export function departmentLanguagePair(source:DepartmentLanguage,target:DepartmentLanguage){return {titleEn:`${names[source].en} → ${names[target].en}`,titleZh:`${names[source].zh}学习${names[target].zh}`}}
