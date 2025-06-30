import React from 'react';
import TasteCard from './TasteCard';
import { questionList } from '../constants/tasteQuestions';
import { glowOptions } from '../constants/glowOptions';

const ProfileTasteCards = ({ cards }) => {
  // Filter out invalid/ghost cards
  const cleanCards = (cards || []).filter(
    (card) =>
      card &&
      typeof card.question === 'string' &&
      questionList.includes(card.question) &&
      typeof card.answer === 'string' &&
      typeof card.glowClass === 'string'
  );

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {cleanCards.map((card, index) => {
        console.log('Rendering card:', card);
        const glow = glowOptions.free.find(g => g.class === card.glowClass);
        console.log('Matched glow option:', glow);

        return (
          <TasteCard
            key={index}
            question={card.question}
            answer={card.answer}
            glowColor={glow?.color || '#FF0000'} 
          />
        );
      })}
    </div>
  );
};

export default ProfileTasteCards;

