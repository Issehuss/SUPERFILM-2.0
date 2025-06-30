import React, { useState } from 'react';

const TasteCard = ({ question, answer, glowColor = '#FF0000', glowStyle = 'none', useGlowStyle = false }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      className="w-full h-48 perspective"
    >
      <div
        className={`relative w-full h-full rounded-xl transition-transform duration-700 transform-style-preserve-3d ${flipped ? 'rotate-y-180' : ''}`}
        style={
          useGlowStyle
            ? { boxShadow: glowStyle, outlineOffset: '4px' }
            : { border: `3px solid ${glowColor}`, borderRadius: '1rem' }
        }
      >
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden bg-zinc-800 text-white rounded-xl flex items-center justify-center p-4">
          <span className="text-center font-bold text-base">{question}</span>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden bg-zinc-900 text-white rounded-xl flex items-center justify-center p-4 rotate-y-180">
          <span className="text-center font-bold text-base">
            {answer || 'No answer yet.'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TasteCard;





















