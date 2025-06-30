import React from 'react';
import { glowColors } from '../constants/glowColours';


const GlowColorPicker = ({ selected, onChange }) => {
  return (
    <div className="flex space-x-2 mt-2">
      {glowColors.map((glow) => (
        <button
          key={glow.className}
          onClick={() => onChange(glow.className)}
          className={`w-6 h-6 rounded-full border-2 transition ${
            selected === glow.className ? 'border-white scale-110' : 'border-zinc-600'
          }`}
          style={{ backgroundColor: glow.hex }}
        />
      ))}
    </div>
  );
};

export default GlowColorPicker;
