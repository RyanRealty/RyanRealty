// BrollCredit — unobtrusive source line for B-roll / stills (news package).
// Placed at top-right so it does not compete with bottom captions (SentenceCaption ~1450).

import React from 'react';

const FONT = "'Bebas Neue', Anton, sans-serif";

type Props = {
  text: string;
};

export const BrollCredit: React.FC<Props> = ({ text }) => {
  if (!text?.trim()) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        left: 40,
        right: 40,
        textAlign: 'right',
        fontFamily: FONT,
        fontSize: 21,
        fontWeight: 400,
        color: 'rgba(242,235,221,0.90)',
        textShadow: '0 2px 10px rgba(0,0,0,0.92), 0 0 1px rgba(0,0,0,1)',
        zIndex: 30,
        letterSpacing: 0.4,
        lineHeight: 1.25,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
};
