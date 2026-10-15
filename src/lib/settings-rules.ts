export type ThemeChoice = 'system' | 'dark' | 'light';
export function resolveTheme(choice: string | undefined, systemLight: boolean): 'light' | 'dark' {
  return choice === 'light' || ((!choice || choice === 'system') && systemLight) ? 'light' : 'dark';
}
export function addKeyword(keywords: string[], input: string): {ok:true; keywords:string[]} | {ok:false; error:string} {
  const keyword = input.trim();
  if (!keyword) return {ok:false,error:'Enter a keyword.'};
  if (keyword.length > 40) return {ok:false,error:'Keywords can be up to 40 characters.'};
  if (keywords.some(k => k.toLowerCase() === keyword.toLowerCase())) return {ok:false,error:'That keyword is already included.'};
  if (keywords.length >= 30) return {ok:false,error:'You can have up to 30 keywords.'};
  return {ok:true,keywords:[...keywords,keyword]};
}