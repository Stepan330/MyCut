// Physical keys keep editor commands usable across keyboard layouts. The key
// fallback supports synthesized/accessibility events without KeyboardEvent.code.
export function shortcutKey(event){
  if(/^Key[A-Z]$/.test(event.code??''))return event.code.slice(3).toLowerCase();
  return (event.key??'').toLowerCase();
}
