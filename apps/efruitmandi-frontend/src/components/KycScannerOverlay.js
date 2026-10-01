import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
export default function KycScannerOverlay({ children, orientation="landscape", onClose, onOrientationChange }) {
  const root=useRef(null),close=useRef(onClose),change=useRef(onOrientationChange);
  close.current=onClose;change.current=onOrientationChange;
  useEffect(()=>{
    const element=root.current,previous=document.activeElement,overflow=document.body.style.overflow;
    let disposed=false,locked=false;
    document.body.style.overflow="hidden"; element.focus();
    const update=()=>change.current?.(window.matchMedia("(pointer: coarse)").matches && window.innerHeight>window.innerWidth);
    const key=(event)=>{if(event.key==="Escape")close.current();if(event.key==="Tab"){
      const nodes=[...element.querySelectorAll('button:not(:disabled),select:not(:disabled),[tabindex="0"]')];
      if(!nodes.length){event.preventDefault();return;}
      if(event.shiftKey && (document.activeElement===nodes[0]||document.activeElement===element)){event.preventDefault();nodes.at(-1).focus();}
      else if(!event.shiftKey && document.activeElement===nodes.at(-1)){event.preventDefault();nodes[0].focus();}
    }};
    update();window.addEventListener("resize",update);window.addEventListener("orientationchange",update);element.addEventListener("keydown",key);
    if(window.matchMedia("(pointer: coarse)").matches)void (async()=>{
      try{await element.requestFullscreen?.();}catch{}
      if(disposed){if(document.fullscreenElement===element)void document.exitFullscreen?.();return;}
      try{if(!window.screen.orientation?.lock)return;await window.screen.orientation.lock(orientation);locked=true;if(disposed)window.screen.orientation?.unlock?.();}catch{}
      update();
    })();
    return ()=>{
      disposed=true;window.removeEventListener("resize",update);window.removeEventListener("orientationchange",update);element.removeEventListener("keydown",key);
      if(locked)try{window.screen.orientation?.unlock?.();}catch{}
      if(document.fullscreenElement===element)void document.exitFullscreen?.().catch(()=>{});
      document.body.style.overflow=overflow;previous?.focus?.({preventScroll:true});
    };
  },[orientation]);
  return createPortal(<div ref={root} role="dialog" aria-modal="true" aria-label={orientation==="landscape"?"Document scanner":"Live Face Capture"} tabIndex={-1} className="fixed inset-0 z-[1000] overflow-auto bg-white p-3 text-center text-gray-900" style={{height:"100dvh",paddingBottom:"max(12px, env(safe-area-inset-bottom))"}}>{children}</div>,document.body);
}
