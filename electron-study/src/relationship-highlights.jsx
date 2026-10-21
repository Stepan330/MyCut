import {useEffect} from 'react';
export function RelationshipHighlights(){
 useEffect(()=>{let current=null,highlighted=[];
  const clear=()=>{for(const el of highlighted)el.removeAttribute('data-related');highlighted=[];current=null;};
  const show=target=>{const id=target?.closest?.('[data-parameter-id]')?.dataset.parameterId;if(id===current)return;clear();if(!id)return;current=id;highlighted=[...document.querySelectorAll('[data-parameter-id="'+CSS.escape(id)+'"]')];for(const el of highlighted)el.dataset.related='true';};
  const over=e=>show(e.target),out=e=>show(e.relatedTarget),blur=()=>clear();window.addEventListener('pointerover',over);window.addEventListener('pointerout',out);window.addEventListener('focusin',over);window.addEventListener('focusout',out);window.addEventListener('blur',blur);return()=>{clear();window.removeEventListener('pointerover',over);window.removeEventListener('pointerout',out);window.removeEventListener('focusin',over);window.removeEventListener('focusout',out);window.removeEventListener('blur',blur);};
 },[]);return null;
}
