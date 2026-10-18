import React from 'react';
export function PropertyRow({label,leading,children}){
 return <div className="property adaptive-property" data-property={label}><span className="property-leading">{leading}</span><span className="property-label">{label}</span><span className="property-spacer" aria-hidden="true"/><div className="property-controls">{children}</div></div>;
}
